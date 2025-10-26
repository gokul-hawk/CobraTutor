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

    meta = {
        'collection': 'user_questions',
        'indexes': ['user', 'topic']
    }

