"""
logs_saver.py — Persistent Memory & Logs Saver
═══════════════════════════════════════════════════════════════════════════════
Persists all experiment data to SQLite at settings.sqlite_db_path.

Tables:
  runs          — one row per experiment execution (metrics, status, git hash)
  heal_attempts — one row per LLM self-healing iteration
  error_index   — deduplicated error → solution lookup (avoids re-asking LLM)
  stdout_logs   — full stdout/stderr blobs (kept separate to avoid bloating runs)

Key design decisions:
  - aiosqlite for async I/O (non-blocking, matches FastAPI's async runtime)
  - DB auto-initialised on first use (no separate migration step needed)
  - error_index enables future "skip LLM if we've seen this error" optimisation
  - All writes are wrapped in explicit transactions for atomicity
═══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Optional

import aiosqlite
import structlog

from config import settings
from models import ExecutionStatus, HealAttempt, HealAttemptStatus, RunMetrics
from self_healer import HealingOutcome, HealingResult

log = structlog.get_logger(__name__)

# ── Schema DDL ────────────────────────────────────────────────────────────────

_DDL = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS runs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id       TEXT    NOT NULL,
    status              TEXT    NOT NULL,          -- ExecutionStatus value
    git_hash            TEXT,
    baseline_loss       REAL,
    baseline_accuracy   REAL,
    experiment_loss     REAL,
    experiment_accuracy REAL,
    execution_time_s    REAL,
    heal_count          INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL           -- Unix timestamp
);

CREATE TABLE IF NOT EXISTS heal_attempts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    attempt_number  INTEGER NOT NULL,
    error_summary   TEXT,
    patch_applied   TEXT,
    status          TEXT    NOT NULL,              -- HealAttemptStatus value
    stdout          TEXT,
    stderr          TEXT,
    created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS error_index (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    error_signature TEXT    NOT NULL UNIQUE,       -- normalised error key
    solution_code   TEXT    NOT NULL,              -- last working fix
    hit_count       INTEGER NOT NULL DEFAULT 1,
    last_seen_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stdout_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    stdout          TEXT,
    stderr          TEXT,
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_experiment_id  ON runs(experiment_id);
CREATE INDEX IF NOT EXISTS idx_runs_created_at     ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_index_sig     ON error_index(error_signature);
"""


# ── LogsSaver ─────────────────────────────────────────────────────────────────

