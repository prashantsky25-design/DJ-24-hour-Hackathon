"""Dynamic agent spawner and in-memory session/state manager for ARES."""
import asyncio
import os
import time
from typing import Any, Dict, List, Optional

import httpx

from paper_reader import read_paper
from task_parser import DecomposedPlan
from verifier import verify_hypothesis_novelty

# Sandbox API endpoint (Module 2)
SANDBOX_API_URL = os.getenv("SANDBOX_API_URL", "http://localhost:8001/api/sandbox/execute")
SANDBOX_TIMEOUT = 600  # 10 minutes max per sandbox run


class AgentRegistry:
    """Maps a task's `agent_assigned` value to a tailored system prompt."""

    AGENTS: Dict[str, Dict[str, str]] = {
        "Coding": {
            "name": "CodingAgent",
            "system_prompt": (
                "You are CodingAgent, an expert PyTorch research engineer. Implement the "
                "requested hypothesis by modifying ONLY `train.py`. Keep the 3-file contract "
                "intact: do not create, rename, or edit any other file. Output the complete "
                "updated `train.py`, and log metrics in the format the sandbox expects."
            ),
        },
        "Debugging": {
            "name": "DebuggingAgent",
            "system_prompt": (
                "You are DebuggingAgent. Read the Python traceback and `stderr` from the "
                "sandbox run, identify the root cause, and formulate a minimal, targeted patch "
                "to `train.py`. Explain the fix briefly, then output the patched code. Do not "
                "refactor unrelated code."
            ),
        },
        "Drafter": {
            "name": "DrafterAgent",
            "system_prompt": (
                "You are DrafterAgent, a scientific writer. Convert the experimental metrics, "
                "loss curves, and architectural notes into a complete LaTeX manuscript in "
                "IEEE/NeurIPS format (abstract, method, experiments, results, conclusion). "
                "Only report numbers present in the provided results."
            ),
        },
    }

    # Agents whose tasks are run in the sandbox (Member 2) against train.py.
    CODE_AGENTS = {"Coding", "Debugging"}

    @classmethod
    def get_prompt(cls, agent_assigned: str, task_name: str, context: str = "") -> str:
        agent = cls.AGENTS.get(agent_assigned)
        if agent is None:
            raise ValueError(f"Unknown agent type: {agent_assigned}")
        prompt = f"{agent['system_prompt']}\n\nTask: {task_name}"
        if context:
            prompt += f"\n\nContext: {context}"
        return prompt

    @classmethod
    def is_code_task(cls, agent_assigned: str) -> bool:
        return agent_assigned in cls.CODE_AGENTS


class SessionStore:
    """In-memory session state. Not persistent; single-process only."""

    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def create(
        self, session_id: str, plan: DecomposedPlan, research_brief: str = ""
    ) -> Dict[str, Any]:
        session = {
            "session_id": session_id,
            "status": "planning",
            "current_task_index": 0,
            "research_brief": research_brief,
            "verification": None,
            "plan_summary": plan.summary,
            "task_nodes": [t.model_dump() for t in plan.tasks],
            "active_agent": "Dynamic Spawner",
            "logs": [],
            "stop_requested": False,
        }
        self._sessions[session_id] = session
        self.log(session_id, f"Session created with {len(plan.tasks)} tasks.")
        return session

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._sessions.get(session_id)

    def log(self, session_id: str, message: str) -> None:
        session = self._sessions[session_id]
        log_entry = {"timestamp": time.time(), "message": message}
        session["logs"].append(log_entry)
        # Broadcast to WebSocket clients
        try:
            import asyncio
            from main import broadcast_session_update
            asyncio.create_task(broadcast_session_update(
                session_id,
                "log",
                {"message": message, "timestamp": log_entry["timestamp"]}
            ))
        except Exception:
            pass  # If main not imported yet or no event loop, skip broadcast

    def stop(self, session_id: str) -> Optional[Dict[str, Any]]:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if session["status"] not in ("completed", "stopped"):
            session["stop_requested"] = True
            session["status"] = "stopped"
            self.log(session_id, "Stop signal received (human steering).")
        return session


session_store = SessionStore()


