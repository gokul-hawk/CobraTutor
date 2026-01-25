import os
import django
import sys
from langchain_core.messages import HumanMessage

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
try:
    django.setup()
except Exception as e:
    print(f"Django setup failed: {e}")

from main_agent.services.agent_factory import build_agent_executor

def debug_echoing():
    print("\n--- DEBUGGING ECHOING BEHAVIOR ---")
    
    agent = build_agent_executor()
    
    # 1. Test case that SHOULD trigger a tool
    user_input = "Trace the concept of Recursion"
    print(f"\nUser Input: {user_input}")
    
    response = agent.invoke({"input": user_input})
    output = response.get("output")
    
    print(f"Agent Output: {output}")
    
    if "Prerequisites" in output or "check_prerequisites" in str(output):
        print("SUCCESS: Tool seems to have been called (or at least mentioned).")
    else:
        print("FAILURE: Agent likely echoed without calling tool.")

if __name__ == "__main__":
    debug_echoing()
