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
    traceback.print_exc()
    sys.exit(1)

from main_agent.services.agent_factory import build_agent_executor

def reproduce_crash():
    print("\n--- ATTEMPTING TO REPRODUCE CRASH ---")
    try:
        # Check ENV variables
        from django.conf import settings
        print(f"GROQ_API_KEY present: {bool(settings.GROQ_API_KEY)}")
        
        print("Building agent...")
        agent = build_agent_executor()
        print("Agent built successfully.")
        
        print("Invoking agent...")
        response = agent.invoke({"input": "Hello, are you working?"})
        print(f"Response: {response}")
        
    except Exception as e:
        print("\n!!! CRASH DETECTED !!!")
        print(f"Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    reproduce_crash()