class LogsSaver:
    """
    Async SQLite persistence layer for all ARES sandbox run data.

    Usage:
        saver = LogsSaver()
        await saver.init()                    # call once at app startup
        run_id = await saver.save_run(...)    # after each experiment
        await saver.close()                   # at app shutdown
    """

    def __init__(self, db_path: str = settings.sqlite_db_path) -> None:
        self._db_path = db_path
        self._conn: Optional[aiosqlite.Connection] = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def init(self) -> None:
        """Open DB connection and create tables if they don't exist."""
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = await aiosqlite.connect(self._db_path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.executescript(_DDL)
        await self._conn.commit()
        log.info("logs_saver.init", db=self._db_path)

    async def close(self) -> None:
        """Close DB connection gracefully."""
        if self._conn:
            await self._conn.close()
            self._conn = None
            log.info("logs_saver.closed")

    # ── Primary write: save a complete healing result ─────────────────────────

    async def save_run(
        self,
        experiment_id: str,
        healing_result: HealingResult,
    ) -> int:
        """
        Persist a complete HealingResult to the DB.

        Inserts:
          - One row in `runs`
          - One row per HealAttempt in `heal_attempts`
          - One row in `stdout_logs`
          - Updates `error_index` if healing succeeded

        Returns:
            The auto-incremented run_id.
        """
        assert self._conn, "Call init() before save_run()"

        now     = int(time.time())
        fr      = healing_result.final_run
        status  = _healing_outcome_to_status(healing_result.outcome)

        async with self._conn.execute(
            """
            INSERT INTO runs (
                experiment_id, status, git_hash,
                baseline_loss, baseline_accuracy,
                experiment_loss, experiment_accuracy,
                execution_time_s, heal_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                experiment_id,
                status.value,
                fr.git_hash              if fr else None,
                fr.baseline_loss         if fr else None,
                fr.baseline_accuracy     if fr else None,
                fr.experiment_loss       if fr else None,
                fr.experiment_accuracy   if fr else None,
                fr.execution_time_s      if fr else healing_result.total_time_s,
                len(healing_result.heal_attempts),
                now,
            ),
        ) as cursor:
            run_id = cursor.lastrowid

        # ── Heal attempts ─────────────────────────────────────────────────────
        for attempt in healing_result.heal_attempts:
            await self._conn.execute(
                """
                INSERT INTO heal_attempts (
                    run_id, attempt_number, error_summary,
                    patch_applied, status, stdout, stderr, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    attempt.attempt_number,
                    attempt.error_summary,
                    attempt.patch_applied,
                    attempt.status.value,
                    attempt.stdout,
                    attempt.stderr,
                    now,
                ),
            )

        # ── stdout / stderr blob ──────────────────────────────────────────────
        await self._conn.execute(
            """
            INSERT INTO stdout_logs (run_id, stdout, stderr, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                run_id,
                fr.stdout if fr else "",
                fr.stderr if fr else "",
                now,
            ),
        )

        # ── Update error index if healing fixed a broken run ──────────────────
        if healing_result.outcome == HealingOutcome.HEALED:
            await self._upsert_error_index(healing_result, now)

        await self._conn.commit()

        log.info(
            "logs_saver.run_saved",
            run_id        = run_id,
            experiment_id = experiment_id,
            status        = status.value,
            heal_count    = len(healing_result.heal_attempts),
        )
        return run_id

    # ── Query helpers ─────────────────────────────────────────────────────────

    async def get_run(self, run_id: int) -> Optional[dict]:
        """Fetch a single run row by ID."""
        assert self._conn
        async with self._conn.execute(
            "SELECT * FROM runs WHERE id = ?", (run_id,)
        ) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None

    async def get_recent_runs(self, limit: int = 20) -> list[dict]:
        """Return the N most recent runs, newest first."""
        assert self._conn
        async with self._conn.execute(
            "SELECT * FROM runs ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

    async def get_run_logs(self, run_id: int) -> Optional[dict]:
        """Fetch stdout/stderr blobs for a run."""
        assert self._conn
        async with self._conn.execute(
            "SELECT stdout, stderr FROM stdout_logs WHERE run_id = ?", (run_id,)
        ) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None

    async def get_heal_attempts(self, run_id: int) -> list[dict]:
        """Fetch all heal attempt records for a given run."""
        assert self._conn
        async with self._conn.execute(
            "SELECT * FROM heal_attempts WHERE run_id = ? ORDER BY attempt_number",
            (run_id,),
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

    async def lookup_error_solution(self, error_summary: str) -> Optional[str]:
        """
        Check the error index for a known fix.
        Returns the solution code string if found, else None.
        Enables the self-healer to skip the LLM call for known errors.
        """
        assert self._conn
        sig = _normalise_error_signature(error_summary)
        async with self._conn.execute(
            "SELECT solution_code FROM error_index WHERE error_signature = ?",
            (sig,),
        ) as cur:
            row = await cur.fetchone()
            if row:
                # Bump hit count
                await self._conn.execute(
                    "UPDATE error_index SET hit_count = hit_count + 1, "
                    "last_seen_at = ? WHERE error_signature = ?",
                    (int(time.time()), sig),
                )
                await self._conn.commit()
                return row["solution_code"]
            return None

    async def get_experiment_history(self, experiment_id: str) -> list[dict]:
        """Return all runs for a given experiment_id, oldest first."""
        assert self._conn
        async with self._conn.execute(
            "SELECT * FROM runs WHERE experiment_id = ? ORDER BY created_at ASC",
            (experiment_id,),
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

    async def get_stats(self) -> dict:
        """Return aggregate stats for the dashboard."""
        assert self._conn
        async with self._conn.execute(
            """
            SELECT
                COUNT(*)                                    AS total_runs,
                SUM(CASE WHEN status='SUCCESS'  THEN 1 ELSE 0 END) AS successes,
                SUM(CASE WHEN status='HEALED'   THEN 1 ELSE 0 END) AS healed,
                SUM(CASE WHEN status='FAILURE'  THEN 1 ELSE 0 END) AS failures,
                AVG(execution_time_s)                       AS avg_execution_time_s,
                AVG(heal_count)                             AS avg_heal_attempts,
                MIN(experiment_loss)                        AS best_loss,
                MAX(experiment_accuracy)                    AS best_accuracy
            FROM runs
            """
        ) as cur:
            row = await cur.fetchone()
            return dict(row) if row else {}

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _upsert_error_index(
        self, healing_result: HealingResult, now: int
    ) -> None:
        """
        After a successful heal, store the (error → solution) mapping
        so future identical errors skip the LLM call.
        """
        # Use the error from the last FAILED attempt before the final fix
        failed = [
            a for a in healing_result.heal_attempts
            if a.status == HealAttemptStatus.FAILED
        ]
        if not failed:
            return

        last_error   = failed[-1].error_summary
        solution     = healing_result.final_code
        sig          = _normalise_error_signature(last_error)

        await self._conn.execute(
            """
            INSERT INTO error_index (error_signature, solution_code, hit_count, last_seen_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(error_signature) DO UPDATE SET
                solution_code = excluded.solution_code,
                hit_count     = hit_count + 1,
                last_seen_at  = excluded.last_seen_at
            """,
            (sig, solution, now),
        )
        log.debug("logs_saver.error_index_updated", signature=sig[:80])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _healing_outcome_to_status(outcome: HealingOutcome) -> ExecutionStatus:
    mapping = {
        HealingOutcome.SUCCESS: ExecutionStatus.SUCCESS,
        HealingOutcome.HEALED:  ExecutionStatus.HEALED,
        HealingOutcome.FAILED:  ExecutionStatus.FAILURE,
    }
    return mapping.get(outcome, ExecutionStatus.FAILURE)


def _normalise_error_signature(error: str) -> str:
    """
    Reduce an error string to a stable lookup key by stripping
    line numbers, memory addresses, and file paths.

    e.g. "RuntimeError: size mismatch at /home/user/train.py:42"
      →  "RuntimeError: size mismatch"
    """
    import re
    s = error.strip()
    # Remove file paths
    s = re.sub(r'File "[^"]+",?\s*', "", s)
    # Remove "line NNN"
    s = re.sub(r"line \d+", "", s)
    # Remove memory addresses like 0x7f3a...
    s = re.sub(r"0x[0-9a-fA-F]+", "", s)
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s[:256]   # cap key length
