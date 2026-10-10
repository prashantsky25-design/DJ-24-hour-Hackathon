"""
test_sandbox.py — Standalone Verification Script for Module 2
═══════════════════════════════════════════════════════════════════════════════
Run this script locally to verify the full Module 2 pipeline WITHOUT needing:
  - E2B API key / live sandbox VM
  - OpenAI API key
  - n8n orchestrator running

It stubs all external calls (E2B, OpenAI) with controlled mocks and exercises
every layer of the stack: contracts, git-gated runner, self-healer, logs saver.

Usage:
    python test_sandbox.py              # runs all test suites
    python test_sandbox.py --suite db   # run only the DB/logs suite
    python test_sandbox.py --suite heal # run only the self-healing suite
    python test_sandbox.py --suite api  # run only the FastAPI HTTP suite

Exit codes:
    0 — all tests passed
    1 — one or more tests failed
═══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import tempfile
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from unittest.mock import AsyncMock, MagicMock, patch

# ── Make sure we're importing from this directory ─────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

# Provide dummy env vars so config.py doesn't fail at import time
os.environ.setdefault("E2B_API_KEY",    "test_e2b_key")
os.environ.setdefault("GROQ_API_KEY",   "test_groq_key")

from rich.console import Console
from rich.table   import Table
from rich import box

console = Console()

# ── Test result tracking ──────────────────────────────────────────────────────

@dataclass
class TestResult:
    name:    str
    passed:  bool
    message: str = ""
    elapsed: float = 0.0

_results: list[TestResult] = []


def test(name: str):
    """Decorator to register and run an async test function."""
    def decorator(fn: Callable):
        async def wrapper():
            t0 = time.monotonic()
            try:
                await fn()
                elapsed = time.monotonic() - t0
                _results.append(TestResult(name=name, passed=True, elapsed=elapsed))
                console.print(f"  [green]✓[/green] {name} [dim]({elapsed:.2f}s)[/dim]")
            except Exception as exc:
                elapsed = time.monotonic() - t0
                msg = f"{type(exc).__name__}: {exc}"
                _results.append(TestResult(name=name, passed=False, message=msg, elapsed=elapsed))
                console.print(f"  [red]✗[/red] {name}")
                console.print(f"    [red]{msg}[/red]")
                if "--verbose" in sys.argv:
                    traceback.print_exc()
        wrapper.__test_name__ = name
        return wrapper
    return decorator


# ════════════════════════════════════════════════════════════════════════════════
# SUITE 1 — Contract Loader
# ════════════════════════════════════════════════════════════════════════════════

@test("contract_loader: load_prepare() returns non-empty string")
async def test_load_prepare():
    from contract_loader import load_prepare
    code = load_prepare()
    assert isinstance(code, str) and len(code) > 100
    assert "def evaluate" in code, "prepare.py must define evaluate()"
    assert "metrics_baseline.json" in code


@test("contract_loader: load_train() returns KAN code")
async def test_load_train():
    from contract_loader import load_train
    code = load_train()
    assert "KANLayer" in code
    assert "metrics_experiment.json" in code


@test("contract_loader: load_train() override works")
async def test_load_train_override():
    from contract_loader import load_train
    override = "# patched by coding agent\nprint('hello')"
    code = load_train(override=override)
    assert code == override


@test("contract_loader: load_all() returns 3-tuple")
async def test_load_all():
    from contract_loader import load_all
    prepare, train, program = load_all()
    assert "prepare" in prepare.lower() or "evaluate" in prepare
    assert "KAN" in train or "train" in train.lower()
    assert "program" in program.lower() or "Experiment" in program


@test("contract_loader: program.md contains requirements block")
async def test_program_md_requirements():
    from contract_loader import load_program_md
    md = load_program_md()
    assert "```requirements" in md, "program.md must have a ```requirements block"
    assert "torch" in md


# ════════════════════════════════════════════════════════════════════════════════
# SUITE 2 — Models / Pydantic Schemas
# ════════════════════════════════════════════════════════════════════════════════

@test("models: ExecuteRequest validates correctly")
async def test_execute_request_valid():
    from models import ExecuteRequest
    req = ExecuteRequest(
        experiment_id  = "exp_001",
        code_patch     = "import torch\nprint('hello')",
        timeout_seconds= 120,
    )
    assert req.experiment_id == "exp_001"
    assert req.timeout_seconds == 120


@test("models: ExecuteRequest rejects out-of-range timeout")
async def test_execute_request_timeout_validation():
    from models import ExecuteRequest
    from pydantic import ValidationError
    try:
        ExecuteRequest(experiment_id="x", code_patch="y", timeout_seconds=5)
        raise AssertionError("Should have raised ValidationError")
    except Exception as e:
        assert "validation" in type(e).__name__.lower() or "ValidationError" in str(type(e))


@test("models: ExecuteResponse serialises to dict")
async def test_execute_response_serialise():
    from models import ExecuteResponse, ExecutionStatus, RunMetrics
    resp = ExecuteResponse(
        status        = ExecutionStatus.SUCCESS,
        experiment_id = "exp_001",
        stdout        = "Epoch 5 done",
        metrics       = RunMetrics(experiment_loss=0.018, execution_time_s=12.4),
        git_hash      = "a1b2c3d4",
    )
    d = resp.model_dump()
    assert d["status"] == "SUCCESS"
    assert d["metrics"]["experiment_loss"] == 0.018


# ════════════════════════════════════════════════════════════════════════════════
# SUITE 3 — Sandbox Manager (mocked E2B)
# ════════════════════════════════════════════════════════════════════════════════

def _make_mock_sandbox(exit_code: int = 0, stdout: str = "", stderr: str = ""):
    """Build a mock E2B Sandbox object matching the v2 SDK API."""
    # v2: CommandResult has .stdout, .stderr, .exit_code as plain attrs
    cmd_result        = MagicMock()
    cmd_result.stdout    = stdout
    cmd_result.stderr    = stderr
    cmd_result.exit_code = exit_code
    cmd_result.error     = None

    mock_commands        = MagicMock()
    mock_commands.run.return_value = cmd_result

    mock_files           = MagicMock()

    mock_sbx             = MagicMock()
    mock_sbx.sandbox_id  = "sbx-test-123"
    mock_sbx.commands    = mock_commands
    mock_sbx.files       = mock_files
    mock_sbx.kill        = MagicMock()
    return mock_sbx


GOOD_STDOUT = """\
[prepare] Baseline loss     : 0.2500
[prepare] Baseline accuracy : 92.10%
[prepare] metrics_baseline.json written ✓
Epoch  5/ 5 | Train Loss: 0.1800 | Test  Loss: 0.0180 | Accuracy: 98.20%
Final Test Loss     : 0.0180
Final Test Accuracy : 98.20%
metrics_experiment.json written ✓
"""

@test("sandbox_manager: successful run returns SandboxRunResult with success=True")
async def test_sandbox_manager_success():
    from sandbox_manager import SandboxManager
    mock_sbx = _make_mock_sandbox(exit_code=0, stdout=GOOD_STDOUT)
    with patch("sandbox_manager.Sandbox") as MockSbx:
        MockSbx.create.return_value = mock_sbx
        mgr    = SandboxManager()
        result = await mgr.run(
            train_code   = "print('train')",
            prepare_code = "print('prepare')",
            program_md   = "# test",
        )
    assert result.success is True
    assert result.exit_code == 0
    assert "metrics_experiment" in result.stdout or result.execution_time_s > 0


@test("sandbox_manager: non-zero exit code returns success=False")
async def test_sandbox_manager_failure():
    from sandbox_manager import SandboxManager
    mock_sbx = _make_mock_sandbox(exit_code=1, stderr="RuntimeError: shape mismatch")
    with patch("sandbox_manager.Sandbox") as MockSbx:
        MockSbx.create.return_value = mock_sbx
        mgr    = SandboxManager()
        result = await mgr.run(
            train_code   = "raise RuntimeError('shape mismatch')",
            prepare_code = "print('prepare')",
            program_md   = "# test",
        )
    assert result.success is False


@test("sandbox_manager: _parse_requirements_from_md extracts packages")
async def test_parse_requirements():
    from sandbox_manager import _parse_requirements_from_md
    md = "# Spec\n```requirements\ntorch==2.2.2\nnumpy\n```\n"
    pkgs = _parse_requirements_from_md(md)
    assert "torch==2.2.2" in pkgs
    assert "numpy" in pkgs


@test("sandbox_manager: _parse_requirements_from_md returns empty for no block")
async def test_parse_requirements_empty():
    from sandbox_manager import _parse_requirements_from_md
    pkgs = _parse_requirements_from_md("# No requirements here\n")
    assert pkgs == []


# ════════════════════════════════════════════════════════════════════════════════
# SUITE 4 — Git-Gated Runner (mocked SandboxManager)
# ════════════════════════════════════════════════════════════════════════════════

def _make_mock_sandbox_run(success: bool, stdout: str = "", stderr: str = "", git_hash: str = "abc1234"):
    from sandbox_manager import SandboxRunResult
    return SandboxRunResult(
        success          = success,
        stdout           = stdout,
        stderr           = stderr,
        exit_code        = 0 if success else 1,
        execution_time_s = 5.0,
        git_hash         = git_hash,
    )


@test("git_gated_runner: SUCCESS when experiment_loss < baseline_loss")
async def test_gated_runner_success():
    from git_gated_runner import GateOutcome, GitGatedRunner
    mock_run = _make_mock_sandbox_run(success=True, stdout=GOOD_STDOUT)
    with patch("git_gated_runner.SandboxManager") as MockMgr:
        MockMgr.return_value.run = AsyncMock(return_value=mock_run)
        runner = GitGatedRunner()
        result = await runner.execute("exp_001", "import torch\n", timeout_seconds=30)
    assert result.outcome == GateOutcome.SUCCESS
    assert result.improved is True
    assert result.experiment_loss is not None
    assert result.baseline_loss is not None
    assert result.experiment_loss < result.baseline_loss


@test("git_gated_runner: REGRESSED when experiment_loss >= baseline_loss")
async def test_gated_runner_regression():
    from git_gated_runner import GateOutcome, GitGatedRunner
    bad_stdout = GOOD_STDOUT.replace(
        "Final Test Loss     : 0.0180", "Final Test Loss     : 0.3500"
    )
    mock_run = _make_mock_sandbox_run(success=True, stdout=bad_stdout)
    with patch("git_gated_runner.SandboxManager") as MockMgr:
        MockMgr.return_value.run = AsyncMock(return_value=mock_run)
        runner = GitGatedRunner()
        result = await runner.execute("exp_002", "import torch\n", timeout_seconds=30)
    assert result.outcome == GateOutcome.REGRESSED
    assert result.rolled_back is True
    assert "regression" in result.stderr.lower()


@test("git_gated_runner: FAILED on non-zero exit code")
async def test_gated_runner_failure():
    from git_gated_runner import GateOutcome, GitGatedRunner
    mock_run = _make_mock_sandbox_run(success=False, stderr="SyntaxError: invalid syntax")
    with patch("git_gated_runner.SandboxManager") as MockMgr:
        MockMgr.return_value.run = AsyncMock(return_value=mock_run)
        runner = GitGatedRunner()
        result = await runner.execute("exp_003", "invalid python !!!", timeout_seconds=30)
    assert result.outcome == GateOutcome.FAILED


@test("git_gated_runner: metric extraction regex parses stdout correctly")
async def test_metric_extraction():
    from git_gated_runner import _extract_metrics
    baseline   = _extract_metrics(GOOD_STDOUT, kind="baseline")
    experiment = _extract_metrics(GOOD_STDOUT, kind="experiment")
    assert baseline["loss"]        == 0.25
    assert experiment["loss"]      == 0.018
    assert experiment["accuracy"]  == 98.20


# ════════════════════════════════════════════════════════════════════════════════
# SUITE 5 — Self-Healer (mocked GitGatedRunner + OpenAI)
# ════════════════════════════════════════════════════════════════════════════════

def _make_gated_result(outcome_str: str, stdout: str = GOOD_STDOUT, stderr: str = ""):
    from git_gated_runner import GateOutcome, GatedRunResult
    # Map HealingOutcome names to their GateOutcome equivalents for test helpers
    gate_map = {"SUCCESS": "SUCCESS", "HEALED": "SUCCESS", "FAILED": "FAILED"}
    outcome = GateOutcome(gate_map.get(outcome_str, outcome_str))
    return GatedRunResult(
        outcome              = outcome,
        stdout               = stdout,
        stderr               = stderr,
        exit_code            = 0 if outcome == GateOutcome.SUCCESS else 1,
        execution_time_s     = 5.0,
        git_hash             = "abc1234",
        baseline_loss        = 0.25,
        baseline_accuracy    = 92.1,
        experiment_loss      = 0.018 if outcome == GateOutcome.SUCCESS else 0.35,
        experiment_accuracy  = 98.2  if outcome == GateOutcome.SUCCESS else 88.0,
    )


@test("self_healer: SUCCESS on clean first run (no LLM calls)")
async def test_healer_clean_success():
    from self_healer import HealingOutcome, SelfHealer
    good_result = _make_gated_result("SUCCESS")
    with patch("self_healer.GitGatedRunner") as MockRunner, \
         patch("self_healer.AsyncGroq"):
        MockRunner.return_value.execute = AsyncMock(return_value=good_result)
        healer = SelfHealer()
        result = await healer.run("exp_001", "import torch\n")
    assert result.outcome == HealingOutcome.SUCCESS
    assert result.succeeded is True
    assert len(result.heal_attempts) == 0


@test("self_healer: HEALED after one failed attempt + LLM fix")
async def test_healer_one_heal():
    from self_healer import HealingOutcome, SelfHealer
    fail_result = _make_gated_result("FAILED", stderr="RuntimeError: shape mismatch")
    good_result = _make_gated_result("SUCCESS")

    # Simulate: first call fails, second (after LLM fix) succeeds
    call_count = {"n": 0}
    async def mock_execute(*args, **kwargs):
        call_count["n"] += 1
        return fail_result if call_count["n"] == 1 else good_result

    # Mock OpenAI response
    mock_choice  = MagicMock()
    mock_choice.message.content = "import torch\n# fixed code\nprint('fixed')"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("self_healer.GitGatedRunner") as MockRunner, \
         patch("self_healer.AsyncGroq") as MockGroq:
        MockRunner.return_value.execute = mock_execute
        mock_llm = AsyncMock()
        mock_llm.chat.completions.create = AsyncMock(return_value=mock_response)
        MockGroq.return_value = mock_llm

        healer = SelfHealer()
        result = await healer.run("exp_002", "import torch\n# broken")

    assert result.outcome == HealingOutcome.HEALED
    assert result.succeeded is True
    assert len(result.heal_attempts) >= 1


@test("self_healer: FAILED after exhausting all attempts")
async def test_healer_exhausted():
    from self_healer import HealingOutcome, SelfHealer
    fail_result  = _make_gated_result("FAILED", stderr="RuntimeError: persistent error")
    mock_choice  = MagicMock()
    mock_choice.message.content = "import torch\n# still broken"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("self_healer.GitGatedRunner") as MockRunner, \
         patch("self_healer.AsyncGroq") as MockGroq:
        MockRunner.return_value.execute = AsyncMock(return_value=fail_result)
        mock_llm = AsyncMock()
        mock_llm.chat.completions.create = AsyncMock(return_value=mock_response)
        MockGroq.return_value = mock_llm

        healer = SelfHealer()
        result = await healer.run("exp_003", "import torch\n# broken forever")

    assert result.outcome == HealingOutcome.FAILED
    assert result.succeeded is False


@test("self_healer: _summarise_error extracts last Error line")
async def test_summarise_error():
    from self_healer import _summarise_error
    stderr = "Traceback (most recent call last):\n  File train.py, line 42\nRuntimeError: size mismatch"
    summary = _summarise_error(stderr)
    assert "RuntimeError" in summary


@test("self_healer: _strip_markdown_fences removes code fences")
async def test_strip_fences():
    from self_healer import _strip_markdown_fences
    fenced   = "```python\nimport torch\nprint('hello')\n```"
    stripped = _strip_markdown_fences(fenced)
    assert "```" not in stripped
    assert "import torch" in stripped


# ════════════════════════════════════════════════════════════════════════════════
# SUITE 6 — Logs Saver (in-memory SQLite)
# ════════════════════════════════════════════════════════════════════════════════

async def _make_saver() -> "LogsSaver":
    from logs_saver import LogsSaver
    saver = LogsSaver(db_path=":memory:")
    await saver.init()
    return saver


def _make_healing_result(outcome_str: str) -> "HealingResult":
    from self_healer import HealingOutcome, HealingResult
    from models import HealAttempt, HealAttemptStatus
    gated = _make_gated_result(outcome_str)
    attempts = []
    if outcome_str == "HEALED":
        # Real flow: one FAILED attempt recorded, then a FIXED attempt after the fix
        attempts.append(HealAttempt(
            attempt_number = 0,
            error_summary  = "RuntimeError: test error",
            patch_applied  = "import torch\n# broken",
            status         = HealAttemptStatus.FAILED,
            stdout         = "",
            stderr         = "RuntimeError: test error",
        ))
        attempts.append(HealAttempt(
            attempt_number = 1,
            error_summary  = "N/A — previous error was fixed",
            patch_applied  = "import torch\n# fixed",
            status         = HealAttemptStatus.FIXED,
            stdout         = "some output",
            stderr         = "",
        ))
    elif outcome_str == "FAILED":
        attempts.append(HealAttempt(
            attempt_number = 1,
            error_summary  = "RuntimeError: test error",
            patch_applied  = "import torch\n",
            status         = HealAttemptStatus.FAILED,
            stdout         = "some output",
            stderr         = "RuntimeError: test error",
        ))
    return HealingResult(
        outcome       = HealingOutcome(outcome_str),
        final_run     = gated,
        heal_attempts = attempts,
        total_time_s  = 5.5,
        final_code    = "import torch\n# final code",
    )


@test("logs_saver: save_run returns positive integer run_id")
async def test_logs_saver_save():
    saver  = await _make_saver()
    result = _make_healing_result("SUCCESS")
    run_id = await saver.save_run("exp_001", result)
    assert isinstance(run_id, int) and run_id > 0
    await saver.close()


@test("logs_saver: get_run retrieves saved row")
async def test_logs_saver_get_run():
    saver  = await _make_saver()
    result = _make_healing_result("SUCCESS")
    run_id = await saver.save_run("exp_001", result)
    row    = await saver.get_run(run_id)
    assert row is not None
    assert row["experiment_id"] == "exp_001"
    assert row["status"] == "SUCCESS"
    await saver.close()


@test("logs_saver: get_recent_runs returns list")
async def test_logs_saver_recent_runs():
    saver = await _make_saver()
    for i in range(3):
        await saver.save_run(f"exp_00{i}", _make_healing_result("SUCCESS"))
    runs = await saver.get_recent_runs(limit=10)
    assert len(runs) == 3
    await saver.close()


@test("logs_saver: heal_attempts are persisted and retrievable")
async def test_logs_saver_heal_attempts():
    saver  = await _make_saver()
    result = _make_healing_result("HEALED")
    run_id = await saver.save_run("exp_heal", result)
    attempts = await saver.get_heal_attempts(run_id)
    assert len(attempts) == 2   # FAILED attempt + FIXED attempt
    assert attempts[0]["error_summary"] == "RuntimeError: test error"
    await saver.close()


@test("logs_saver: stdout_logs blob is persisted and retrievable")
async def test_logs_saver_stdout_logs():
    saver  = await _make_saver()
    result = _make_healing_result("SUCCESS")
    run_id = await saver.save_run("exp_logs", result)
    logs   = await saver.get_run_logs(run_id)
    assert logs is not None
    assert "stdout" in logs


@test("logs_saver: get_stats returns aggregate dict")
async def test_logs_saver_stats():
    saver = await _make_saver()
    await saver.save_run("exp_s1", _make_healing_result("SUCCESS"))
    await saver.save_run("exp_s2", _make_healing_result("FAILED"))
    stats = await saver.get_stats()
    assert stats["total_runs"] == 2
    assert stats["successes"] == 1
    await saver.close()


@test("logs_saver: error_index upserted on HEALED run")
async def test_logs_saver_error_index():
    saver  = await _make_saver()
    result = _make_healing_result("HEALED")
    await saver.save_run("exp_healed", result)
    solution = await saver.lookup_error_solution("RuntimeError: test error")
    assert solution is not None
    assert "torch" in solution
    await saver.close()


@test("logs_saver: get_run returns None for missing run_id")
async def test_logs_saver_missing():
    saver = await _make_saver()
    row   = await saver.get_run(99999)
    assert row is None
    await saver.close()


# ════════════════════════════════════════════════════════════════════════════════
# SUITE 7 — FastAPI HTTP endpoints (TestClient, no real sandbox)
# ════════════════════════════════════════════════════════════════════════════════

@test("api: GET /health returns 200 ok")
async def test_api_health():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@test("api: GET /api/sandbox/runs returns list")
async def test_api_list_runs():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as client:
        resp = client.get("/api/sandbox/runs?limit=5")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@test("api: GET /api/sandbox/stats returns aggregate dict")
async def test_api_stats():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as client:
        resp = client.get("/api/sandbox/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_runs" in data


@test("api: GET /api/sandbox/runs/99999 returns 404")
async def test_api_run_not_found():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as client:
        resp = client.get("/api/sandbox/runs/99999")
    assert resp.status_code == 404


@test("api: POST /api/sandbox/execute returns valid ExecuteResponse schema")
async def test_api_execute():
    from fastapi.testclient import TestClient
    from main import app
    from self_healer import HealingOutcome, HealingResult

    good_healing = HealingResult(
        outcome      = HealingOutcome.SUCCESS,
        final_run    = _make_gated_result("SUCCESS"),
        heal_attempts= [],
        total_time_s = 6.0,
        final_code   = "import torch\n",
    )

    with patch("main.SelfHealer") as MockHealer:
        MockHealer.return_value.run = AsyncMock(return_value=good_healing)
        with TestClient(app) as client:
            resp = client.post("/api/sandbox/execute", json={
                "experiment_id":   "exp_api_test",
                "code_patch":      "import torch\nprint('hello')",
                "timeout_seconds": 60,
            })

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUCCESS"
    assert data["experiment_id"] == "exp_api_test"
    assert "metrics" in data
    assert "git_hash" in data


# ════════════════════════════════════════════════════════════════════════════════
# Runner
# ════════════════════════════════════════════════════════════════════════════════

SUITES = {
    "contracts": [
        test_load_prepare, test_load_train, test_load_train_override,
        test_load_all, test_program_md_requirements,
    ],
    "models": [
        test_execute_request_valid, test_execute_request_timeout_validation,
        test_execute_response_serialise,
    ],
    "sandbox": [
        test_sandbox_manager_success, test_sandbox_manager_failure,
        test_parse_requirements, test_parse_requirements_empty,
    ],
    "gate": [
        test_gated_runner_success, test_gated_runner_regression,
        test_gated_runner_failure, test_metric_extraction,
    ],
    "heal": [
        test_healer_clean_success, test_healer_one_heal, test_healer_exhausted,
        test_summarise_error, test_strip_fences,
    ],
    "db": [
        test_logs_saver_save, test_logs_saver_get_run,
        test_logs_saver_recent_runs, test_logs_saver_heal_attempts,
        test_logs_saver_stdout_logs, test_logs_saver_stats,
        test_logs_saver_error_index, test_logs_saver_missing,
    ],
    "api": [
        test_api_health, test_api_list_runs, test_api_stats,
        test_api_run_not_found, test_api_execute,
    ],
}


async def run_suite(name: str, tests: list) -> None:
    console.print(f"\n[bold cyan]── Suite: {name} ──[/bold cyan]")
    for t in tests:
        await t()


async def main_runner(suite_filter: str | None) -> int:
    console.print("\n[bold white]ARES Module 2 — Standalone Test Suite[/bold white]")
    console.print(f"[dim]Python {sys.version.split()[0]} | {Path.cwd()}[/dim]\n")

    if suite_filter:
        if suite_filter not in SUITES:
            console.print(f"[red]Unknown suite '{suite_filter}'. "
                          f"Available: {', '.join(SUITES)}[/red]")
            return 1
        await run_suite(suite_filter, SUITES[suite_filter])
    else:
        for name, tests in SUITES.items():
            await run_suite(name, tests)

    # ── Summary table ─────────────────────────────────────────────────────────
    passed  = sum(1 for r in _results if r.passed)
    failed  = sum(1 for r in _results if not r.passed)
    total   = len(_results)

    table = Table(box=box.SIMPLE_HEAVY, show_header=True, header_style="bold")
    table.add_column("Result",  width=8)
    table.add_column("Test",    style="dim")
    table.add_column("Time",    width=8, justify="right")
    table.add_column("Message", style="red")

    for r in _results:
        icon = "[green]PASS[/green]" if r.passed else "[red]FAIL[/red]"
        table.add_row(icon, r.name, f"{r.elapsed:.2f}s", r.message if not r.passed else "")

    console.print()
    console.print(table)
    console.print(
        f"\n[bold]Results: [green]{passed} passed[/green] / "
        f"[red]{failed} failed[/red] / {total} total[/bold]\n"
    )

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ARES Module 2 standalone tests")
    parser.add_argument(
        "--suite", "-s",
        choices=list(SUITES.keys()),
        default=None,
        help="Run only a specific test suite",
    )
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Print full tracebacks on failure")
    args = parser.parse_args()

    exit_code = asyncio.run(main_runner(args.suite))
    sys.exit(exit_code)
