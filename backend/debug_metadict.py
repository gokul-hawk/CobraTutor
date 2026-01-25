import os
import django
import sys
import traceback

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
try:
    django.setup()
except Exception as e:
    print(f"Django setup failed: {e}")

from main_agent.services.agent_factory import build_agent_executor, check_prerequisites

def debug_metadict():
    print("\n--- DEBUGGING METADICT ERROR ---")
    
    # 0. Ensure Topic Exists to test hydration
    print("\n0. Creating test topic to ensure hydration path...")
    from knowledge_graph.models import Topic
    try:
        t = Topic.nodes.get_or_none(name="Recursion")
        if not t:
            t = Topic(name="Recursion", definition="Function calling itself").save()
            print("Created 'Recursion' node.")
        else:
            print("'Recursion' node already exists.")
    except Exception as e:
        print(f"Setup Error: {e}")

    # 1. Test Tool Directly
    print("\n1. Testing check_prerequisites tool directly...")
    try:
        # We can call the function explicitly if it wasn't wrapped, but it is wrapped as a Tool.
        # invoke expects a dictionary input for StructuredTool
        res = check_prerequisites.invoke({"topic_name": "Recursion"})
        print(f"Tool Direct Result: {res}")
    except Exception as e:
        print(f"Tool Direct Error: {e}")
        traceback.print_exc()
        
    # 2. Test Agent triggering the tool
    print("\n2. Testing Agent triggering the tool...")
    try:
        agent = build_agent_executor()
        # This question should trigger check_prerequisites
        response = agent.invoke({"input": "I want to learn about Recursion"})
        print(f"Agent Output: {response.get('output')}")
    except Exception as e:
        print(f"Agent Invocation Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    debug_metadict()
