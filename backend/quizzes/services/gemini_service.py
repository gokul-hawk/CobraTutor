import google.generativeai as genai
import os
import json
import re

class GeminiService:
    def __init__(self):
        api=""
        genai.configure(api_key=api)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
    def generate_question1(self, topic: str, difficulty="medium"):
        print(topic)
        prompt = f"""
        Generate {difficulty} multiple-choice question on the topics: {topic}.
        only give the response in JSON format as
        {{
            "question": "string",
            "options": ["A", "B", "C", "D"],
            "correct_answer": "string"
        }}
        """
        print(2)
        response = self.model.generate_content(prompt)
        raw_text = response.text.strip()

        # 🔧 Remove markdown code fences like ```json ... ```
        clean_text = re.sub(r"^```(?:json)?|```$", "", raw_text, flags=re.MULTILINE).strip()

        try:
            question_data = json.loads(clean_text)
            return question_data
        except json.JSONDecodeError:
            # fallback dummy question
            return {
                "question": "Error: Could not parse Gemini response",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "Option A"
            }

    def generate_questions(self, topic: str, difficulty=["medium"]):
        print(topic)
        prompt = f"""
        Generate {difficulty} multiple-choice question on the topics: {topic}.
        make 2 question for each topic.
        only give the response in JSON format as
        {{
            "question": "string",
            "options": ["A", "B", "C", "D"],
            "correct_answer": "string"
        }}
        """
        print(2)
        response = self.model.generate_content(prompt)
        raw_text = response.text.strip()

        # 🔧 Remove markdown code fences like ```json ... ```
        clean_text = re.sub(r"^```(?:json)?|```$", "", raw_text, flags=re.MULTILINE).strip()

        try:
            question_data = json.loads(clean_text)
            return question_data
        except json.JSONDecodeError:
            # fallback dummy question
            return {
                "question": "Error: Could not parse Gemini response",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "Option A"
            }
    def ask(self, prompt: str):
        response = self.model.generate_content(prompt)
        return response.text.strip()