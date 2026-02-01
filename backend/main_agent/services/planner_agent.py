from chatbot.services.groq_service import GroqService

class PlannerAgent:
    def __init__(self):
        self.groq = GroqService()

    def create_plan(self, topic, style="comprehensive"):
        """
        Generates a learning plan based on the requested style.
        """
        prompt = f"""
        Create a learning plan for Python topic: "{topic}".
        Style context: "{style}"

        Styles:
        - "comprehensive": Standard 4-step flow (Gaps -> Teach -> Code -> Debug).
        - "concise": Teach Content -> Practice Code.
        - "test_prep": Teach Content (Theory + Examples) ONLY. No coding/quiz. Quick revision.
        - "practical_prep": Practice Code ONLY. One consolidated coding challenge.
        action can be["Gaps" for check_prereqs,"tutor" for teach_content,"debugger" for debug_code,"code" for practice_code,"dashboard" for dashboard]
        Return ONLY a JSON list of steps. No other text.
        
        Examples:
        [Test Prep] -> [{{"step": "teach_content", "topic": "{topic} Theory & Examples", action="tutor"}}]
        [Practical] -> [{{"step": "practice_code", "topic": "{topic} Challenge", action="code"}}]
        
        Format:
        [
            {{"step": "check_prereqs", "topic": "...",action="..."}},
            ...
        ]
        """
        
        try:
            plan_json = self.groq.generate_content(prompt)
            print(f"DEBUG: Raw Plan Response: '{plan_json}'")
            
            import re
            
            # 1. Remove <think> blocks
            clean_text = re.sub(r"<think>.*?</think>", "", plan_json, flags=re.DOTALL).strip()
            
            # 2. Extract JSON from code blocks
            if "```json" in clean_text:
                 clean_text = clean_text.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_text:
                 clean_text = clean_text.split("```")[1].split("```")[0].strip()
                 
            # 3. Last resort: regex find list brackets
            json_match = re.search(r"\[.*\]", clean_text, re.DOTALL)
            if json_match:
                clean_text = json_match.group()
                 
            return clean_text
        except Exception as e:
            print(f"Plan Gen Error: {e}")
            return "[]"
