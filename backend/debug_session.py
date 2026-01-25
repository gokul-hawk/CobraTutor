import os
import django
import sys
import traceback

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
try:
    django.setup()
    print("Django setup successful.")
except Exception as e:
    print(f"Django setup failed: {e}")
    sys.exit(1)

from users.models import User
from main_agent.models import AgentSession
import uuid

def debug_session():
    print("\n--- DEBUGGING AGENT SESSION (MetaDict Fix) ---")
    try:
        # 1. Create/Get a User (MongoEngine)
        username = f"debug_user_{uuid.uuid4().hex[:8]}"
        user = User(username=username, email=f"{username}@example.com", password="password")
        user.save()
        print(f"Created User: {user.username} (ID: {user.id})")

        # 2. Create AgentSession (MongoEngine) linked to User
        session = AgentSession(user=user)
        session.current_topic = "Debug Topic"
        session.save()
        print(f"Created AgentSession: {session}")

        # 3. Retrieve Session
        retrieved_session = AgentSession.objects(user=user).first()
        if retrieved_session:
            print(f"Retrieved Session: {retrieved_session.current_topic}")
            print("SUCCESS: Session created and retrieved without MetaDict error.")
        else:
            print("FAILURE: Could not retrieve session.")

    except Exception as e:
        print(f"\nCRASH DETECTED: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    debug_session()
