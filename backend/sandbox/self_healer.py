"""
self_healer.py — Self-Healing Loop with LLM Debugging Agent
═══════════════════════════════════════════════════════════════════════════════
Primary:  Google Gemini 1.5 Flash  (fast, free via AI Studio)
Fallback: Groq / Llama-3.3-70B     (if Gemini key not set)

Flow per attempt:
  1. Call GitGatedRunner.execute(code_patch)
  2. If SUCCESS → return immediately
  3. If FAILED/REGRESSED → extract error trace from stderr
  4. Send (broken_code + traceback) to Gemini / Groq Debugging Agent
  5. Agent returns a corrected train.py
  6. Repeat up to MAX_HEAL_ATTEMPTS times
  7. Return a HealingResult with all attempt records for the Logs Saver
═══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import structlog

from config import settings
from git_gated_runner import GateOutcome, GatedRunResult, GitGatedRunner
from models import HealAttempt, HealAttemptStatus

log = structlog.get_logger(__name__)

# ── Debugging Agent system prompt ─────────────────────────────────────────────
_SYSTEM_PROMPT = """\
You are ARES Debugging Agent, an expert ML engineer specialising in PyTorch.
Your job is to fix a broken Python training script (train.py) that failed
inside a CPU-only sandbox environment.

Rules:
1. Return ONLY the corrected, complete train.py source code.
2. Do NOT include any explanation, markdown fences, or commentary — raw Python only.
3. Preserve the original model architecture intent as closely as possible.
4. Ensure the script ends by writing metrics_experiment.json in this exact format:
   {"loss": <float>, "accuracy": <float>, "execution_time_s": <float>}
5. The script runs on CPU only — no CUDA, no GPU ops.
6. Fix imports, shape mismatches, and runtime errors; do not redesign the model.
7. Keep the random seed = 42.
"""

_USER_PROMPT_TEMPLATE = """\
The following train.py failed in a sandboxed execution environment.

━━━━━━━━━━━━━━━━━━━━━ STDERR / TRACEBACK ━━━━━━━━━━━━━━━━━━━━━
{stderr}

━━━━━━━━━━━━━━━━━━━━━ CURRENT train.py ━━━━━━━━━━━━━━━━━━━━━━━
{code}

━━━━━━━━━━━━━━━━━━━━━ PREVIOUS ATTEMPTS ━━━━━━━━━━━━━━━━━━━━━━
{attempt_history}

