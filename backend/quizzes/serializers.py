from rest_framework import serializers
from .models import Question, Choice, UserAnswer
class ChoiceSerializer(serializers.Serializer):
    text = serializers.CharField()
# We DON'T include is_correct when sending the quiz to the student
class QuestionSerializer(serializers.Serializer):
    id = serializers.CharField(source='pk') # Send the MongoDB ObjectId as 'id'
    topic_name = serializers.CharField()
    question_text = serializers.CharField()
    choices = ChoiceSerializer(many=True)
class QuizGenerationRequestSerializer(serializers.Serializer):
    topic_names = serializers.ListField(
    child=serializers.CharField()
    )
class UserAnswerSerializer(serializers.Serializer):
    question_id = serializers.CharField()
    chosen_choice_text = serializers.CharField()
class QuizSubmissionSerializer(serializers.Serializer):
    attempt_id = serializers.CharField()
    answers = UserAnswerSerializer(many=True)
class QuizResultSerializer(serializers.Serializer):
    attempt_id = serializers.CharField(source='pk')
    topic = serializers.CharField()
    score = serializers.FloatField()
    passed = serializers.BooleanField()
    feedback = serializers.DictField() # To give feedback per question```