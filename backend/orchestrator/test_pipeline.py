import asyncio
import json
import uuid
from httpx import AsyncClient

async def run():
    async with AsyncClient(timeout=60.0) as client:
        # Start the pipeline
        payload = {
            "research_brief": "Create a report of AQI during diwali in Delhi with charts",
            "paper_url": None,
            "target_conference": "NeurIPS"
        }
        res = await client.post("http://localhost:8000/api/orchestrate", json=payload)
        session_id = res.json()["session_id"]
        print(f"Started session {session_id}")
        
        # Wait for completion
        while True:
            await asyncio.sleep(2)
            status_res = await client.get(f"http://localhost:8000/api/status/{session_id}")
            status = status_res.json()["status"]
            print(f"Status: {status}")
            if status in ["completed", "error"]:
                break
                
        # Fetch report
        report_res = await client.get(f"http://localhost:8000/api/session/{session_id}/report")
        print("\n=== FINAL REPORT ===")
        print(json.dumps(report_res.json(), indent=2))

if __name__ == "__main__":
    asyncio.run(run())