Return the corrected train.py now (raw Python, no markdown):
"""


# ── Result dataclass ──────────────────────────────────────────────────────────

class HealingOutcome(str, Enum):
    HEALED  = "HEALED"
    SUCCESS = "SUCCESS"
    FAILED  = "FAILED"


@dataclass
class HealingResult:
    outcome:          HealingOutcome
    final_run:        Optional[GatedRunResult] = None
    heal_attempts:    list[HealAttempt]        = field(default_factory=list)
    total_time_s:     float                    = 0.0
    final_code:       str                      = ""

    @property
    def succeeded(self) -> bool:
        return self.outcome in (HealingOutcome.SUCCESS, HealingOutcome.HEALED)


# ── LLM backend factory ───────────────────────────────────────────────────────

def _make_llm_backend():
    """
    Returns (backend_name, ask_fn) where ask_fn is an async callable:
        ask_fn(broken_code, stderr, attempt_history) -> str
    Prefers Gemini; falls back to Groq if GEMINI_API_KEY is not set.
    """
    if settings.gemini_api_key:
        return "gemini", _ask_gemini
    if settings.groq_api_key:
        return "groq", _ask_groq
    raise RuntimeError(
        "No LLM API key configured. Set GEMINI_API_KEY or GROQ_API_KEY in .env"
    )


async def _ask_gemini(broken_code: str, stderr: str, attempt_history: str) -> str:
    """Call Google Gemini via the new google-genai SDK (supports AQ. auth keys)."""
    try:
        from google import genai                          # new SDK: pip install google-genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)

        user_msg = _USER_PROMPT_TEMPLATE.format(
            stderr=stderr[-3000:],
            code=broken_code,
            attempt_history=attempt_history or "No previous attempts.",
        )

        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=user_msg,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.2,
                max_output_tokens=4096,
            ),
        )
        raw = response.text or ""
        return _strip_markdown_fences(raw).strip()

    except Exception as exc:
        log.exception("self_healer.gemini_error", error=str(exc))
        return ""


async def _ask_groq(broken_code: str, stderr: str, attempt_history: str) -> str:
    """Call Groq / Llama-3.3-70B (fallback)."""
    try:
        from groq import AsyncGroq  # lazy import

        client = AsyncGroq(api_key=settings.groq_api_key)
        user_msg = _USER_PROMPT_TEMPLATE.format(
            stderr=stderr[-3000:],
            code=broken_code,
            attempt_history=attempt_history or "No previous attempts.",
        )
        response = await client.chat.completions.create(
            model=settings.debugger_model,
            temperature=0.2,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_msg},
            ],
        )
        raw = response.choices[0].message.content or ""
        return _strip_markdown_fences(raw).strip()

    except Exception as exc:
        log.exception("self_healer.groq_error", error=str(exc))
        return ""


# ── SelfHealer ────────────────────────────────────────────────────────────────

class SelfHealer:
    """
    Runs the experiment with automatic LLM-assisted debugging on failure.

    Usage:
        healer = SelfHealer()
        result = await healer.run(experiment_id="exp_001", code_patch="...")
    """

    def __init__(self) -> None:
        self._backend_name, self._ask_fn = _make_llm_backend()
        self._runner = GitGatedRunner()
        log.info("self_healer.init", backend=self._backend_name)

    async def run(
        self,
        experiment_id:   str,
        code_patch:      str,
        timeout_seconds: int = settings.sandbox_timeout_seconds,
    ) -> HealingResult:
        t_start       = time.monotonic()
        current_code  = code_patch
        heal_attempts: list[HealAttempt] = []

        log.info("self_healer.start", experiment_id=experiment_id,
                 backend=self._backend_name,
                 max_attempts=settings.max_heal_attempts)

        for attempt_num in range(settings.max_heal_attempts + 1):
            is_initial = (attempt_num == 0)
            label      = "initial" if is_initial else f"heal-{attempt_num}"

            log.info("self_healer.attempt", experiment_id=experiment_id, attempt=label)

            gated_result: GatedRunResult = await self._runner.execute(
                experiment_id   = f"{experiment_id}_attempt_{attempt_num}",
                code_patch      = current_code,
                timeout_seconds = timeout_seconds,
            )

            if gated_result.outcome == GateOutcome.SUCCESS and is_initial:
                log.info("self_healer.clean_success", experiment_id=experiment_id)
                return HealingResult(
                    outcome      = HealingOutcome.SUCCESS,
                    final_run    = gated_result,
                    heal_attempts= [],
                    total_time_s = time.monotonic() - t_start,
                    final_code   = current_code,
                )

            if gated_result.outcome == GateOutcome.SUCCESS and not is_initial:
                log.info("self_healer.healed", experiment_id=experiment_id,
                         attempt=attempt_num)
                heal_attempts.append(HealAttempt(
                    attempt_number = attempt_num,
                    error_summary  = "N/A — previous error was fixed",
                    patch_applied  = current_code,
                    status         = HealAttemptStatus.FIXED,
                    stdout         = gated_result.stdout,
                    stderr         = gated_result.stderr,
                ))
                return HealingResult(
                    outcome      = HealingOutcome.HEALED,
                    final_run    = gated_result,
                    heal_attempts= heal_attempts,
                    total_time_s = time.monotonic() - t_start,
                    final_code   = current_code,
                )

            if attempt_num >= settings.max_heal_attempts:
                log.error("self_healer.exhausted", experiment_id=experiment_id,
                          attempts=attempt_num)
                heal_attempts.append(HealAttempt(
                    attempt_number = attempt_num,
                    error_summary  = _summarise_error(gated_result.stderr),
                    patch_applied  = current_code,
                    status         = HealAttemptStatus.FAILED,
                    stdout         = gated_result.stdout,
                    stderr         = gated_result.stderr,
                ))
                return HealingResult(
                    outcome      = HealingOutcome.FAILED,
                    final_run    = gated_result,
                    heal_attempts= heal_attempts,
                    total_time_s = time.monotonic() - t_start,
                    final_code   = current_code,
                )

            error_summary = _summarise_error(gated_result.stderr)
            log.info("self_healer.invoking_llm", experiment_id=experiment_id,
                     backend=self._backend_name, attempt=attempt_num,
                     error=error_summary[:120])

            fixed_code = await self._ask_fn(
                broken_code     = current_code,
                stderr          = gated_result.stderr,
                attempt_history = _format_attempt_history(heal_attempts),
            )

            heal_attempts.append(HealAttempt(
                attempt_number = attempt_num,
                error_summary  = error_summary,
                patch_applied  = current_code,
                status         = HealAttemptStatus.FAILED,
                stdout         = gated_result.stdout,
                stderr         = gated_result.stderr,
            ))

            if not fixed_code:
                log.warning("self_healer.llm_returned_empty",
                            experiment_id=experiment_id)
                continue

            log.info("self_healer.patch_received", experiment_id=experiment_id,
                     patch_lines=fixed_code.count("\n"))
            current_code = fixed_code

        return HealingResult(
            outcome      = HealingOutcome.FAILED,
            total_time_s = time.monotonic() - t_start,
            final_code   = current_code,
        )


# ── Utility helpers ───────────────────────────────────────────────────────────

def _summarise_error(stderr: str) -> str:
    if not stderr:
        return "Unknown error (empty stderr)"
    error_lines = [
        line.strip() for line in stderr.splitlines()
        if re.search(r"(Error|Exception|Traceback|assert)", line, re.I)
    ]
    if error_lines:
        return error_lines[-1][:300]
    nonempty = [l.strip() for l in stderr.splitlines() if l.strip()]
    return nonempty[-1][:300] if nonempty else "Unknown error"


def _format_attempt_history(attempts: list[HealAttempt]) -> str:
    if not attempts:
        return ""
    return "\n".join(
        f"Attempt {a.attempt_number}: {a.status.value} — {a.error_summary}"
        for a in attempts
    )


def _strip_markdown_fences(text: str) -> str:
    text = re.sub(r"^```(?:python)?\s*\n", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"\n```\s*$", "", text.strip(), flags=re.MULTILINE)
    return text


log = structlog.get_logger(__name__)

# ── Debugging Agent system prompt ─────────────────────────────────────────────
_SYSTEM_PROMPT = """\
You are ARES Debugging Agent, an expert ML engineer specialising in PyTorch.
Your job is to fix a broken Python training script (train.py) that failed
inside a CPU-only sandbox environment.

