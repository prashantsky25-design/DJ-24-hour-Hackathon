import os
import requests
from dotenv import load_dotenv

load_dotenv("D:\\Gandesh\\backend\\orchestrator\\.env")
key = os.getenv("GROQ_API_KEY")
res = requests.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {key}"})
print([m["id"] for m in res.json().get("data", [])])

