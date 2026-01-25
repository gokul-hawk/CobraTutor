
import os
import django
import sys

# Setup Django
sys.path.append(r"c:\Users\gokul\OneDrive\Desktop\CobraTutor - Copy\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from users.models import User
from chatbot.services.persistent_tutor import handle_persistent_chat
from chatbot.models import TutorSession

def test_tutor_flow():
    # 1. Create Dummy User (using Mongo User but we need a user compatible with our new system if it relies on ID)
    # NOTE: The system is hybrid. TutorSession uses OneToOneField to AUTH_USER_MODEL.
    # If auth user model is Mongo, OneToOne won't work easily with SQL TutorSession unless we are careful.
    # Let's check what AUTH_USER_MODEL is.
    from django.conf import settings
    print(f"Auth User Model: {settings.AUTH_USER_MODEL}")
    class DummyUser:
        email = "test@example.com"
        id = "mock_id_123"

    user = DummyUser()
    print(f"Testing with dummy user: {user.email}")

    # 1. Start Conversation
    print("\n--- Sending Topic 'Python Lists' ---")
    # New signature only takes user and message.
    # Logic: If it's a new topic, the Tutor Agent (internally) should pick it up if IDLE or if users asks to switch.
    resp = handle_persistent_chat(user, "Teach me Python Lists") 
    print(f"Bot Reply: {resp['reply'][:100]}...")
    
    # Check DB
    session = TutorSession.objects.get(user_email=user.email)
    print(f"Session Status: {session.status}")
    print(f"Current Topic: {session.current_topic}")
    
    # 2. Simulate Answer
    print("\n--- Sending Answer ---")
    resp = handle_persistent_chat(user, "A list is a mutable sequence") # Pretend answer
    print(f"Bot Reply: {resp['reply'][:100]}...")
    
    session.refresh_from_db()
    print(f"Session Index: {session.current_index}")



if __name__ == "__main__":
    test_tutor_flow()
