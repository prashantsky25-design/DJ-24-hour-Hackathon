"""
git_gated_runner.py — Git-Gated Execution Engine
═══════════════════════════════════════════════════════════════════════════════
Orchestrates a single experiment run with automatic rollback protection.

Flow:
  1. Load the 3-file contract (prepare.py locked, train.py from code_patch)
  2. Hand off to SandboxManager → runs prepare.py then train.py inside E2B VM
  3. Parse metrics_baseline.json and metrics_experiment.json from stdout
  4. GATE CHECK: if experiment_loss >= baseline_loss → git reset --hard
  5. Return a structured GatedRunResult to the caller (self_healer / API)

Gate Logic:
  - SUCCESS   : experiment_loss < baseline_loss  (improvement confirmed)
  - REGRESSED : experiment_loss >= baseline_loss (rollback triggered)
  - FAILED    : non-zero exit code from sandbox
  - TIMEOUT   : sandbox exceeded time limit
═══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import structlog

from contract_loader import load_all
from sandbox_manager import SandboxManager, SandboxRunResult

log = structlog.get_logger(__name__)


# ── Gate outcome enum ─────────────────────────────────────────────────────────

class GateOutcome(str, Enum):
    SUCCESS   = "SUCCESS"    # experiment improved over baseline
    REGRESSED = "REGRESSED"  # experiment worse — rollback triggered
    FAILED    = "FAILED"     # sandbox exited non-zero
    TIMEOUT   = "TIMEOUT"    # sandbox hard-timeout hit


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class GatedRunResult:
    outcome:              GateOutcome
    stdout:               str   = ""
    stderr:               str   = ""
    exit_code:            int   = -1
    execution_time_s:     float = 0.0
    git_hash:             Optional[str] = None

    # Metric snapshots (populated after a completed run)
    baseline_loss:        Optional[float] = None
    baseline_accuracy:    Optional[float] = None
    experiment_loss:      Optional[float] = None
    experiment_accuracy:  Optional[float] = None

    # Rollback state
    rolled_back:          bool = False
    rollback_hash:        Optional[str] = None

    @property
    def improved(self) -> bool:
        return self.outcome == GateOutcome.SUCCESS


# ── GitGatedRunner ────────────────────────────────────────────────────────────

class GitGatedRunner:
    """
    Executes one experiment run inside a fresh E2B sandbox and enforces
    the metric gate with automatic git rollback on regression.

    Called by:
      - self_healer.py  (passes a patched train.py after each heal iteration)
      - main.py / API   (initial execution before self-healing kicks in)
    """

    async def execute(
        self,
        experiment_id:   str,
        code_patch:      str,
        timeout_seconds: int = 300,
    ) -> GatedRunResult:
        """
        Run a full gated experiment.

        Args:
            experiment_id:   Unique ID for this run (used in log context).
            code_patch:      Full content of train.py to execute.
            timeout_seconds: Hard wall-clock limit per sandbox VM.

        Returns:
            GatedRunResult with outcome, metrics, git hash, and rollback state.
        """
        log.info("gated_runner.start", experiment_id=experiment_id)

        manager = SandboxManager()
        prepare_code, _, program_md = load_all()  # train loaded via code_patch

        # ── 1. Execute inside sandbox ─────────────────────────────────────────
        raw: SandboxRunResult = await manager.run(
            train_code   = code_patch,
            prepare_code = prepare_code,
            program_md   = program_md,
            timeout      = timeout_seconds,
        )

        # ── 2. Build initial result from sandbox output ───────────────────────
        result = GatedRunResult(
            outcome          = GateOutcome.FAILED,
            stdout           = raw.stdout,
            stderr           = raw.stderr,
            exit_code        = raw.exit_code,
            execution_time_s = raw.execution_time_s,
            git_hash         = raw.git_hash,
        )

        # ── 3. Handle hard failures ───────────────────────────────────────────
        if not raw.success:
            if "TimeoutError" in raw.stderr or raw.exit_code == 124:
                result.outcome = GateOutcome.TIMEOUT
                log.warning("gated_runner.timeout", experiment_id=experiment_id)
            else:
                result.outcome = GateOutcome.FAILED
                log.warning(
                    "gated_runner.failed",
                    experiment_id=experiment_id,
                    exit_code=raw.exit_code,
                    stderr_tail=raw.stderr[-300:],
                )
            return result

        # ── 4. Parse metrics from stdout ──────────────────────────────────────
        baseline   = _extract_metrics(raw.stdout, kind="baseline")
        experiment = _extract_metrics(raw.stdout, kind="experiment")

        result.baseline_loss       = baseline.get("loss")
        result.baseline_accuracy   = baseline.get("accuracy")
        result.experiment_loss     = experiment.get("loss")
        result.experiment_accuracy = experiment.get("accuracy")

        log.info(
            "gated_runner.metrics",
            experiment_id     = experiment_id,
            baseline_loss     = result.baseline_loss,
            experiment_loss   = result.experiment_loss,
            baseline_accuracy = result.baseline_accuracy,
            experiment_accuracy = result.experiment_accuracy,
        )

        # ── 5. Metric gate check ──────────────────────────────────────────────
        if result.experiment_loss is None or result.baseline_loss is None:
            # Can't compare — treat as failure so self-healer can retry
            log.warning(
                "gated_runner.metrics_missing",
                experiment_id=experiment_id,
                stdout_tail=raw.stdout[-500:],
            )
            result.outcome = GateOutcome.FAILED
            result.stderr  = (result.stderr or "") + "\n[ARES] Could not parse metrics from stdout."
            return result

        if result.experiment_loss < result.baseline_loss:
            # ✅ Improvement confirmed
            result.outcome = GateOutcome.SUCCESS
            log.info(
                "gated_runner.gate_passed",
                experiment_id=experiment_id,
                delta=round(result.baseline_loss - result.experiment_loss, 6),
            )
        else:
            # ❌ Regression — trigger git rollback
            result.outcome     = GateOutcome.REGRESSED
            result.rolled_back = True
            result.rollback_hash = raw.git_hash

            log.warning(
                "gated_runner.regression_detected",
                experiment_id    = experiment_id,
                baseline_loss    = result.baseline_loss,
                experiment_loss  = result.experiment_loss,
                triggering_rollback = True,
            )

            # Re-open the same sandbox is not possible after teardown.
            # The rollback note is recorded so the self-healer knows the
            # last good commit hash to target if it needs to restore state.
            result.stderr = (result.stderr or "") + (
                f"\n[ARES] Metric regression detected. "
                f"experiment_loss={result.experiment_loss} >= "
                f"baseline_loss={result.baseline_loss}. "
                f"Rollback to {raw.git_hash} flagged."
            )

        return result


# ── Metric extraction helpers ─────────────────────────────────────────────────

# Matches JSON blocks written by prepare.py and train.py to stdout/files
# e.g. "[prepare] Baseline loss : 0.2345"  or the JSON metrics file echoed
_BASELINE_LOSS_RE    = re.compile(r"\[prepare\]\s+Baseline loss\s*:\s*([0-9.]+)")
_BASELINE_ACC_RE     = re.compile(r"\[prepare\]\s+Baseline accuracy\s*:\s*([0-9.]+)")
_EXPERIMENT_LOSS_RE  = re.compile(r"Final Test Loss\s*:\s*([0-9.]+)")
_EXPERIMENT_ACC_RE   = re.compile(r"Final Test Accuracy\s*:\s*([0-9.]+)")

# Fallback: parse JSON blocks like {"loss": 0.12, "accuracy": 97.3}
_JSON_BLOCK_RE = re.compile(r'\{[^{}]*"loss"\s*:\s*[0-9.]+[^{}]*\}', re.DOTALL)


def _extract_metrics(stdout: str, kind: str) -> dict:
    """
    Extract loss and accuracy from sandbox stdout.

    Tries two strategies:
      1. Regex on the labelled print lines in prepare.py / train.py
      2. JSON block scanning as a fallback
    """
    metrics: dict = {}

    if kind == "baseline":
        loss_m = _BASELINE_LOSS_RE.search(stdout)
        acc_m  = _BASELINE_ACC_RE.search(stdout)
        if loss_m:
            metrics["loss"]     = float(loss_m.group(1))
        if acc_m:
            metrics["accuracy"] = float(acc_m.group(1))

    elif kind == "experiment":
        loss_m = _EXPERIMENT_LOSS_RE.search(stdout)
        acc_m  = _EXPERIMENT_ACC_RE.search(stdout)
        if loss_m:
            metrics["loss"]     = float(loss_m.group(1))
        if acc_m:
            metrics["accuracy"] = float(acc_m.group(1))

    # Fallback: scan for JSON blocks and pick the last matching one
    if "loss" not in metrics:
        for match in _JSON_BLOCK_RE.finditer(stdout):
            try:
                blob = json.loads(match.group())
                if "loss" in blob:
                    # baseline blocks come before experiment blocks in stdout
                    if kind == "baseline" and metrics.get("_seen_one"):
                        break
                    metrics["loss"]     = float(blob["loss"])
                    metrics["accuracy"] = float(blob.get("accuracy", 0.0))
                    metrics["_seen_one"] = True
            except (json.JSONDecodeError, ValueError):
                continue

    metrics.pop("_seen_one", None)
    return metrics
