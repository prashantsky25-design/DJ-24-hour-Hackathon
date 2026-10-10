"""
main.py — ARES Sandbox Engine FastAPI Server
═══════════════════════════════════════════════════════════════════════════════
Exposes the Module 2 API surface consumed by the n8n Orchestrator (Module 1)
and the Next.js Frontend (Module 3).

Endpoints:
  POST /api/sandbox/execute   — run an experiment (main pipeline entry point)
  GET  /api/sandbox/runs      — list recent runs (for Frontend dashboard)
  GET  /api/sandbox/runs/{id} — get a single run's full detail + logs
  GET  /api/sandbox/stats     — aggregate metrics for the dashboard
  GET  /health                — liveness probe

Startup/Shutdown:
  - LogsSaver.init()  called on startup  (opens SQLite, creates tables)
  - LogsSaver.close() called on shutdown (flushes WAL, closes connection)
═══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from logs_saver import LogsSaver
from models import (
    ExecuteRequest,
    ExecuteResponse,
    ExecutionStatus,
    HealAttempt,
    RunMetrics,
)
from self_healer import HealingOutcome, SelfHealer

log = structlog.get_logger(__name__)

# ── Shared singletons ─────────────────────────────────────────────────────────
_logs_saver: Optional[LogsSaver] = None


def get_logs_saver() -> LogsSaver:
    assert _logs_saver is not None, "App not started — LogsSaver not initialised"
    return _logs_saver


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _logs_saver
    log.info("ares_sandbox.startup", db=settings.sqlite_db_path)
    _logs_saver = LogsSaver()
    await _logs_saver.init()
    yield
    log.info("ares_sandbox.shutdown")
    await _logs_saver.close()


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "ARES Sandbox Engine",
    description = "E2B MicroVM execution, self-healing, and logs persistence for ARES.",
    version     = "1.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],   # tighten in production
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── POST /api/sandbox/execute ─────────────────────────────────────────────────

@app.post(
    "/api/sandbox/execute",
    response_model = ExecuteResponse,
    summary        = "Execute an experiment in the E2B sandbox",
    tags           = ["Sandbox"],
)
async def execute_experiment(payload: ExecuteRequest) -> ExecuteResponse:
    """
    Main pipeline entry point for Module 1 (n8n Orchestrator).

    Accepts a code_patch (full train.py content), runs it inside an E2B
    MicroVM with the locked prepare.py contract, applies self-healing on
    failure (up to MAX_HEAL_ATTEMPTS), persists results to SQLite, and
    returns a structured response.

    **Mock payload for Module 1 development:**
    ```json
    {
      "experiment_id": "exp_001",
      "code_patch": "import torch\\n# your train.py here",
      "timeout_seconds": 300
    }
    ```
    """
    t_start = time.monotonic()
    log.info(
        "api.execute_start",
        experiment_id  = payload.experiment_id,
        timeout        = payload.timeout_seconds,
        code_lines     = payload.code_patch.count("\n"),
    )

    healer = SelfHealer()

    try:
        healing = await healer.run(
            experiment_id   = payload.experiment_id,
            code_patch      = payload.code_patch,
            timeout_seconds = payload.timeout_seconds,
        )
    except Exception as exc:
        log.exception("api.execute_unhandled_error", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Sandbox engine error: {exc}")

    # ── Persist to SQLite ─────────────────────────────────────────────────────
    saver  = get_logs_saver()
    run_id = await saver.save_run(payload.experiment_id, healing)

    # ── Build API response ────────────────────────────────────────────────────
    fr     = healing.final_run
    status = _outcome_to_status(healing.outcome)

    metrics = RunMetrics(
        baseline_loss       = fr.baseline_loss       if fr else None,
        experiment_loss     = fr.experiment_loss     if fr else None,
        baseline_accuracy   = fr.baseline_accuracy   if fr else None,
        experiment_accuracy = fr.experiment_accuracy if fr else None,
        execution_time_s    = fr.execution_time_s    if fr else round(time.monotonic() - t_start, 2),
    )

    response = ExecuteResponse(
        status        = status,
        experiment_id = payload.experiment_id,
        stdout        = fr.stdout if fr else "",
        stderr        = fr.stderr if fr else "",
        metrics       = metrics,
        git_hash      = fr.git_hash if fr else None,
        heal_attempts = healing.heal_attempts,
        error_message = (fr.stderr[-500:] if fr and fr.stderr and status == ExecutionStatus.FAILURE else None),
    )

    log.info(
        "api.execute_complete",
        experiment_id  = payload.experiment_id,
        status         = status.value,
        run_id         = run_id,
        heal_attempts  = len(healing.heal_attempts),
        elapsed        = f"{time.monotonic() - t_start:.1f}s",
    )

    return response


# ── GET /api/sandbox/runs ─────────────────────────────────────────────────────

@app.get(
    "/api/sandbox/runs",
    summary = "List recent experiment runs",
    tags    = ["Logs"],
)
async def list_runs(limit: int = Query(20, ge=1, le=100)) -> list[dict]:
    """
    Returns the N most recent runs for the Frontend dashboard.
    Each entry includes status, metrics, git_hash, and timestamps.
    """
    saver = get_logs_saver()
    return await saver.get_recent_runs(limit=limit)


# ── GET /api/sandbox/runs/{run_id} ────────────────────────────────────────────

@app.get(
    "/api/sandbox/runs/{run_id}",
    summary = "Get full detail for a single run",
    tags    = ["Logs"],
)
async def get_run_detail(run_id: int) -> dict:
    """
    Returns the run row, its stdout/stderr blobs, and all heal attempt records.
    Used by the Frontend side-by-side comparison view.
    """
    saver = get_logs_saver()

    run = await saver.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    logs     = await saver.get_run_logs(run_id)
    attempts = await saver.get_heal_attempts(run_id)

    return {
        "run":          run,
        "logs":         logs,
        "heal_attempts": attempts,
    }


# ── GET /api/sandbox/stats ────────────────────────────────────────────────────

@app.get(
    "/api/sandbox/stats",
    summary = "Aggregate stats across all runs",
    tags    = ["Logs"],
)
async def get_stats() -> dict:
    """
    Returns aggregate metrics: total runs, success/failure counts,
    average execution time, best loss achieved, best accuracy.
    Used by the Frontend dashboard header cards.
    """
    saver = get_logs_saver()
    return await saver.get_stats()


# ── GET /health ───────────────────────────────────────────────────────────────

@app.get("/health", tags=["Meta"])
async def health_check() -> dict:
    """Liveness probe for Docker / n8n health checks."""
    return {
        "status":  "ok",
        "service": "ares-sandbox-engine",
        "version": "1.0.0",
    }


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host      = settings.host,
        port      = settings.port,
        log_level = settings.log_level,
        reload    = False,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _outcome_to_status(outcome: HealingOutcome) -> ExecutionStatus:
    return {
        HealingOutcome.SUCCESS: ExecutionStatus.SUCCESS,
        HealingOutcome.HEALED:  ExecutionStatus.HEALED,
        HealingOutcome.FAILED:  ExecutionStatus.FAILURE,
    }.get(outcome, ExecutionStatus.FAILURE)
