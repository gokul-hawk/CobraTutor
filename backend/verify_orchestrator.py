import os
import django
import sys

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import User
from main_agent.services.orchestrator import MainAgentOrchestrator
from main_agent.models import AgentSession

def test_orchestrator():
    print("--- Starting Orchestrator Verification ---")

    # 1. Get/Create Test User
    username = "agent_test_user"
    try:
        user = User.objects.get(username=username)
        print(f"Found existing user: {username}")
    except User.DoesNotExist:
        user = User.objects.create_user(username=username, password="password")
        print(f"Created user: {username}")

    # Reset Session
    AgentSession.objects(user=user).delete()
    print("Reset session.")

    # 2. Initialize Orchestrator
    orchestrator = MainAgentOrchestrator(user)
    print("Orchestrator initialized.")

    # 3. Test PLAN Intent
    print("\n--- TEST 1: PLAN Intent ('I want to learn Recursion') ---")
    response = orchestrator.process_message("I want to learn Recursion")
    print(f"Reply: {response['reply']}")
    print(f"Action: {response.get('action')}")
    
    session = AgentSession.objects(user=user).first()
    if session.current_plan:
        print(f"✅ Plan Created! Steps: {len(session.current_plan)}")
        print(f"Current Step: {session.current_plan[0]}")
    else:
        print("❌ Plan Creation Failed.")

    # 4. Test CHAT Intent during Plan
    print("\n--- TEST 2: CHAT Intent ('Explain this to me') ---")
    response = orchestrator.process_message("Explain this concept to me")
    print(f"Reply: {response['reply']}")
    
    # 5. Test ACTION Intent ('Let's practice writing code')
    print("\n--- TEST 3: ACTION Intent ('I want to write code') ---")
    response = orchestrator.process_message("I want to write code")
    print(f"Reply: {response['reply']}")
    print(f"Action: {response.get('action')}")

    if response.get('action') and response['action']['type'] == 'SWITCH_TAB':
         print("✅ Director Action Triggered Successfully.")
    else:
         print("❌ Director Action Failed.")

if __name__ == "__main__":
    test_orchestrator()
