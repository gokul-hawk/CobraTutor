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
        - "comprehensive": Standard 5-step flow (Check Prereqs -> Gaps -> Teach -> Code -> Debug).
        - "concise": Teach Content -> Practice Code.
        - "test_prep": Teach Content (Theory + Examples) ONLY. No coding/quiz. Quick revision.
        - "practical_prep": Practice Code ONLY. One consolidated coding challenge.
        
        Return ONLY a JSON list of steps. No other text.
        
        Examples:
        [Test Prep] -> [{{"step": "teach_content", "topic": "{topic} Theory & Examples"}}]
        [Practical] -> [{{"step": "practice_code", "topic": "{topic} Challenge"}}]

        Format:
        [
            {{"step": "check_prereqs", "topic": "..."}},
            ...
        ]
        """
        
        try:
            plan_json = self.groq.generate_content(prompt)
            # Clean JSON
            if "```json" in plan_json:
                 plan_json = plan_json.split("```json")[1].split("```")[0].strip()
            elif "```" in plan_json:
                 plan_json = plan_json.split("```")[1].split("```")[0].strip()
                 
            return plan_json
        except Exception as e:
            print(f"Plan Gen Error: {e}")
            return "[]"
