from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from users.authentication import JWTAuthentication
from users.models import User
from .models import QuizAttempt, Question, UserAnswer
from .serializers import QuizSubmissionSerializer, QuizResultSerializer
from .services.quiz_service import QuizService

quiz_service = QuizService()


class GenerateQuizView(APIView):
    """
    Generates multiple questions for one or more topics and creates a single QuizAttempt.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        print(request.data)
        student_id = request.user.id
        topic_names = request.data.get("topic_names", [])

        # ✅ Validate input
        if not student_id:
            return Response({"error": "student_id required"}, status=400)

        if not topic_names or not isinstance(topic_names, list):
            return Response({"error": "topic_names must be a non-empty list"}, status=400)

        # ✅ Fetch student
        try:
            student = User.objects.get(id=student_id)
        except User.DoesNotExist:
            return Response({"error": "Invalid student ID"}, status=404)

        all_questions = []

        # ✅ Generate multiple questions for all topics
        for topic in topic_names:
            print(f"Generating for topic: {topic}")
            topic_questions = quiz_service.generate_unique_questions(topic, difficulty="medium")

            if not topic_questions:
                print(f"No questions generated for {topic}")
                continue

            all_questions.extend(topic_questions)

        if not all_questions:
            return Response({"message": "No questions available"}, status=404)

        # ✅ Create or update a quiz attempt
        topic_label = ", ".join(topic_names)
        attempt = QuizAttempt.objects(student=student, topic=topic_label).first()

        if not attempt:
            attempt = QuizAttempt.objects.create(
                student=student,
                topic=topic_label,
                questions=all_questions
            )
        else:
            # Avoid duplicates
            for q in all_questions:
                if q not in attempt.questions:
                    attempt.questions.append(q)
            attempt.save()

        # ✅ Prepare clean response
        response_data = {
            "attempt_id": str(attempt.id),
            "questions": [
                {
                    "question_id": str(q.id),
                    "question_text": q.question_text,
                    "options": q.choices,  # ✅ fixed — it's already a list of strings
                }
                for q in all_questions
            ],
            "note": "AI-generated quiz with multiple questions"
        }

        return Response(response_data, status=200)


class SubmitQuizView(generics.GenericAPIView):
    """
    Evaluates student answers and returns quiz result.
    If the student scores below threshold, generates follow-up quizzes
    on prerequisite topics until the base topics are mastered.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = QuizSubmissionSerializer
    PASS_THRESHOLD = 0.6

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # ✅ Fetch quiz attempt
        try:
            attempt = QuizAttempt.objects.get(pk=data['attempt_id'], student=request.user)
        except QuizAttempt.DoesNotExist:
            return Response(
                {"error": "Quiz attempt not found or does not belong to user."},
                status=status.HTTP_404_NOT_FOUND
            )

        correct_answers = 0
        feedback = {}
        user_answers = []

        # ✅ Evaluate answers
        for answer_data in data['answers']:
            question = Question.objects.get(pk=answer_data['question_id'])
            correct_answer = question.correct_answer.strip().lower()
            chosen_answer = answer_data['chosen_choice_text'].strip().lower()

            is_correct = (chosen_answer == correct_answer)
            if is_correct:
                correct_answers += 1

            feedback[str(question.pk)] = {
                "correct": is_correct,
                "correct_answer": question.correct_answer
            }

            user_answers.append(UserAnswer(
                question=question,
                chosen_choice_text=answer_data['chosen_choice_text'],
                is_correct=is_correct
            ))

        # ✅ Calculate score
        total_questions = len(attempt.questions)
        score = correct_answers / total_questions if total_questions > 0 else 0
        attempt.score = score
        attempt.passed = score >= self.PASS_THRESHOLD
        attempt.answers = user_answers
        attempt.save()

        # ✅ Prepare result
        result_data = {
            "pk": str(attempt.pk),
            "topic": attempt.topic.name,
            "score": round(attempt.score * 100, 2),
            "passed": attempt.passed,
            "feedback": feedback
        }

        # ✅ Generate follow-up quizzes if failed
        next_quizzes = []
        if not attempt.passed:
            prereq_topics = attempt.topic.prerequisites.all()
            for prereq in prereq_topics:
                # Only generate quiz if user hasn't passed it yet
                if not QuizAttempt.objects.filter(student=request.user, topic=prereq, passed=True).exists():
                    quiz_questions = generate_quiz_for_topic(prereq.name)
                    next_quizzes.append({
                        "topic": prereq.name,
                        "questions": quiz_questions
                    })

        if next_quizzes:
            result_data["next_quizzes"] = next_quizzes
        else:
            result_data["all_topics_passed"] = True
            result_data["message"] = "Congratulations! You have mastered all topics."

        # ✅ Return result
        result_serializer = QuizResultSerializer(result_data)
        return Response(result_serializer.data, status=200)