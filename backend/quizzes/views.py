# quiz/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from .models import QuizAttempt, Question, UserAnswer
from .serializers import SubmitQuizRequestSerializer
from .services.neo4j_services import Neo4jService
from .services.quiz_service import QuizService
from mongoengine import DoesNotExist
import logging

logger = logging.getLogger(__name__)
quiz_service = QuizService()
PASS_THRESHOLD = 0.5
SESSION_STORE = {}
import uuid
from datetime import datetime, timedelta

def cleanup_old_sessions():
    """Remove sessions older than 1 hour"""
    now = datetime.utcnow()
    expired = [
        sid for sid, data in SESSION_STORE.items()
        if now - data.get("created_at", now) > timedelta(hours=1)
    ]
    for sid in expired:
        SESSION_STORE.pop(sid, None)

class GenerateQuizView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        topic_names = request.data.get("topic_names", [])
        if not isinstance(topic_names, list) or not topic_names:
            return Response({"error": "topic_names must be a non-empty list"}, status=400)

        student = request.user

        # Get direct prerequisites
        all_prereqs = set()
        neo4j = Neo4jService()
        try:
            for topic in topic_names:
                try:
                    prereqs = neo4j.get_direct_prerequisites(topic)
                    all_prereqs.update(prereqs)
                except Exception as e:
                    logger.warning(f"Neo4j error for '{topic}': {e}")
        finally:
            neo4j.close()

        if not all_prereqs:
            return Response({
                "message": "No prerequisites found.",
                "topic_scores": {}
            }, status=200)

        # ✅ Create session for this diagnostic journey
        session_id = str(uuid.uuid4())
        SESSION_STORE[session_id] = {
            "student_id": str(student.id),
            "attempted_topics": set(all_prereqs),  # track all topics in this session
            "failed_topics": set(),
            "created_at": datetime.utcnow()
        }
        cleanup_old_sessions()

        # Generate quizzes
        attempts = []
        for p in all_prereqs:
            questions = quiz_service.generate_unique_questions(p, num_questions=2)
            if questions:
                attempt = QuizAttempt(
                    student=student,
                    topic=p,
                    questions=questions
                )
                attempt.save()
                attempts.append(attempt)

        if not attempts:
            topic_scores = {}
            for p in all_prereqs:
                att = QuizAttempt.objects(student=student, topic=p).order_by('-timestamp').first()
                if att:
                    topic_scores[p] = round(att.score * 100, 2)
            return Response({
                "message": "All prerequisites already mastered.",
                "topic_scores": topic_scores,
                "session_id": session_id  # include session_id even if no attempts
            }, status=200)

        return Response({
            "session_id": session_id,  # ← send to frontend
            "attempts": [
                {
                    "attempt_id": str(a.id),
                    "topic": a.topic,
                    "questions": [
                        {
                            "question_id": str(q.id),
                            "question_text": q.question_text,
                            "options": q.choices,
                        }
                        for q in a.questions
                    ]
                }
                for a in attempts
            ]
        }, status=200)

class SubmitQuizView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SubmitQuizRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # ✅ Get session_id from request
        session_id = request.data.get("session_id")
        if not session_id or session_id not in SESSION_STORE:
            return Response({"error": "Invalid or expired session"}, status=400)

        session_data = SESSION_STORE[session_id]
        student = request.user

        # Validate session ownership
        if session_data["student_id"] != str(student.id):
            return Response({"error": "Session does not belong to user"}, status=403)

        submissions = serializer.validated_data['submissions']
        topic_scores = {}

        # Grade submissions
        for sub in submissions:
            attempt_id = sub['attempt_id']
            answers = sub['answers']
            try:
                attempt = QuizAttempt.objects.get(id=attempt_id, student=student)
            except DoesNotExist:
                continue

            total = len(attempt.questions)
            if total == 0:
                score = 0.0
            else:
                correct = 0
                user_answers = []
                for ans in answers:
                    try:
                        q_id = ans['question_id']
                        chosen = ans['chosen_choice_text']
                        question = Question.objects.get(id=q_id)
                        is_correct = chosen.strip().lower() == question.correct_answer.strip().lower()
                        if is_correct:
                            correct += 1
                        user_answers.append(UserAnswer(
                            question=question,
                            chosen_choice_text=chosen,
                            is_correct=is_correct
                        ))
                    except Exception as e:
                        logger.warning(f"Grading error: {e}")
                        continue

                score = correct / total
                attempt.answers = user_answers
                attempt.score = score
                attempt.passed = 'passed' if score >= PASS_THRESHOLD else 'failed'
                attempt.save()

            topic_scores[attempt.topic] = round(score * 100, 2)

            # ✅ Track failed topics in session
            if score < PASS_THRESHOLD:
                session_data["failed_topics"].add(attempt.topic)

        lagging_topics = [t for t, s in topic_scores.items() if s < (PASS_THRESHOLD * 100)]
        next_attempts = []

        if lagging_topics:
            next_prereqs = set()
            neo4j = Neo4jService()
            try:
                for topic in lagging_topics:
                    try:
                        prereqs = neo4j.get_direct_prerequisites(topic)
                        next_prereqs.update(prereqs)
                    except Exception as e:
                        logger.warning(f"Neo4j error for '{topic}': {e}")
            finally:
                neo4j.close()

            # Add new topics to session tracking
            session_data["attempted_topics"].update(next_prereqs)

            for p in next_prereqs:
                questions = quiz_service.generate_unique_questions(p, num_questions=2)
                if questions:
                    new_attempt = QuizAttempt(
                        student=student,
                        topic=p,
                        questions=questions
                    )
                    new_attempt.save()
                    next_attempts.append(new_attempt)

        result = {
            "session_id": session_id,  # so frontend can continue
            "topic_scores": topic_scores,
            "lagging_topics": lagging_topics,
        }

        if next_attempts:
            result["next_quizzes"] = [
                {
                    "attempt_id": str(a.id),
                    "topic": a.topic,
                    "questions": [
                        {
                            "question_id": str(q.id),
                            "question_text": q.question_text,
                            "options": q.choices,
                        }
                        for q in a.questions
                    ]
                }
                for a in next_attempts
            ]
        else:
            # 🎯 FINAL REPORT: All failed topics in THIS SESSION
            result["all_failed_topics"] = list(session_data["failed_topics"])
            result["message"] = "Diagnostic complete. Review all failed topics from this session."
            # Optionally clean up session
            SESSION_STORE.pop(session_id, None)

        return Response(result, status=200)