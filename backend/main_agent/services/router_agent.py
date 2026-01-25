import json
from chatbot.services.groq_service import GroqService

class RouterAgent:
    def __init__(self):
        self.groq = GroqService()

    def route(self, message):
        """
        Classifies the user's message into one of three categories:
        1. PLAN: User wants to learn a new topic.
        2. ACTION: User wants to practice, code, debug, or take a quiz.
        3. CHAT: User wants to ask a question or have something explained.

        Returns:
        {
            "route": "PLAN" | "ACTION" | "CHAT",
            "topic": "extracted topic or None"
        }
        """
        prompt = f"""
        You are the Router for an AI Tutor.
        Classify the User Message into one of these intents:

        1. PLAN: User explicitly says "I want to learn X", "Teach me X", "Start X".
        2. ACTION: User says "Give me a quiz", "I want to code", "Practice", "Debug this".
        3. CHAT: User asks "What is X?", "Explain this", "Hello", or general conversation.

        Also detect the LEARNING STYLE:
        - "comprehensive" (default): Standard deep dive.
        - "concise": User wants "quick", "fast", "summary".
        - "test_prep": User mentions "test tomorrow", "exam", "theory".
        - "practical_prep": User mentions "practicals", "lab", "code only".
        - "practice": User wants to practice/debug.

        User Message: "{message}"

        Return strictly JSON:
        {{
            "route": "PLAN" | "ACTION" | "CHAT",
            "topic": "The extracted technical topic (e.g. 'Recursion') or null if none found",
            "style": "comprehensive" | "concise" | "test_prep" | "practical_prep"
        }}
        """
        
        try:
            response = self.groq.generate_content(prompt)
            # Clean JSON
            clean_text = response.strip()
            if "```json" in clean_text:
                clean_text = clean_text.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_text:
                clean_text = clean_text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(clean_text)
            return data
        except Exception as e:
            print(f"Router Error: {e}")
            return {"route": "CHAT", "topic": None, "style": "comprehensive"} # Default fallback
