from chatbot.services.groq_service import GroqService

class TutorAgent:
    def __init__(self):
        self.groq = GroqService()

    def handle(self, message, chat_history):
        """
        Pure conversational agent. No tools. Just explanations.
        """
        prompt = f"""
        You are a friendly AI Tutor.
        Conversation History:
        {chat_history}

        User: {message}

        Provide a clear, concise explanation. Use analogies if helpful. 
        Do NOT try to open tools or create plans. Just teach.
        """
        
        try:
            response = self.groq.generate_content(prompt)
            return response
        except Exception as e:
            return f"I'm having trouble thinking right now. ({e})"
