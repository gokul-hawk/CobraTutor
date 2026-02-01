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
            
            # Robust JSON check
            # 1. Remove <think> blocks
            clean = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
            
            # 2. Extract code blocks
            if "```json" in clean:
                clean = clean.split("```json")[1].split("```")[0].strip()
            elif "```" in clean:
                clean = clean.split("```")[1].split("```")[0].strip()
                
            # 3. Regex search for list/object
            match = re.search(r"(\{|\[).+(\}|\])", clean, re.DOTALL)
            if match:
                clean = match.group()
                
            data = json.loads(clean)

            if isinstance(data, dict):
                data = [data]
            return data[:num_questions]
        except Exception as e:
            print(f"Groq error for topic '{topic}': {e}")
            return []

    def get_prerequisites(self, topic: str, count: int = 2) -> list[str]:
        """
        Generates a list of prerequisite topics for the given concept using Groq.
        Fallback when Neo4j doesn't have the data.
        """
        prompt = f"""
        Identify exactly {count} immediate prerequisite concepts needed to understand the Python topic: "{topic}".
        Return ONLY a JSON array of strings. No extra text.
        Example: ["Variables", "Data Types"]
        """
        try:
            raw = self.groq_service.generate_content(prompt).strip()
            
            # Robust JSON check
            # 1. Remove <think> blocks
            clean = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
            
            # 2. Extract code blocks if present
            if "```json" in clean:
                clean = clean.split("```json")[1].split("```")[0].strip()
            elif "```" in clean:
                clean = clean.split("```")[1].split("```")[0].strip()
                
            # 3. Last attempt regex find list
            match = re.search(r"\[.*\]", clean, re.DOTALL)
            if match:
                 clean = match.group()
            
            data = json.loads(clean)
            if isinstance(data, list):
                return data[:count]
            return []
        except Exception as e:
            import sys
            print(f"Groq get_prerequisites error for '{topic}': {e}")
            sys.stdout.flush()
            return []