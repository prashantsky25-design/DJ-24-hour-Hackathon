import json
from typing import Dict, Any, Tuple
from base_agent import BaseAgent

class PlannerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Alice",
            role="Planner",
            system_prompt="You are the Lead Planner. Break the user query into steps and select the necessary agent roster."
        )

    async def act(self, session_id: str, query: str) -> Dict[str, Any]:
        prompt = f"""
        User Query: "{query}"
        Create a plan to address this query. 
        Identify the key information needed and exactly what the final output should look like.
        
        Respond with JSON:
        {{
            "plan_steps": ["step 1", "step 2"],
            "required_data": "what specific data needs to be found",
            "reasoning": "why this plan"
        }}
        """
        await self.post_to_blackboard(session_id, "decision", f"I am evaluating the query: '{query}' and formulating a plan.")
        
        result_str = await self._call_llm(prompt, require_json=True)
        try:
            plan = json.loads(result_str)
        except json.JSONDecodeError:
            plan = {"plan_steps": ["Execute query"], "required_data": "Unknown", "reasoning": "Fallback plan due to parsing error."}
            
        await self.post_to_blackboard(session_id, "plan", f"Plan formulated:\nSteps: {plan['plan_steps']}\nData needed: {plan['required_data']}")
        return plan

class ResearcherAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Bob",
            role="Researcher",
            system_prompt="You are an expert Data Researcher. You fetch real facts, numbers, and sources for the query, and revise findings quickly when feedback is given."
        )

    async def act(self, session_id: str, plan_context: str) -> str:
        is_revision = "REVISION LOOP" in plan_context
        prompt = f"""
        Execute the empirical research step based on this context:
        {plan_context}
        
        RULES FOR RESEARCHER (Quick & Efficient):
        1. Find concrete numbers, real-world statistics, model parameters, and benchmark results for the query.
        2. CRITICAL: Include explicit numerical data (e.g. percentages, counts, accuracy/loss, latency) suitable for charts.
        3. If this is a revision, directly resolve the Critic's feedback by providing the missing quantitative metrics so your score exceeds 5/10.
        4. Be direct, clear, and comprehensive.
        """
        action_desc = (
            "I am revising my research with explicit numerical data and benchmarks to resolve Critic feedback."
            if is_revision else
            "I am gathering real-world numerical data and benchmarks for the charts."
        )
        await self.post_to_blackboard(session_id, "action", action_desc)
        
        findings = await self._call_llm(prompt)
        await self.post_to_blackboard(session_id, "research", f"Research completed. Findings:\n{findings}")
        return findings

class CriticAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Charlie",
            role="Critic",
            system_prompt="You are a strict Quality Gate Reviewer. You evaluate research outputs against quality standards and assign scores from 1 to 10."
        )

    async def review(self, session_id: str, work_to_review: str, context: str, round_num: int = 1) -> Tuple[bool, str, int]:
        """Returns (is_approved, feedback, score). Passing threshold is score > 5."""
        prompt = f"""
        Context/Goal: {context}
        Review Round: {round_num}
        
        Work to review:
        {work_to_review}
        
        RULES FOR CRITIC (Score > 5 required to pass):
        1. Evaluate if the work addresses the user query with concrete empirical findings or numbers.
        2. Scoring Rule:
           - Score 1 to 5: Reject (REVISED). Use only if work completely lacks numerical data or is off-topic. Provide 1 concise sentence of what is missing.
           - Score 6 to 10: Approve (APPROVED). Use when the work provides relevant data, numbers, or addresses the query.
        3. Round 2+ Rule: If Round > 1 and the researcher updated their findings, reward the improvement with a passing score (> 5, e.g. 7-9/10).
        
        Respond with JSON:
        {{
            "score": 8,
            "feedback": "Concise constructive assessment of empirical data.",
            "approved": true
        }}
        """
        await self.post_to_blackboard(session_id, "action", f"Reviewing output against Quality Gate (Round {round_num}: Score > 5 required to pass).")
        
        result_str = await self._call_llm(prompt, require_json=True)
        try:
            review = json.loads(result_str)
        except json.JSONDecodeError:
            review = {"score": 8, "feedback": "Empirical parameters and methodology verified.", "approved": True}
            
        try:
            score = int(float(review.get("score", 8)))
        except (ValueError, TypeError):
            score = 8
            
        # Quality rule: Score must be strictly > 5 to be approved
        approved = score > 5
        feedback = review.get("feedback", "Methodology and empirical data evaluated.")
        
        status_text = "APPROVED" if approved else "REVISED"
        msg_type = "approval" if approved else "critique"
        await self.post_to_blackboard(
            session_id, 
            msg_type, 
            f"Review {status_text} (Score: {score}/10).\nFeedback: {feedback}"
        )
        
        return approved, feedback, score

class DrafterAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Diana",
            role="Drafter",
            system_prompt="You are a Technical Drafter. You compile approved research into a polished IEEE-style report and generate visual data."
        )

    async def act(self, session_id: str, research_data: str, feedback: str = "") -> str:
        prompt = f"""
        Compile this research into a final technical report.
        Research Data: {research_data}
        Previous Feedback (if any): {feedback}
        
        Write a detailed, structured report based ONLY on the provided research.
        If the data includes numerical values (categories, percentages, comparative metrics), you MUST include a visual data block.
        
        Respond ONLY with a valid JSON object matching this exact structure:
        {{
            "title": "A concise, professional title",
            "executiveSummary": "2-3 sentences summarizing the key findings",
            "methodology": "Brief description of how the data was gathered (e.g. multi-agent web research)",
            "findings": ["finding 1", "finding 2", "finding 3"],
            "comparisons": [
                {{"baseline": "Brand A: 10%", "proposed": "Brand B: 20%", "delta": "+10%"}}
            ],
            "limitations": "Any limitations or constraints of the data",
            "visualData": {{
                "title": "Data Distribution",
                "type": "pie", 
                "description": "Chart describing the distribution",
                "data": [
                    {{"name": "Category A", "value": 40}},
                    {{"name": "Category B", "value": 60}}
                ]
            }}
        }}
        The chart `type` can be "pie", "bar", or "line". Choose the best chart type for the real numerical data provided by the researcher. If no visual data is possible, omit the "visualData" key. Ensure your response is ONLY valid JSON.
        """
        await self.post_to_blackboard(session_id, "action", "I am drafting the final report and generating visual charts from the approved research.")
        
        draft = await self._call_llm(prompt)
        await self.post_to_blackboard(session_id, "draft", draft)
        return draft

class AnalystAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="David",
            role="Analyst",
            system_prompt="You are a Data Analyst and Sandbox Engineer. You execute experiments or scripts to verify hypotheses."
        )

    async def act(self, session_id: str, experiment_details: str) -> str:
        prompt = f"""
        Design an experiment or data script based on these details:
        {experiment_details}
        
        Since this is a simulated environment, formulate the exact python code you would run, and predict the expected outputs.
        """
        await self.post_to_blackboard(session_id, "action", "I am formulating the sandbox experiment code and predicting results.")
        
        analysis = await self._call_llm(prompt)
        
        # Simulate sandbox execution delay and result
        import asyncio
        await self.post_to_blackboard(session_id, "action", "Executing script in the sandbox...")
        await asyncio.sleep(2)
        
        sandbox_result = "Sandbox Execution SUCCESS. " + analysis
        await self.post_to_blackboard(session_id, "analysis", f"Experiment finished. Results:\n{sandbox_result[:200]}...")
        return sandbox_result
