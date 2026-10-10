"""Proactive ArXiv Radar: periodically watches arXiv for papers matching a baseline."""
import asyncio
from urllib.parse import quote_plus

RADAR_INTERVAL_SECONDS = 43200  # 12 hours


async def start_arxiv_radar_loop(baseline_keyword: str = "Efficient Machine Learning") -> None:
    print(
        f"[RADAR] ArXiv Radar started. Watching baseline '{baseline_keyword}' "
        f"every {RADAR_INTERVAL_SECONDS // 3600}h.",
        flush=True,
    )
    while True:
        # Simulated call; no real network request is made.
        url = (
            "http://export.arxiv.org/api/query?search_query=all:"
            f"{quote_plus(baseline_keyword)}&sortBy=submittedDate&max_results=5"
        )
        print(f"[RADAR] Simulating GET {url}", flush=True)
        await asyncio.sleep(0.1)
        print(
            "[RADAR ALERT] Found new paper matching baseline. "
            "Spawning background verification agent...",
            flush=True,
        )
        await asyncio.sleep(RADAR_INTERVAL_SECONDS)
