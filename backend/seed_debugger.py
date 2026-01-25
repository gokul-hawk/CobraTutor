import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from debugger.models import DebuggerChallenge

def seed():
    if DebuggerChallenge.objects.count() > 0:
        print("Challenges already exist. Skipping seed.")
        return

    challenges = [
        {
            "topic": "Python Basics",
            "description": "A beginner python syntax error.",
            "buggy_code": "def greet(name)\n    print('Hello ' + name)",
            "error_output": "  File \"main.py\", line 1\n    def greet(name)\n                  ^\nSyntaxError: expected ':'",
            "expected_reason": "The function definition is missing a colon at the end of the line.",
            "difficulty": "Beginner"
        },
        {
            "topic": "Lists",
            "description": "Index out of range error.",
            "buggy_code": "my_list = [1, 2, 3]\nprint(my_list[3])",
            "error_output": "Traceback (most recent call last):\n  File \"main.py\", line 2, in <module>\n    print(my_list[3])\nIndexError: list index out of range",
            "expected_reason": "Lists are 0-indexed. Accessing index 3 of a 3-element list (indices 0, 1, 2) causes an IndexError.",
            "difficulty": "Beginner"
        },
        {
            "topic": "Loops",
            "description": "Infinite loop logic error.",
            "buggy_code": "i = 0\nwhile i < 5:\n    print(i)",
            "error_output": "(Program hangs/Time Limit Exceeded)",
            "expected_reason": "The loop variable 'i' is never incremented, so the condition 'i < 5' remains true forever.",
            "difficulty": "Intermediate"
        }
    ]

    for data in challenges:
        DebuggerChallenge(**data).save()
    
    print(f"Successfully added {len(challenges)} challenges.")

if __name__ == "__main__":
    seed()
