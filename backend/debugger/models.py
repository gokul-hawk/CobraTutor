from mongoengine import Document, StringField, ListField

class DebuggerChallenge(Document):
    topic = StringField(required=True)
    description = StringField(required=True)
    buggy_code = StringField(required=True)
    error_output = StringField(required=True)
    expected_reason = StringField(required=False)  # The canonical explanation (hidden from user)
    difficulty = StringField(choices=["Beginner", "Intermediate", "Advanced"], default="Beginner")
    
    meta = {
        'collection': 'debugger_challenges'
    }
