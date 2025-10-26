# quiz/services/quiz_service.py

from .gemini_service import GeminiService
from .neo4j_services import Neo4jService
from ..models import Question, QuizAttempt
import re, json, random
import hashlib

class QuizService:
    def __init__(self):
        self.gemini = GeminiService()

    def get_unattempted_question(self, student, concept):
        """Return one question the student hasn't attempted yet"""
        attempted_ids = [a.question.id for a in QuizAttempt.objects.filter(student=student)]
        unattempted = Question.objects.filter(concept=concept, id__nin=attempted_ids)

        if unattempted:
            return random.choice(unattempted)
        return None
    def hash(self, text):
        return hashlib.sha256(text.encode('utf-8')).hexdigest( )
    def get_question_for_student1(self,concept,difficulty="Medium"):
        question=self.gemini.generate_question1(concept)
        return question
    
    def generate_unique_questions(self, concept, difficulty="Medium"):
        """Generate unique Gemini questions for a concept"""
        con=[]
        for a in concept:
            con=self.get_prerequisites(a)
        print(con)
        questions_data = self.gemini.generate_questions(con)

        if isinstance(questions_data, dict):
            questions_data = [questions_data]  # ensure list format
        print(questions_data)
        unique_qs = []
        for q in questions_data:
            text = q.get("question")
            if not text:
                continue
            hash = self.hash(text)
            print(hash)
            while Question.objects.filter(hash=hash).first():
                self.get_question_for_student1(concept,difficulty)
                hash=self.hash(text)
                print(hash)
            print(type(q["options"]))
            obj = Question.objects.create(
                topic_name=concept,
                question_text=text,
                correct_answer=q["correct_answer"],
                choices=q["options"],
                hash=hash
            )
            unique_qs.append(obj)

        return unique_qs

    def get_question_for_student(self, student, concept, difficulty="Medium"):
        """
        Get one unique question for a student:
        1. Fetch from DB unattempted
        2. Else, generate new via Gemini
        """
        # False → existing question

        # No unattempted questions found, generate new
        new_questions = self.generate_unique_questions(concept, difficulty)
        if not new_questions:
            return None, False
        for q in new_questions:
            
            if not QuizAttempt.objects.filter(student=student, questions=q).first():
                return q, True  # True → newly generated

        return random.choice(new_questions), True  # True → newly generated

    def recursive_add_prereqs(self, concept, visited=None):
        """Same as before (unchanged)"""
        if visited is None:
            visited = set()

        if concept in visited:
            return []

        visited.add(concept)

        prereqs = self.get_prerequisites(concept)
        new_qs = []
        for p in prereqs:
            new_qs.extend(self.generate_unique_questions(p, difficulty="Easy"))
            new_qs.extend(self.recursive_add_prereqs(p, visited))

        return new_qs

    def get_prerequisites(self, concept, mode="direct", database="dsa"):
 
        neo4j = Neo4jService(database=database)
        try:
            prereqs = neo4j.get_direct_prerequisites(concept)
        except Exception as e:
            print(f"Neo4j query failed: {e}")
            prereqs = []
        finally:
            neo4j.close()

        # If no prerequisites found, fallback to Gemini
        if not prereqs or (isinstance(prereqs, dict) and not any(prereqs.values())):
            prompt = f"""
            Provide the {mode} prerequisites for the concept '{concept}'.If prerequisites are not over python basics then return Basics reached as Json{{"Prequisites": [None]}}.
            Respond only in strict JSON format like:
            {{
                "prerequisites": ["concept1", "concept2", ...]
            }}
            """
            try:
                response = self.gemini.ask(prompt)
                response = re.sub(r"^```(?:json)?|```$", "", response, flags=re.MULTILINE).strip()
                data = json.loads(response)
                prereqs = data.get("prerequisites", [])
            except Exception as e:
                print(f"Gemini fallback failed: {e}")
                prereqs = []

        return prereqs
