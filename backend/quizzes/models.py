from mongoengine import Document, EmbeddedDocument, StringField, ListField, ReferenceField, EmbeddedDocumentField, FloatField,BooleanField
from users.models import User
from mongoengine import DateTimeField
import datetime

class Choice(EmbeddedDocument):
   
    text = StringField(required=True)
    is_correct = StringField(required=True) 

class Question(Document):
    """Simplified quiz question."""
    topic_name = StringField(required=True)
    question_text = StringField(required=True)
    choices = ListField(StringField())  # just ["A", "B", "C", "D"]
    correct_answer = StringField(required=True)  # store correct choice text
    question_type = StringField(choices=("multiple-choice", "recall"), default="multiple-choice")
    hash = StringField(required=True, unique=True)
    meta = {'indexes': ['topic_name']}

class UserAnswer(EmbeddedDocument):
    """Stores a student's answer to a specific question within a quiz attempt."""
    question = ReferenceField(Question)
    answer_text = StringField() # For recall questions
    chosen_choice_text = StringField() # For multiple-choice
    is_correct = BooleanField()

class QuizAttempt(Document):
    """Records a student's attempt at a specific quiz."""
    student = ReferenceField(User)
    topic = StringField(required=True) 
    questions = ListField(ReferenceField(Question))
    answers = ListField(EmbeddedDocumentField(UserAnswer))
    score = FloatField(default=0.0)
    passed = StringField(default='False')
    timestamp = DateTimeField(default=datetime.datetime.utcnow)

    meta = {'indexes': ['student', 'topic']}