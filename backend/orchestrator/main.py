"""ARES Member 1: Meta-Controller (orchestrator) API contract."""
import asyncio
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from agent_spawner import execute_task_pipeline, session_store
from radar import start_arxiv_radar_loop
from task_parser import decompose_research_brief


@asynccontextmanager
async def lifespan(app: FastAPI):
    radar_task = asyncio.create_task(start_arxiv_radar_loop())
    yield
    radar_task.cancel()


app = FastAPI(title="ARES Orchestrator", lifespan=lifespan)


class OrchestrateRequest(BaseModel):
    research_brief: str
    paper_url: Optional[str] = None


class StopRequest(BaseModel):
    session_id: str


@app.post("/api/orchestrate")
def orchestrate(payload: OrchestrateRequest, background_tasks: BackgroundTasks):
    plan = decompose_research_brief(payload.research_brief, payload.paper_url)
    session_id = str(uuid.uuid4())
    session = session_store.create(session_id, plan, payload.research_brief)
    session["status"] = "running"
    background_tasks.add_task(execute_task_pipeline, session_id)
    return {
        "session_id": session_id,
        "status": "running",
        "active_agent": "Dynamic Spawner",
        "task_nodes": session["task_nodes"],
    }


@app.post("/api/stop")
def stop(payload: StopRequest):
    session = session_store.stop(payload.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": payload.session_id,
        "status": session["status"],
        "message": "Execution halted via human steering.",
    }


@app.get("/api/status/{session_id}")
def status(session_id: str):
    session = session_store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "status": session["status"],
        "active_agent": session["active_agent"],
        "current_task_index": session["current_task_index"],
        "plan_summary": session["plan_summary"],
        "task_nodes": session["task_nodes"],
        "logs": session["logs"],
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
