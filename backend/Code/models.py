from mongoengine import (
    Document,
    StringField,
    ListField,
    DictField,
    ReferenceField
)
from users.models import User  
import datetime


class UserQuestion(Document):
    user = ReferenceField(User, required=True)
    topic = StringField(required=True)
    question_text = StringField(required=True)
    test_cases = ListField(DictField())  
    created_at = StringField(default=str(datetime.datetime.utcnow()))
# services/mongo_models.py
from mongoengine import Document, StringField, ListField, DictField, EmbeddedDocument, EmbeddedDocumentField, DateTimeField
import datetime

class TestCase(EmbeddedDocument):
    input_data = StringField()
    expected_output = StringField()
    visibility = StringField(choices=["public", "hidden"], default="public")


class QuestionB(Document):
    user = ReferenceField(User, required=True)
    topic = StringField()
    title = StringField(required=True)
    description = StringField()
    difficulty = StringField()
    testcases = ListField(EmbeddedDocumentField(TestCase))
    created_at = DateTimeField(default=datetime.datetime.utcnow)

class Plan(Document):
    user = ReferenceField(User, required=True)
    intent = StringField()
    topic = StringField()
    questions = ListField(StringField())  # store question IDs
    total_questions = StringField()
    created_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        'collection': 'user_questions',
        'indexes': ['user', 'topic']
    }

