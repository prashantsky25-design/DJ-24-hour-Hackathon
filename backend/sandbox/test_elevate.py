import httpx
import asyncio
import json

async def test_elevate():
    api_key = "elev_hHd0YJTMMHQki9haDG5wiCZk57v_l8r40z1D0AN96vw"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    body = {
        "model": "gpt-5-mini",
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    }
    async with httpx.AsyncClient() as client:
        print("Sending request to Elevate API...")
        resp = await client.post("https://elevate1-0.vercel.app/api/ai", headers=headers, json=body, timeout=30.0)
        print(f"Status Code: {resp.status_code}")
        print("Response Text:")
        print(resp.text)
        try:
            print(f"Parsed JSON: {resp.json()}")
        except Exception as e:
            print(f"Failed to parse JSON: {e}")

asyncio.run(test_elevate())

