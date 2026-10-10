"""
sandbox_manager.py — E2B MicroVM Sandbox Integration Layer (SDK v2)

Responsibilities:
  - Spawn an E2B sandbox with the correct template
  - Upload the 3-file contract (prepare.py, train.py, program.md)
  - Execute prepare.py then train.py inside the VM
  - Capture stdout / stderr from CommandResult
  - Tear down the sandbox after each run (or on error)
  - Expose a clean async interface consumed by git_gated_runner.py

E2B SDK v2 API changes vs v0.x:
  - Sandbox.create(template, timeout, api_key=...) instead of Sandbox(...)
  - sbx.commands.run(cmd, cwd=..., timeout=...)  instead of process.start_and_wait
  - sbx.files.write(path, content)               instead of filesystem.write
  - CommandResult.stdout / .stderr / .exit_code  are plain strings/int
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Optional

import structlog
from e2b import Sandbox

from config import settings

log = structlog.get_logger(__name__)

# ── Paths inside the E2B sandbox VM ──────────────────────────────────────────
SANDBOX_WORKDIR  = "/home/user/ares"
SANDBOX_TRAIN    = f"{SANDBOX_WORKDIR}/train.py"
SANDBOX_PREPARE  = f"{SANDBOX_WORKDIR}/prepare.py"
SANDBOX_PROGRAM  = f"{SANDBOX_WORKDIR}/program.md"


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class SandboxRunResult:
    """Raw output from a single sandbox execution."""
    stdout:           str   = ""
    stderr:           str   = ""
    exit_code:        int   = -1
    execution_time_s: float = 0.0
    git_hash:         Optional[str] = None
    success:          bool  = False


# ── SandboxManager ────────────────────────────────────────────────────────────

class SandboxManager:
    """
    Manages the full lifecycle of one E2B MicroVM per experiment run.

    Usage (called from git_gated_runner.py):
        manager = SandboxManager()
        result  = await manager.run(train_code, prepare_code, program_md)
    """

    def __init__(self) -> None:
        self._sbx: Optional[Sandbox] = None

    # ── Public interface ──────────────────────────────────────────────────────

    async def run(
        self,
        train_code:   str,
        prepare_code: str,
        program_md:   str,
        timeout:      int = settings.sandbox_timeout_seconds,
    ) -> SandboxRunResult:
        """
        Spin up a sandbox, upload files, execute, capture output, tear down.
        Returns a SandboxRunResult regardless of success/failure.
        """
        result = SandboxRunResult()
        start  = time.monotonic()
        loop   = asyncio.get_event_loop()

        try:
            log.info("sandbox.spawning", template=settings.e2b_template)

            # Sandbox.create() is synchronous — run in thread executor
            self._sbx = await loop.run_in_executor(
                None,
                lambda: Sandbox.create(
                    template=settings.e2b_template,
                    timeout=timeout,
                    api_key=settings.e2b_api_key,
                ),
            )
            log.info("sandbox.spawned", sandbox_id=self._sbx.sandbox_id)

            # ── 1. Bootstrap workspace ────────────────────────────────────
            await self._bootstrap_workspace(loop)

            # ── 2. Upload the 3-file contract ─────────────────────────────
            await self._upload_files(loop, train_code, prepare_code, program_md)

            # ── 3. Install dependencies from program.md ───────────────────
            await self._install_deps(loop, program_md)

            # ── 4. Run prepare.py (locked — never modified by agents) ──────
            prepare_result = await self._exec(
                loop, f"python prepare.py", cwd=SANDBOX_WORKDIR, label="prepare.py"
            )
            if prepare_result.exit_code != 0:
                result.stderr        = prepare_result.stderr
                result.stdout        = prepare_result.stdout
                result.exit_code     = prepare_result.exit_code
                result.execution_time_s = time.monotonic() - start
                return result

            # ── 5. Git-commit the clean state before training ─────────────
            result.git_hash = await self._git_commit(loop, "pre-run: clean state")

            # ── 6. Run train.py (editable by Coding Agent) ─────────────────
            train_result = await self._exec(
                loop, f"python train.py", cwd=SANDBOX_WORKDIR, label="train.py",
                timeout=timeout,
            )

            result.stdout        = prepare_result.stdout + "\n" + train_result.stdout
            result.stderr        = train_result.stderr
            result.exit_code     = train_result.exit_code
            result.success       = (train_result.exit_code == 0)
            result.execution_time_s = time.monotonic() - start

            log.info(
                "sandbox.run_complete",
                exit_code=result.exit_code,
                success=result.success,
                elapsed=f"{result.execution_time_s:.1f}s",
            )

        except Exception as exc:
            log.exception("sandbox.run_error", error=str(exc))
            result.stderr        = str(exc)
            result.exit_code     = -1
            result.execution_time_s = time.monotonic() - start

        finally:
            await self._teardown(loop)

        return result

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _bootstrap_workspace(self, loop) -> None:
        """Create workdir and initialise a git repo inside the sandbox."""
        cmds = [
            f"mkdir -p {SANDBOX_WORKDIR}",
            f"git init -q {SANDBOX_WORKDIR}",
            f"git -C {SANDBOX_WORKDIR} config user.email 'ares@sandbox.local'",
            f"git -C {SANDBOX_WORKDIR} config user.name 'ARES Sandbox'",
        ]
        for cmd in cmds:
            await self._exec(loop, cmd, label="bootstrap")
        log.debug("sandbox.workspace_ready", path=SANDBOX_WORKDIR)

    async def _upload_files(
        self, loop, train_code: str, prepare_code: str, program_md: str
    ) -> None:
        """Write the 3-file contract into the sandbox filesystem."""
        files = {
            SANDBOX_TRAIN:   train_code,
            SANDBOX_PREPARE: prepare_code,
            SANDBOX_PROGRAM: program_md,
        }
        for remote_path, content in files.items():
            await loop.run_in_executor(
                None,
                lambda p=remote_path, c=content: self._sbx.files.write(p, c),
            )
            log.debug("sandbox.file_uploaded", path=remote_path)

    async def _install_deps(self, loop, program_md: str) -> None:
        """
        Parse program.md for a ```requirements block and pip-install deps.
        Falls back gracefully if no requirements block is present.
        """
        deps = _parse_requirements_from_md(program_md)
        if deps:
            pkg_list = " ".join(deps)
            log.info("sandbox.installing_deps", packages=pkg_list)
            await self._exec(
                loop,
                f"pip install --quiet {pkg_list}",
                label="pip-install",
                timeout=180,
            )
        else:
            log.debug("sandbox.no_extra_deps")

    async def _git_commit(self, loop, message: str) -> Optional[str]:
        """Stage all files and create a git commit; return the short hash."""
        await self._exec(loop, f"git -C {SANDBOX_WORKDIR} add -A", label="git-add")
        await self._exec(
            loop,
            f"git -C {SANDBOX_WORKDIR} commit -m '{message}' --allow-empty",
            label="git-commit",
        )
        hash_res = await self._exec(
            loop,
            f"git -C {SANDBOX_WORKDIR} rev-parse --short HEAD",
            label="git-hash",
        )
        git_hash = hash_res.stdout.strip() if hash_res.exit_code == 0 else None
        log.debug("sandbox.git_commit", message=message, hash=git_hash)
        return git_hash

    async def _exec(
        self,
        loop,
        command: str,
        label:   str   = "",
        cwd:     Optional[str] = None,
        timeout: int   = 60,
    ) -> "_ExecResult":
        """Run a shell command in the sandbox and return stdout/stderr/exit_code."""
        log.debug("sandbox.exec", label=label, cmd=command[:120])

        result = await loop.run_in_executor(
            None,
            lambda: self._sbx.commands.run(
                command,
                cwd=cwd,
                timeout=float(timeout),
            ),
        )

        stdout    = result.stdout or ""
        stderr    = result.stderr or ""
        exit_code = result.exit_code if result.exit_code is not None else 0

        if exit_code != 0:
            log.warning(
                "sandbox.exec_failed",
                label=label,
                exit_code=exit_code,
                stderr=stderr[:300],
            )

        return _ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)

    async def _teardown(self, loop) -> None:
        """Kill and clean up the sandbox VM."""
        if self._sbx:
            try:
                await loop.run_in_executor(None, self._sbx.kill)
                log.info("sandbox.closed", sandbox_id=self._sbx.sandbox_id)
            except Exception as exc:
                log.warning("sandbox.teardown_error", error=str(exc))
            finally:
                self._sbx = None


# ── Internal helpers ──────────────────────────────────────────────────────────

@dataclass
class _ExecResult:
    stdout:    str
    stderr:    str
    exit_code: int


def _parse_requirements_from_md(md_content: str) -> list[str]:
    """
    Extract pip packages from a fenced code block in program.md:

        ```requirements
        torch
        numpy
        ```
    """
    lines: list[str] = []
    inside = False
    for line in md_content.splitlines():
        stripped = line.strip()
        if stripped.startswith("```requirements"):
            inside = True
            continue
        if inside and stripped == "```":
            break
        if inside and stripped and not stripped.startswith("#"):
            lines.append(stripped)
    return lines
