import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class AgentMessage(BaseModel):
    id: str
    session_id: str
    agent_name: str
    agent_role: str
    message_type: str  # e.g., 'decision', 'critique', 'approval', 'lesson', 'research'
    content: str
    confidence: float = 1.0
    reply_to: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

class Blackboard:
    """Shared state and message log for agents in a session."""
    def __init__(self):
        # Maps session_id to list of messages
        self._messages: Dict[str, List[AgentMessage]] = {}
        # Maps session_id to arbitrary shared state (e.g., current draft, collected facts)
        self._state: Dict[str, Dict[str, Any]] = {}
        
        # Callback for broadcasting to frontend
        self.broadcast_callback = None

    def set_broadcast_callback(self, callback):
        self.broadcast_callback = callback

    def initialize_session(self, session_id: str):
        if session_id not in self._messages:
            self._messages[session_id] = []
            self._state[session_id] = {}

    async def post_message(self, message: AgentMessage):
        self.initialize_session(message.session_id)
        self._messages[message.session_id].append(message)
        
        print(f"[{message.agent_name} | {message.message_type}] {message.content[:100]}...")
        
        if self.broadcast_callback:
            await self.broadcast_callback(
                message.session_id, 
                "agent_discussion", 
                message.model_dump()
            )

    def get_messages(self, session_id: str) -> List[AgentMessage]:
        return self._messages.get(session_id, [])
        
    def get_state(self, session_id: str) -> Dict[str, Any]:
        return self._state.get(session_id, {})
        
    def update_state(self, session_id: str, key: str, value: Any):
        self.initialize_session(session_id)
        self._state[session_id][key] = value

# Global singleton
blackboard = Blackboard()

