# quiz/services/gemini_service.py
import os
# import google.generativeai as genai
from chatbot.services.groq_service import GroqService
import json
import re

class GeminiService:
    def __init__(self):
        # Using Groq now, but keeping class name for compatibility
        self.groq_service = GroqService()

    def generate_questions(self, topic: str, num_questions: int = 2):
        prompt = f"""
        You are an expert Python educator.
        Generate exactly {num_questions} unique multiple-choice questions on the topic: "{topic}".
        Difficulty: beginner to intermediate.

        Each question must have exactly 4 options.
        Provide output as a JSON array of objects with:
        - "question": question text (string)
        - "options": list of 4 strings
        - "correct_answer": the exact correct option text (string)

        Example:
        [
          {{
            "question": "What is a stack?",
            "options": ["LIFO", "FIFO", "Tree", "Graph"],
            "correct_answer": "LIFO"
          }}
        ]
        Only output valid JSON. No markdown.
        """

        try:
            # response = self.model.generate_content(prompt)
            # raw = response.text.strip()
            raw = self.groq_service.generate_content(prompt).strip()
            clean = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
            data = json.loads(clean)

            if isinstance(data, dict):
                data = [data]
            return data[:num_questions]
        except Exception as e:
            print(f"Groq error for topic '{topic}': {e}")
            return []