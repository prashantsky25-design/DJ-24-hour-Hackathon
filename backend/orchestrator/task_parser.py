"""Task decomposition for the ARES Meta-Controller."""
import os
from typing import List, Optional

from pydantic import BaseModel, Field


class TaskNode(BaseModel):
    id: str
    task_name: str
    agent_assigned: str  # e.g. "Coding", "Debugging", "Drafter"
    status: str = "pending"
    dependencies: List[str] = Field(default_factory=list)


class DecomposedPlan(BaseModel):
    summary: str
    estimated_runtime_mins: int
    tasks: List[TaskNode]


def _heuristic_plan(brief: str, paper_url: Optional[str]) -> DecomposedPlan:
    source = f"paper at {paper_url}" if paper_url else "referenced baseline paper"
    short = brief.strip().replace("\n", " ")
    if len(short) > 120:
        short = short[:117] + "..."
    tasks = [
        TaskNode(
            id="task_1",
            task_name=f"Paper Ingestion & Baseline Reproduction: ingest {source} and reproduce baseline",
            agent_assigned="Coding",
        ),
        TaskNode(
            id="task_2",
            task_name=f"Code Modification & Hypothesis Implementation: {short}",
            agent_assigned="Coding",
            dependencies=["task_1"],
        ),
        TaskNode(
            id="task_3",
            task_name="Metric Evaluation & Sandbox Verification",
            agent_assigned="Debugging",
            dependencies=["task_2"],
        ),
        TaskNode(
            id="task_4",
            task_name="IEEE/NeurIPS LaTeX Draft Generation",
            agent_assigned="Drafter",
            dependencies=["task_3"],
        ),
    ]
    return DecomposedPlan(
        summary=f"Heuristic 4-stage plan for: {short}",
        estimated_runtime_mins=45,
        tasks=tasks,
    )


def _llm_plan(brief: str, paper_url: Optional[str]) -> DecomposedPlan:
    from langchain_core.prompts import ChatPromptTemplate

    if os.getenv("OPENAI_API_KEY"):
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=os.getenv("ARES_OPENAI_MODEL", "gpt-4o-mini"), temperature=0)
    else:
        from langchain_anthropic import ChatAnthropic

        llm = ChatAnthropic(
            model=os.getenv("ARES_ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"), temperature=0
        )

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are the ARES Meta-Controller. Break the research hypothesis into ordered "
                "experimental steps. Use ids task_1, task_2, ... in order; dependencies list "
                "earlier task ids. agent_assigned must be one of: Coding, Debugging, Drafter. "
                "All statuses are 'pending'. The final task must be LaTeX draft generation "
                "assigned to Drafter.",
            ),
            ("human", "Research brief: {brief}\nPaper URL: {paper_url}"),
        ]
    )
    chain = prompt | llm.with_structured_output(DecomposedPlan)
    return chain.invoke({"brief": brief, "paper_url": paper_url or "none provided"})


def decompose_research_brief(brief: str, paper_url: Optional[str] = None) -> DecomposedPlan:
    if os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY"):
        try:
            return _llm_plan(brief, paper_url)
        except Exception:
            # Fall back so the API stays available if the LLM call fails.
            pass
    return _heuristic_plan(brief, paper_url)
