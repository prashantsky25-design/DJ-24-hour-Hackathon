"""
models.py — Shared Pydantic schemas used across all sandbox modules.
These are the canonical API contracts for Module 2.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class ExecutionStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    HEALED  = "HEALED"   # succeeded after self-healing retries
    TIMEOUT = "TIMEOUT"


class HealAttemptStatus(str, Enum):
    FIXED   = "FIXED"
    FAILED  = "FAILED"


# ── Request ───────────────────────────────────────────────────────────────────

class ExecuteRequest(BaseModel):
    """Payload for POST /api/sandbox/execute — matches Module 1's contract."""

    experiment_id: str = Field(
        ...,
        description="Unique identifier for this experiment run",
        examples=["exp_001"],
    )
    code_patch: str = Field(
        ...,
        description="Full content of train.py to be executed in the sandbox",
        examples=["import torch\n# Modified activation function...\n"],
    )
    timeout_seconds: int = Field(
        300,
        ge=10,
        le=600,
        description="Per-run timeout in seconds (overrides server default)",
    )


# ── Sub-models ────────────────────────────────────────────────────────────────

class RunMetrics(BaseModel):
    """Metrics extracted from a successful training run."""
    baseline_loss: Optional[float] = None
    experiment_loss: Optional[float] = None
    baseline_accuracy: Optional[float] = None
    experiment_accuracy: Optional[float] = None
    execution_time_s: Optional[float] = None


class HealAttempt(BaseModel):
    """Record of a single self-healing iteration."""
    attempt_number: int
    error_summary: str
    patch_applied: str
    status: HealAttemptStatus
    stdout: str = ""
    stderr: str = ""


# ── Response ──────────────────────────────────────────────────────────────────

class ExecuteResponse(BaseModel):
    """
    Response from POST /api/sandbox/execute.
    This is exactly what Module 1 (Orchestrator) will receive.
    """

    status: ExecutionStatus
    experiment_id: str
    stdout: str = ""
    stderr: str = ""
    metrics: RunMetrics = Field(default_factory=RunMetrics)
    git_hash: Optional[str] = None
    heal_attempts: list[HealAttempt] = Field(default_factory=list)
    error_message: Optional[str] = None
