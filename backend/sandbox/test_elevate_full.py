import httpx
import asyncio
import json

async def test_elevate():
    api_key = "elev_hHd0YJTMMHQki9haDG5wiCZk57v_l8r40z1D0AN96vw"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    query = "Report on increasing population in mumbai"
    intent = "experiment"
    prompt = f"""You are an expert AI research scientist drafting a structured technical report.
The user's query was: "{query}"
The intent classification is: "{intent}"
Attached documents: None

Draft a highly professional, accurate, and relevant report based on the query. If the query is about "longitude and latitude", the report should be about geography and coordinates, NOT machine learning. If the query is about ML, it should be about ML.
Crucially, ensure you generate `visualData` based on real, accurate, and relevant statistical data (e.g., actual world AQI measurements, real metrics) to provide an authentic data visualization.

Respond ONLY with a valid JSON object matching this schema exactly (no markdown formatting, no comments):
{{
  "title": "A concise title",
  "executiveSummary": "1-2 paragraphs summarizing the findings.",
  "methodology": "How the research was conducted.",
  "findings": ["finding 1", "finding 2", "finding 3"],
  "comparisons": [
    {{"baseline": "Baseline value", "proposed": "Proposed value", "delta": "Difference"}}
  ],
  "limitations": "A paragraph on limitations of this research.",
  "visualData": {{
    "title": "Chart Title",
    "type": "bar or pie",
    "data": [
      {{"name": "Label 1", "value": 10}},
      {{"name": "Label 2", "value": 20}}
    ]
  }}
}}
"""
    body = {
        "model": "gpt-5-mini",
        "max_completion_tokens": 4000,
        "messages": [
            {"role": "system", "content": "You are a helpful JSON-producing assistant."},
            {"role": "user", "content": prompt}
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
