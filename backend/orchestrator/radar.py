"""
Proactive ArXiv Radar: periodically watches arXiv for papers matching user's baseline.

From pitch:
"There's also a proactive ArXiv Radar Agent that checks daily for new papers 
matching your baseline and notifies you if someone published something similar."
"""
import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import quote_plus

import httpx

RADAR_INTERVAL_SECONDS = 43200  # 12 hours (for production; can reduce for demo)
ARXIV_API_URL = "http://export.arxiv.org/api/query"


class ArxivPaper:
    """Represents a paper found on ArXiv."""
    
    def __init__(self, arxiv_id: str, title: str, authors: List[str], abstract: str, published: str):
        self.arxiv_id = arxiv_id
        self.title = title
        self.authors = authors
        self.abstract = abstract
        self.published = published
        
    def __repr__(self):
        return f"ArxivPaper({self.arxiv_id}, '{self.title[:50]}...', {self.published})"


async def search_arxiv(
    query: str,
    max_results: int = 10,
    sortBy: str = "submittedDate",
    sortOrder: str = "descending"
) -> List[ArxivPaper]:
    """
    Query the ArXiv API and parse results.
    
    Args:
        query: Search query (e.g. "cat:cs.LG AND ti:attention")
        max_results: Max papers to return
        sortBy: "relevance", "lastUpdatedDate", or "submittedDate"
        sortOrder: "ascending" or "descending"
        
    Returns:
        List of ArxivPaper objects
    """
    params = {
        "search_query": query,
        "max_results": max_results,
        "sortBy": sortBy,
        "sortOrder": sortOrder,
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(ARXIV_API_URL, params=params)
        response.raise_for_status()
        
        # Parse Atom XML feed
        root = ET.fromstring(response.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        
        papers = []
        for entry in root.findall("atom:entry", ns):
            arxiv_id = entry.find("atom:id", ns).text.split("/abs/")[-1]
            title = entry.find("atom:title", ns).text.strip().replace("\n", " ")
            abstract = entry.find("atom:summary", ns).text.strip().replace("\n", " ")
            published = entry.find("atom:published", ns).text[:10]  # YYYY-MM-DD
            
            authors = [
                author.find("atom:name", ns).text
                for author in entry.findall("atom:author", ns)
            ]
            
            papers.append(ArxivPaper(arxiv_id, title, authors, abstract, published))
        
        return papers


async def check_for_similar_papers(
    baseline_keywords: str,
    last_check_date: Optional[datetime] = None
) -> List[ArxivPaper]:
    """
    Check ArXiv for new papers matching the baseline research area.
    
    Args:
        baseline_keywords: Research domain keywords (e.g. "efficient transformers")
        last_check_date: Only return papers newer than this date
        
    Returns:
        List of potentially relevant new papers
    """
    # Build search query for cs.LG (Machine Learning) or cs.AI
    query = f"cat:cs.LG AND all:{quote_plus(baseline_keywords)}"
    
    papers = await search_arxiv(query, max_results=20)
    
    # Filter by date if last_check_date provided
    if last_check_date:
        cutoff = last_check_date.strftime("%Y-%m-%d")
        papers = [p for p in papers if p.published > cutoff]
    
    return papers


async def start_arxiv_radar_loop(
    baseline_keyword: str = "Efficient Machine Learning",
    on_paper_found_callback=None
) -> None:
    """
    Background cron task that monitors ArXiv for new relevant papers.
    
    Args:
        baseline_keyword: Domain to monitor (e.g. "neural architecture search")
        on_paper_found_callback: Optional async function called when new papers found
                                 Signature: async def callback(papers: List[ArxivPaper])
    """
    print(
        f"[RADAR] ArXiv Radar started. Watching '{baseline_keyword}' "
        f"every {RADAR_INTERVAL_SECONDS // 3600}h.",
        flush=True,
    )
    
    last_check = datetime.utcnow() - timedelta(days=7)  # Initial lookback: 1 week
    
    while True:
        try:
            print(f"[RADAR] Scanning ArXiv for papers since {last_check.date()}...", flush=True)
            
            papers = await check_for_similar_papers(baseline_keyword, last_check)
            
            if papers:
                print(
                    f"[RADAR ALERT] Found {len(papers)} new paper(s) matching baseline:",
                    flush=True
                )
                for p in papers[:3]:  # Show top 3
                    print(f"  - {p.arxiv_id}: {p.title[:70]}... ({p.published})", flush=True)
                
                # Trigger callback if provided (e.g., send email, create GitHub issue, spawn sub-agent)
                if on_paper_found_callback:
                    await on_paper_found_callback(papers)
            else:
                print("[RADAR] No new papers found this cycle.", flush=True)
            
            last_check = datetime.utcnow()
            
        except Exception as exc:
            print(f"[RADAR ERROR] {exc}. Will retry next cycle.", flush=True)
        
        await asyncio.sleep(RADAR_INTERVAL_SECONDS)
