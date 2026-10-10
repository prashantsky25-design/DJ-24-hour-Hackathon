"""ARES Member 1: Meta-Controller (orchestrator) API contract."""
import asyncio
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent_spawner import execute_task_pipeline, session_store
from radar import start_arxiv_radar_loop
from task_parser import decompose_research_brief


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        """Send message to all clients subscribed to this session."""
        if session_id not in self.active_connections:
            return
        disconnected = []
        for connection in self.active_connections[session_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn, session_id)


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    radar_task = None
    if os.getenv("ENABLE_ARXIV_RADAR", "false").lower() == "true":
        radar_task = asyncio.create_task(start_arxiv_radar_loop())
    yield
    if radar_task:
        radar_task.cancel()


app = FastAPI(title="ARES Orchestrator", lifespan=lifespan)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production: specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OrchestrateRequest(BaseModel):
    research_brief: str
    paper_url: Optional[str] = None


class StopRequest(BaseModel):
    session_id: str


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ARES Orchestrator"}


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


@app.get("/api/logs/{session_id}")
def get_logs(session_id: str):
    """Get full session state including logs."""
    session = session_store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket stream for real-time session updates.
    Frontend connects to ws://localhost:8000/ws/{session_id}
    """
    await manager.connect(websocket, session_id)
    try:
        # Send initial session state
        session = session_store.get(session_id)
        if session:
            await websocket.send_json({
                "type": "session_state",
                "payload": {
                    "status": session["status"],
                    "active_agent": session["active_agent"],
                    "current_task_index": session["current_task_index"],
                    "task_nodes": session["task_nodes"],
                }
            })
        
        # Keep connection alive and handle client messages
        while True:
            data = await websocket.receive_text()
            # Echo back for heartbeat (frontend can send ping)
            if data == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)


# Helper to broadcast session updates (called from agent_spawner)
async def broadcast_session_update(session_id: str, event_type: str, payload: dict):
    """Broadcast event to all WebSocket clients subscribed to this session."""
    await manager.broadcast(session_id, {
        "type": event_type,
        "timestamp": asyncio.get_event_loop().time(),
        "payload": payload
    })


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
