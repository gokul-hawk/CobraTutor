# quiz/services/quiz_service.py
import hashlib
from .gemini_service import GeminiService
from .neo4j_services import Neo4jService
from ..models import Question
import random

class QuizService:
    def __init__(self):
        self.gemini = GeminiService()

    def hash_question(self, question_text: str, correct_answer: str, options: list) -> str:
        content = f"{question_text}|{correct_answer}|{sorted(options)}"
        return hashlib.sha256(content.encode()).hexdigest()

    def generate_unique_questions(self, topic: str, num_questions: int = 2):
        raw_questions = self.gemini.generate_questions(topic, num_questions)
        saved_questions = []

        for q in raw_questions:
            if not all(k in q for k in ["question", "options", "correct_answer"]):
                continue
            if len(q["options"]) != 4:
                continue

            question_text = q["question"]
            options = q["options"]
            correct_answer = q["correct_answer"]

            # Skip if correct_answer not in options
            if correct_answer not in options:
                continue

            hash_val = self.hash_question(question_text, correct_answer, options)
            if Question.objects(hash=hash_val).first():
                continue  # duplicate

            new_question = Question(
                topic_name=topic,
                question_text=question_text,
                choices=options,
                correct_answer=correct_answer,
                question_type="multiple-choice",
                hash=hash_val
            )
            new_question.save()
            saved_questions.append(new_question)

        return saved_questions

    def get_full_prerequisite_tree(self, topics: list) -> list:
        """Return all topics in transitive closure (including input topics)."""
        all_topics = set(topics)
        queue = list(topics)
        neo4j = Neo4jService()

        try:
            while queue:
                current = queue.pop()
                if not current: continue

                # 1. Skip Neo4j for now (User Request)
                # try:
                #     prereqs = neo4j.get_direct_prerequisites(current)
                # except Exception as e:
                #     print(f"Neo4j error for {current}: {e}")
                #     prereqs = []
                
                # Force LLM usage
                prereqs = [] 
                import sys
                print(f"Generating prerequisites via LLM for '{current}'...")
                sys.stdout.flush()
                try:
                    # Use count=2 as requested
                    prereqs = self.gemini.get_prerequisites(current, count=2)
                    print(f"LLM generated prereqs for '{current}': {prereqs}")
                    sys.stdout.flush()
                except Exception as e:
                    print(f"LLM fallback error: {e}")
                    sys.stdout.flush()
                    prereqs = []

                for p in prereqs:
                    if p not in all_topics:
                        all_topics.add(p)
                        queue.append(p)
        finally:
            neo4j.close()

        return list(all_topics)