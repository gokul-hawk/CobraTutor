import json
import os
import sys

# Setup Django environment to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
try:
    django.setup()
except:
    pass

from Code.services.agent_service import clean_json_blocks

# Simulation of the failing response
failing_response = """{
  "title": "Validate BST and Check Balance",
  "description": "## Problem Statement\\n\\n### Input Format\\n```\\nN\\nvalue_1 left_1 right_1\\n...\\n```\\n",
  "difficulty": "medium",
  "testcases": []
}"""

print("--- Testing Fixed Function from Agent Service ---")
result = clean_json_blocks(failing_response)

if result and result.get("title") == "Validate BST and Check Balance":
    print("SUCCESS: JSON parsed correctly!")
    print(result)
else:
    print("FAILURE: JSON parsing failed.")
    print(result)
