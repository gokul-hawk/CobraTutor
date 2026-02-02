import sys
import os
from unittest.mock import MagicMock

# 1. Mock dependencies BEFORE import
sys.modules["django"] = MagicMock()
sys.modules["django.conf"] = MagicMock()
sys.modules["Code.models"] = MagicMock()
sys.modules["chatbot.services.groq_service"] = MagicMock()

# Mock the specific GroqService class to avoid instantiation error if it's called
mock_groq = MagicMock()
sys.modules["chatbot.services.groq_service"].GroqService.return_value = mock_groq

# 2. Validate the path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# 3. Import the function
# We need to manually load the module because we mocked "django" and others which might be imported inside
# But agent_service.py does `from Code.models import ...`
# Since we mocked Code.models, that should be fine.

try:
    from Code.services.agent_service import clean_json_blocks
    print("Successfully imported clean_json_blocks")
except ImportError as e:
    print(f"Import failed: {e}")
    # Fallback: Read file and exec just the function (if imports are too messy)
    print("Falling back to reading file content...")
    with open(os.path.join(current_dir, "Code/services/agent_service.py"), "r", encoding="utf-8") as f:
        content = f.read()
    
    # simplistic extraction (this is hacky but works for verification if import fails)
    import re
    import json # ensure json is available for the exec scope
    
    # We will exec the whole file but with mocks in place? 
    # No, let's just assume if import failed we need to fix the test.
    sys.exit(1)

# 4. Run the test case
failing_response = """{
  "title": "Validate BST and Check Balance",
  "description": "## Problem Statement\\n\\n### Input Format\\n```\\nN\\nvalue_1 left_1 right_1\\n...\\n```\\n",
  "difficulty": "medium",
  "testcases": []
}"""

print("--- Testing clean_json_blocks from codebase ---")
result = clean_json_blocks(failing_response)

if result and result.get("title") == "Validate BST and Check Balance":
    print("SUCCESS: JSON parsed correctly!")
    print(result)
else:
    print("FAILURE: JSON parsing failed.")
    print(result)
