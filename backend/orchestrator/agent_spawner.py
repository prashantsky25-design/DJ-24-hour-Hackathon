"""Dynamic agent spawner and in-memory session/state manager for ARES."""
import asyncio
import time
from typing import Any, Dict, List, Optional

from task_parser import DecomposedPlan
from verifier import verify_hypothesis_novelty

# Simulated per-task execution time (seconds). Replace with real agent/sandbox calls later.
SIMULATED_TASK_SECONDS = 2.0


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
        session["logs"].append({"timestamp": time.time(), "message": message})

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

        session["current_task_index"] = index
        session["active_agent"] = task["agent_assigned"]
        task["status"] = "running"

        try:
            prompt = AgentRegistry.get_prompt(task["agent_assigned"], task["task_name"])
        except ValueError as exc:
            task["status"] = "failed"
            session["status"] = "stopped"
            session_store.log(session_id, f"{task['id']} failed: {exc}")
            return

        if AgentRegistry.is_code_task(task["agent_assigned"]):
            # Payload contract expected by Member 2 (Sandbox).
            payload = {
                "session_id": session_id,
                "script_name": "train.py",
                "action": "execute",
                "prompt": prompt,
            }
            session_store.log(
                session_id,
                f"{task['id']}: sandbox payload prepared for {payload['script_name']} "
                f"(action={payload['action']}).",
            )
        else:
            session_store.log(session_id, f"{task['id']}: drafting prompt prepared.")

        session_store.log(
            session_id, f"{task['id']} ({task['agent_assigned']}): simulated execution started."
        )
        await asyncio.sleep(SIMULATED_TASK_SECONDS)

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
