import os
import json
import uuid
from typing import Optional, Dict, Any, List
from blackboard import blackboard, AgentMessage
from dotenv import load_dotenv

load_dotenv()

# Initialize async Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
aclient = None
if GROQ_API_KEY:
    from groq import AsyncGroq
    aclient = AsyncGroq(api_key=GROQ_API_KEY)

class BaseAgent:
    def __init__(self, name: str, role: str, system_prompt: str):
        self.name = name
        self.role = role
        self.system_prompt = system_prompt

    async def _call_llm(self, prompt: str, require_json: bool = False) -> str:
        if not aclient:
            raise Exception("GROQ_API_KEY not found. Cannot call LLM.")
            
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        if require_json:
            # Tell the model we want JSON
            messages[0]["content"] += "\nRespond ONLY with a valid JSON object. No markdown formatting, no comments."

        response = await aclient.chat.completions.create(
            model="qwen/qwen3.8-27b",  # Fast and reliable model for agents
            messages=messages,
            temperature=0.3,
            max_tokens=4000
        )
        
        result_text = response.choices[0].message.content
        
        # Clean markdown blocks if JSON was requested
        if require_json:
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()
            
        return result_text

    async def act(self, session_id: str, task_context: str) -> str:
        """Core action performed by the agent. Override in subclasses."""
        pass

    async def post_to_blackboard(self, session_id: str, message_type: str, content: str, reply_to: Optional[str] = None) -> str:
        msg_id = str(uuid.uuid4())
        msg = AgentMessage(
            id=msg_id,
            session_id=session_id,
            agent_name=self.name,
            agent_role=self.role,
            message_type=message_type,
            content=content,
            reply_to=reply_to
        )
        await blackboard.post_message(msg)
        return msg_id

