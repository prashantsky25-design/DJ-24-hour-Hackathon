import asyncio
from typing import Dict, Any
from agents import PlannerAgent, ResearcherAgent, CriticAgent, DrafterAgent
from blackboard import blackboard, AgentMessage

async def run_review_loop(session_id: str, query: str) -> Dict[str, Any]:
    # Instantiate agents
    planner = PlannerAgent()
    researcher = ResearcherAgent()
    critic = CriticAgent()
    drafter = DrafterAgent()

    # Phase 1: Planning
    plan = await planner.act(session_id, query)
    
    # Phase 2: Research with Review Loop
    max_rounds = 2
    research_approved = False
    current_research = ""
    feedback = ""
    
    for round_num in range(max_rounds):
        await blackboard.post_message(
            AgentMessage(
                id="sys", session_id=session_id, agent_name="System", agent_role="System", 
                message_type="info", content=f"Starting Research Round {round_num + 1}/{max_rounds}"
            )
        )
        
        context = f"Query: {query}\nPlan: {plan}\nFeedback from previous round: {feedback}"
        current_research = await researcher.act(session_id, context)
        
        # Critic reviews the research
        approved, feedback, score = await critic.review(session_id, current_research, context)
        
        if approved:
            research_approved = True
            break
            
    if not research_approved:
        await blackboard.post_message(
            AgentMessage(
                id="sys", session_id=session_id, agent_name="System", agent_role="System", 
                message_type="warning", content="Research phase hit max rounds without approval. Proceeding anyway."
            )
        )

    # Phase 3: Drafting with Review Loop
    draft_approved = False
    current_draft = ""
    draft_feedback = ""
    
    for round_num in range(max_rounds):
        await blackboard.post_message(
            AgentMessage(
                id="sys", session_id=session_id, agent_name="System", agent_role="System", 
                message_type="info", content=f"Starting Drafting Round {round_num + 1}/{max_rounds}"
            )
        )
        
        current_draft = await drafter.act(session_id, current_research, draft_feedback)
        
        # Critic reviews the draft
        draft_context = f"Goal: Write an IEEE report based on this research: {current_research}"
        approved, draft_feedback, score = await critic.review(session_id, current_draft, draft_context)
        
        if approved:
            draft_approved = True
            break

    if not draft_approved:
        await blackboard.post_message(
            AgentMessage(
                id="sys", session_id=session_id, agent_name="System", agent_role="System", 
                message_type="warning", content="Drafting phase hit max rounds without approval. Using best effort."
            )
        )
        
    await blackboard.post_message(
        AgentMessage(
            id="sys", session_id=session_id, agent_name="System", agent_role="System", 
            message_type="success", content="Collaborative multi-agent pipeline completed."
        )
    )
    
    # Store final result in state
    blackboard.update_state(session_id, "final_draft", current_draft)
    
    return {"status": "success", "draft": current_draft}

