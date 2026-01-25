from mongoengine import Document, StringField, DictField, ListField, ReferenceField, DateTimeField
from users.models import User
import datetime

class AgentSession(Document):
    user = ReferenceField(User, required=True, unique=True)
    
    # State Machine
    PHASES = (
        ('IDLE', 'Idle'),
        ('ANALYZING', 'Analyzing Gaps'),
        ('TEACHING_PREREQ', 'Teaching Prerequisites'),
        ('TEACHING_MAIN', 'Teaching Main Topic'),
        ('PRACTICING_CODE', 'Practicing Code'),
        ('PRACTICING_DEBUG', 'Practicing Debugging'),
        ('COMPLETED', 'Completed')
    )
    
    current_phase = StringField(choices=PHASES, default='IDLE')
    current_topic = StringField(default=None)

    failed_prereqs = ListField(StringField(), default=list)
    context = DictField(default=dict)
    current_plan = ListField(DictField(), default=list) # e.g. [{"step": "teach", "topic": "Recursion"}, ...]
    last_step_result = DictField(default=dict) # e.g. {"passed": True, "score": 100}

    chat_history = ListField(DictField(), default=list) # [{"sender": "user"|"bot", "text": "...", "timestamp": ...}]
    updated_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {'indexes': ['user']}

    def __str__(self):
        return f"{self.user.username} - {self.current_phase} - {self.current_topic}"
