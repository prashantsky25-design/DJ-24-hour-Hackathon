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
            system_prompt="You are an expert Data Researcher. You fetch real facts, numbers, and sources for the query."
        )

    async def act(self, session_id: str, plan_context: str) -> str:
        prompt = f"""
        Execute the research step based on this context:
        {plan_context}
        
        Find real-world statistics, exact numbers, and sources that answer the query. Do not invent numbers. 
        Summarize your findings clearly so the Drafter can use them.
        CRITICAL: Provide concrete numerical data (percentages, counts, values) that can be visualized as Pie or Bar charts.
        """
        await self.post_to_blackboard(session_id, "action", "I am gathering real-world numerical data and sources for the charts.")
        
        findings = await self._call_llm(prompt)
        await self.post_to_blackboard(session_id, "research", f"Research completed. Findings:\n{findings}")
        return findings

class CriticAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Charlie",
            role="Critic",
            system_prompt="You are a strict Reviewer. You verify the accuracy, completeness, and quality of the generated work."
        )

    async def review(self, session_id: str, work_to_review: str, context: str) -> Tuple[bool, str, int]:
        """Returns (is_approved, feedback, score)."""
        prompt = f"""
        Context/Goal: {context}
        
        Work to review:
        {work_to_review}
        
        Evaluate the work. Give it a score from 1 to 10. 
        If the score is 8 or higher, it passes. Otherwise, it fails and requires revision.
        Provide specific feedback on what is wrong or missing.
        
        Respond with JSON:
        {{
            "score": 8,
            "feedback": "Specific critique...",
            "approved": true
        }}
        """
        await self.post_to_blackboard(session_id, "action", "I am reviewing the latest output for accuracy and completeness.")
        
        result_str = await self._call_llm(prompt, require_json=True)
        try:
            review = json.loads(result_str)
        except json.JSONDecodeError:
            review = {"score": 5, "feedback": "Failed to parse review.", "approved": False}
            
        approved = review.get("approved", False)
        score = review.get("score", 0)
        feedback = review.get("feedback", "No feedback provided.")
        
        status_text = "APPROVED" if approved else "REJECTED"
        await self.post_to_blackboard(
            session_id, 
            "critique", 
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
