from chatbot.services.groq_service import GroqService

class GeminiLLM:
    def __init__(self):
        self.groq_service = GroqService()

    def ask(self, prompt: str) -> str:
        return self.groq_service.generate_content(prompt)