async def execute_task_pipeline(session_id: str) -> None:
    """Run the session's tasks sequentially, honoring stop/pause signals."""
    session = session_store.get(session_id)
    if session is None:
        return

    session["status"] = "running"
    session_store.log(session_id, "Pipeline started.")
    tasks: List[Dict[str, Any]] = session["task_nodes"]

    for index, task in enumerate(tasks):
        # Wait while paused; exit if stopped.
        while session["status"] == "paused":
            await asyncio.sleep(0.2)
        if session["stop_requested"] or session["status"] == "stopped":
            session_store.log(session_id, f"Pipeline stopped before {task['id']}.")
            return

        # Pre-compute verification: runs once, right before the first CodingAgent dispatch.
        if task["agent_assigned"] == "Coding" and session["verification"] is None:
            session["active_agent"] = "Verifier"
            result = await verify_hypothesis_novelty(session["research_brief"])
            session["verification"] = result
            session_store.log(
                session_id, f"Pre-compute verification: is_novel={result['is_novel']}. {result['reason']}"
            )
            if session["stop_requested"] or session["status"] == "stopped":
                session_store.log(session_id, "Pipeline stopped during verification.")
                return
            if not result["is_novel"]:
                saved = result.get("saved_compute_mins", 0)
                session["status"] = "completed_with_warnings"
                session["active_agent"] = "None"
                session["saved_compute_mins"] = saved
                for remaining in tasks[index:]:
                    if remaining["status"] == "pending":
                        remaining["status"] = "skipped"
                session_store.log(
                    session_id,
                    f"Execution halted early: hypothesis not novel. Saved ~{saved} min of sandbox compute.",
                )
                return

        # Paper Reader with Vision: extract architecture if this is the first Coding task
        if task["agent_assigned"] == "Coding" and "paper_info" not in session:
            session["active_agent"] = "Paper Reader (GPT-4o Vision)"
            session_store.log(session_id, "Paper Reader analyzing research document...")
            
            try:
                paper_info = await read_paper(
                    paper_url=session.get("paper_url"),
                    extract_diagrams=True
                )
                session["paper_info"] = paper_info
                session_store.log(
                    session_id,
                    f"Paper Reader extracted: '{paper_info['title']}' — "
                    f"Architecture: {paper_info['architecture'][:80]}..."
                )
                if paper_info.get("diagrams_analyzed"):
                    session_store.log(
                        session_id,
                        f"GPT-4o Vision notes: {paper_info.get('vision_notes', 'N/A')[:120]}..."
                    )
            except Exception as exc:
                session_store.log(session_id, f"Paper Reader error (non-fatal): {exc}")
                session["paper_info"] = {"title": "Fallback baseline", "architecture": "N/A"}

        session["current_task_index"] = index
        session["active_agent"] = task["agent_assigned"]
        task["status"] = "running"
        
        # Broadcast agent state change
        try:
            from main import broadcast_session_update
            await broadcast_session_update(
                session_id,
                "agent_state",
                {
                    "active_agent": task["agent_assigned"],
                    "task_id": task["id"],
                    "task_name": task["task_name"],
                    "status": "running"
                }
            )
        except Exception:
            pass

        try:
            prompt = AgentRegistry.get_prompt(task["agent_assigned"], task["task_name"])
        except ValueError as exc:
            task["status"] = "failed"
            session["status"] = "stopped"
            session_store.log(session_id, f"{task['id']} failed: {exc}")
            return

        if AgentRegistry.is_code_task(task["agent_assigned"]):
            # Call Module 2 sandbox API with the ExecuteRequest contract
            session_store.log(
                session_id, f"{task['id']}: invoking sandbox execution for train.py..."
            )
            
            try:
                sandbox_result = await call_sandbox_api(
                    experiment_id=f"{session_id}_{task['id']}",
                    code_patch=prompt,  # In real flow, this would be the LLM-generated train.py
                    timeout_seconds=300,
                )
                
                task["sandbox_result"] = sandbox_result
                session_store.log(
                    session_id,
                    f"{task['id']}: sandbox returned status={sandbox_result['status']}, "
                    f"loss={sandbox_result['metrics'].get('experiment_loss', 'N/A')}"
                )
                
                # Check if we need self-healing
                if sandbox_result["status"] in ("HEALED", "SUCCESS"):
                    task["status"] = "completed"
                elif sandbox_result["status"] == "FAILURE":
                    task["status"] = "failed"
                    task["error"] = sandbox_result.get("error_message", "Sandbox execution failed")
                else:
                    task["status"] = "partial"
                    
            except Exception as exc:
                task["status"] = "failed"
                task["error"] = str(exc)
                session_store.log(session_id, f"{task['id']} sandbox call failed: {exc}")
                # Don't halt the entire pipeline — let it continue to Drafter
                
        else:
            # Non-code tasks (e.g., Drafter) — simulate for now
            session_store.log(session_id, f"{task['id']}: drafting prompt prepared (simulated).")
            await asyncio.sleep(2.0)

        # A stop may have arrived during execution.
        if session["stop_requested"] or session["status"] == "stopped":
            task["status"] = "stopped"
            session_store.log(session_id, f"{task['id']} interrupted by stop signal.")
            return

        task["status"] = "completed"
        session_store.log(session_id, f"{task['id']} completed.")

    session["current_task_index"] = len(tasks)
    session["active_agent"] = "None"
    session["status"] = "completed"
    session_store.log(session_id, "Pipeline completed.")



# ── Sandbox API Integration ──────────────────────────────────────────────────

async def call_sandbox_api(
    experiment_id: str,
    code_patch: str,
    timeout_seconds: int = 300,
) -> Dict[str, Any]:
    """
    Call Module 2's POST /api/sandbox/execute endpoint.
    
    Returns the ExecuteResponse schema:
    {
        "status": "SUCCESS" | "HEALED" | "FAILURE" | "TIMEOUT",
        "experiment_id": str,
        "stdout": str,
        "stderr": str,
        "metrics": {
            "baseline_loss": float,
            "experiment_loss": float,
            "baseline_accuracy": float,
            "experiment_accuracy": float,
            "execution_time_s": float
        },
        "git_hash": str | null,
        "heal_attempts": [...],
        "error_message": str | null
    }
    """
    payload = {
        "experiment_id": experiment_id,
        "code_patch": code_patch,
        "timeout_seconds": timeout_seconds,
    }
    
    async with httpx.AsyncClient(timeout=SANDBOX_TIMEOUT) as client:
        response = await client.post(SANDBOX_API_URL, json=payload)
        response.raise_for_status()
        return response.json()
