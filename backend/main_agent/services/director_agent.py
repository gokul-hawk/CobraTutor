from chatbot.services.groq_service import GroqService

class DirectorAgent:
    def __init__(self):
        self.groq = GroqService()

    def handle(self, message, topic=None):
        """
        Decides which tool to open based on user message.
        """
        if not topic:
             # If topic is missing, asking LLM to extract it might be needed, 
             # but usually Router provides it. If not, fallback to "general".
             topic = "Python"

        prompt = f"""
        User wants to practice or take an action.
        Query: "{message}"
        Topic: "{topic}"

        Available Actions:
        1. SWITCH_TO_CODE: Write code from scratch.
        2. SWITCH_TO_DEBUG: Fix buggy code.
        3. SWITCH_TO_QUIZ: Answering multiple choice questions.

        Return ONLY the action string in this format:
        ACTION_TRIGGER:SWITCH_TO_CODE:{topic}
        or
        ACTION_TRIGGER:SWITCH_TO_QUIZ:{topic}
        etc.
        
        If unsure, default to Quiz.
        """
        
        try:
            response = self.groq.generate_content(prompt).strip()
            # Safety check
            if "ACTION_TRIGGER" not in response:
                 return f"ACTION_TRIGGER:SWITCH_TO_QUIZ:{topic}"
            return response
        except:
             return f"ACTION_TRIGGER:SWITCH_TO_QUIZ:{topic}"
