from mongoengine import Document, StringField, DictField, EmailField, BooleanField,ListField, EmbeddedDocumentField, EmbeddedDocument
from werkzeug.security import generate_password_hash, check_password_hash    

class User(Document):
    class Role:
        STUDENT = "STUDENT"
        TEACHER = "TEACHER"
        ROLE_CHOICES = (STUDENT, TEACHER)
    ROLE_CHOICES = (Role.STUDENT, Role.TEACHER)
    username = StringField(required=True, unique=True, max_length=150)
    email = EmailField(required=True, unique=True)
    password = StringField(required=True) 
    role = StringField(choices=ROLE_CHOICES, default=Role.STUDENT)
    questions = ListField(DictField(), default=[])
    is_active = BooleanField(default=True)
    is_staff = BooleanField(default=False) 
    is_authenticated = BooleanField(default=True)
    def set_password(self, raw_password):
        self.password = generate_password_hash(raw_password)
    def check_password(self, raw_password):
        return check_password_hash(self.password, raw_password)

    def get_username(self):
        return self.username
    