Rules:
1. Return ONLY the corrected, complete train.py source code.
2. Do NOT include any explanation, markdown fences, or commentary — raw Python only.
3. Preserve the original model architecture intent as closely as possible.
4. Ensure the script ends by writing metrics_experiment.json in this exact format:
   {"loss": <float>, "accuracy": <float>, "execution_time_s": <float>}
5. The script runs on CPU only — no CUDA, no GPU ops.
6. Fix imports, shape mismatches, and runtime errors; do not redesign the model.
7. Keep the random seed = 42.
"""

_USER_PROMPT_TEMPLATE = """\
The following train.py failed in a sandboxed execution environment.

━━━━━━━━━━━━━━━━━━━━━ STDERR / TRACEBACK ━━━━━━━━━━━━━━━━━━━━━
{stderr}

━━━━━━━━━━━━━━━━━━━━━ CURRENT train.py ━━━━━━━━━━━━━━━━━━━━━━━
{code}

━━━━━━━━━━━━━━━━━━━━━ PREVIOUS ATTEMPTS ━━━━━━━━━━━━━━━━━━━━━━
{attempt_history}

Return the corrected train.py now (raw Python, no markdown):
"""


# ── Result dataclass ──────────────────────────────────────────────────────────

class HealingOutcome(str, Enum):
    HEALED  = "HEALED"   # self-healing succeeded within attempt budget
    SUCCESS = "SUCCESS"  # first run succeeded — no healing needed
    FAILED  = "FAILED"   # exhausted all attempts without success


@dataclass
class HealingResult:
    outcome:          HealingOutcome
    final_run:        Optional[GatedRunResult] = None
    heal_attempts:    list[HealAttempt]        = field(default_factory=list)
    total_time_s:     float                    = 0.0
    final_code:       str                      = ""

    @property
    def succeeded(self) -> bool:
        return self.outcome in (HealingOutcome.SUCCESS, HealingOutcome.HEALED)


# ── SelfHealer ────────────────────────────────────────────────────────────────

class SelfHealer:
    """
    Runs the experiment with automatic LLM-assisted debugging on failure.

    Usage (called from main.py / API layer):

        healer = SelfHealer()
        result = await healer.run(experiment_id="exp_001", code_patch="...")
    """

    def __init__(self) -> None:
        self._llm    = AsyncGroq(api_key=settings.groq_api_key)
        self._runner = GitGatedRunner()

    async def run(
        self,
        experiment_id:   str,
        code_patch:      str,
        timeout_seconds: int = settings.sandbox_timeout_seconds,
    ) -> HealingResult:
        """
        Execute with self-healing. Returns a HealingResult containing
        all attempt records for the Logs Saver.
        """
        t_start       = time.monotonic()
        current_code  = code_patch
        heal_attempts: list[HealAttempt] = []

        log.info("self_healer.start", experiment_id=experiment_id,
                 max_attempts=settings.max_heal_attempts)

        for attempt_num in range(settings.max_heal_attempts + 1):
            is_initial = (attempt_num == 0)
            label      = "initial" if is_initial else f"heal-{attempt_num}"

            log.info("self_healer.attempt", experiment_id=experiment_id,
                     attempt=label)

            # ── Execute in sandbox ────────────────────────────────────────────
            gated_result: GatedRunResult = await self._runner.execute(
                experiment_id   = f"{experiment_id}_attempt_{attempt_num}",
                code_patch      = current_code,
                timeout_seconds = timeout_seconds,
            )

            # ── First run succeeded immediately ───────────────────────────────
            if gated_result.outcome == GateOutcome.SUCCESS and is_initial:
                log.info("self_healer.clean_success", experiment_id=experiment_id)
                return HealingResult(
                    outcome      = HealingOutcome.SUCCESS,
                    final_run    = gated_result,
                    heal_attempts= [],
                    total_time_s = time.monotonic() - t_start,
                    final_code   = current_code,
                )

            # ── Healed run succeeded ──────────────────────────────────────────
            if gated_result.outcome == GateOutcome.SUCCESS and not is_initial:
                log.info("self_healer.healed", experiment_id=experiment_id,
                         attempt=attempt_num)
                # Record the successful heal attempt
                heal_attempts.append(HealAttempt(
                    attempt_number = attempt_num,
                    error_summary  = "N/A — previous error was fixed",
                    patch_applied  = current_code,
                    status         = HealAttemptStatus.FIXED,
                    stdout         = gated_result.stdout,
                    stderr         = gated_result.stderr,
                ))
                return HealingResult(
                    outcome      = HealingOutcome.HEALED,
                    final_run    = gated_result,
                    heal_attempts= heal_attempts,
                    total_time_s = time.monotonic() - t_start,
                    final_code   = current_code,
                )

            # ── Exhausted all attempts ────────────────────────────────────────
            if attempt_num >= settings.max_heal_attempts:
                log.error("self_healer.exhausted", experiment_id=experiment_id,
                          attempts=attempt_num)
                heal_attempts.append(HealAttempt(
                    attempt_number = attempt_num,
                    error_summary  = _summarise_error(gated_result.stderr),
                    patch_applied  = current_code,
                    status         = HealAttemptStatus.FAILED,
                    stdout         = gated_result.stdout,
                    stderr         = gated_result.stderr,
                ))
                return HealingResult(
                    outcome      = HealingOutcome.FAILED,
                    final_run    = gated_result,
                    heal_attempts= heal_attempts,
                    total_time_s = time.monotonic() - t_start,
                    final_code   = current_code,
                )

            # ── Call LLM Debugging Agent to generate a fix ────────────────────
            error_summary = _summarise_error(gated_result.stderr)
            log.info("self_healer.invoking_llm", experiment_id=experiment_id,
                     attempt=attempt_num, error=error_summary[:120])

            attempt_history_str = _format_attempt_history(heal_attempts)
            fixed_code = await self._ask_debugger(
                broken_code     = current_code,
                stderr          = gated_result.stderr,
                attempt_history = attempt_history_str,
            )

            # Record this failed attempt before moving to the next
            heal_attempts.append(HealAttempt(
                attempt_number = attempt_num,
                error_summary  = error_summary,
                patch_applied  = current_code,
                status         = HealAttemptStatus.FAILED,
                stdout         = gated_result.stdout,
                stderr         = gated_result.stderr,
            ))

            if not fixed_code:
                log.warning("self_healer.llm_returned_empty",
                            experiment_id=experiment_id)
                # Keep the same code and let the loop exhaust naturally
                continue

            log.info("self_healer.patch_received", experiment_id=experiment_id,
                     patch_lines=fixed_code.count("\n"))
            current_code = fixed_code

        # Should not reach here, but guard anyway
        return HealingResult(
            outcome      = HealingOutcome.FAILED,
            total_time_s = time.monotonic() - t_start,
            final_code   = current_code,
        )

    # ── LLM Debugging Agent ───────────────────────────────────────────────────

    async def _ask_debugger(
        self,
        broken_code:     str,
        stderr:          str,
        attempt_history: str,
    ) -> str:
        """
        Send the broken code + traceback to the LLM and get back a fixed
        train.py. Returns empty string on any LLM/network error.
        """
        user_msg = _USER_PROMPT_TEMPLATE.format(
            stderr          = stderr[-3000:],   # cap to avoid token overflow
            code            = broken_code,
            attempt_history = attempt_history or "No previous attempts.",
        )

        try:
            response = await self._llm.chat.completions.create(
                model       = settings.debugger_model,
                temperature = 0.2,   # low temperature → deterministic fixes
                max_tokens  = 4096,
                messages    = [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
            )
            raw = response.choices[0].message.content or ""
            # Strip any accidental markdown fences the model might emit
            return _strip_markdown_fences(raw).strip()

        except Exception as exc:
            log.exception("self_healer.llm_error", error=str(exc))
            return ""


# ── Utility helpers ───────────────────────────────────────────────────────────

def _summarise_error(stderr: str) -> str:
    """
    Extract the most useful single line from a Python traceback.
    Prefers the last 'Error:' line; falls back to the last non-empty line.
    """
    if not stderr:
        return "Unknown error (empty stderr)"

    # Find the last line matching a Python exception pattern
    error_lines = [
        line.strip() for line in stderr.splitlines()
        if re.search(r"(Error|Exception|Traceback|assert)", line, re.I)
    ]
    if error_lines:
        return error_lines[-1][:300]

    # Fallback: last non-empty line
    nonempty = [l.strip() for l in stderr.splitlines() if l.strip()]
    return nonempty[-1][:300] if nonempty else "Unknown error"


def _format_attempt_history(attempts: list[HealAttempt]) -> str:
    """Format past attempts into a concise string for the LLM prompt."""
    if not attempts:
        return ""
    lines = []
    for a in attempts:
        lines.append(
            f"Attempt {a.attempt_number}: {a.status.value} — {a.error_summary}"
        )
    return "\n".join(lines)


def _strip_markdown_fences(text: str) -> str:
    """Remove ```python ... ``` or ``` ... ``` wrappers if the LLM adds them."""
    text = re.sub(r"^```(?:python)?\s*\n", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"\n```\s*$", "", text.strip(), flags=re.MULTILINE)
    return text
