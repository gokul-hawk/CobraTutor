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

from quizzes.services.prerequisite_builder import PrerequisiteBuilder
from quizzes.services.neo4j_services import Neo4jService
from knowledge_graph.models import Topic

def debug_quizzes():
    print("\n--- DEBUGGING QUIZZES MODULE ---")
    
    # 0. Create a dummy node if not exists (using neomodel for convenience)
    try:
        if not Topic.nodes.get_or_none(name="Recursion"):
            Topic(name="Recursion", definition="...").save()
            print("Created dummy 'Recursion' node via neomodel.")
        
        # Create a Prerequisite relationship
        if not Topic.nodes.get_or_none(name="Functions"):
            Topic(name="Functions", definition="...").save()
        
        rec = Topic.nodes.get(name="Recursion")
        func = Topic.nodes.get(name="Functions")
        
        if not rec.prerequisites.is_connected(func):
            rec.prerequisites.connect(func)
            print("Connected Recursion -> REQUIRES -> Functions")
            
    except Exception as e:
        print(f"Setup Error: {e}")

    # 1. Test Neo4jService connection
    print("\n1. Testing Neo4jService raw driver...")
    try:
        service = Neo4jService()
        print("Neo4jService initialized.")
        prereqs = service.get_direct_prerequisites("Recursion")
        print(f"Direct prerequisites for Recursion: {prereqs}")
        service.close()
    except Exception as e:
        print(f"Neo4jService Error: {e}")
        traceback.print_exc()

    # 2. Test PrerequisiteBuilder
    print("\n2. Testing PrerequisiteBuilder (defaults)...")
    try:
        builder = PrerequisiteBuilder()
        chain = builder.build_chain("Recursion")
        print(f"Prerequisite Chain for Recursion: {chain}")
    except Exception as e:
        print(f"PrerequisiteBuilder Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    debug_quizzes()
