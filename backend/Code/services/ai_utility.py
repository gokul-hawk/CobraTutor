# ai_utils.py
import google.generativeai as genai
from django.conf import settings
import os
import re

API_KEY = os.environ.get("GEMINI_API_KEY", None)
genai.configure(api_key=API_KEY)

def generate_question_with_testcases(topic: str):
    print(topic)
    prompt = f"""
    Generate a unique competitive programming question on the topic: {topic}.
    The output should be in strict JSON format with the following fields:
    {{
      "question": "string(ex:Given an input string s and a pattern p, implement regular expression matching with support for '.' and '*' where:

'.' Matches any single character.​​​​
'*' Matches zero or more of the preceding element.
The matching should cover the entire input string (not partial).

 

Example 1:

Input: s = "aa", p = "a"
Output: false
Explanation: "a" does not match the entire string "aa".
Example 2:

Input: s = "aa", p = "a*"
Output: true
Explanation: '*' means zero or more of the preceding element, 'a'. Therefore, by repeating 'a' once, it becomes "aa".
Example 3:

Input: s = "ab", p = ".*"
Output: true
Explanation: ".*" means "zero or more (*) of any character (.)".
 

Constraints:

1 <= s.length <= 20
1 <= p.length <= 20
s contains only lowercase English letters.
p contains only lowercase English letters, '.', and '*'.
It is guaranteed for each appearance of the character '*', there will be a previous valid character to match.))",
      "test_cases": [
        {{"input": "string", "expected": "string"}},
        ...
      ],
    }}
    Do not include explanations, only valid JSON.
    """
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)
    clean_text = re.sub(r"^```(?:json)?|```$", "", response.text, flags=re.MULTILINE).strip()
    print("Gemini raw response:", response.text)

    # Parse JSON safely
    import json
    try:
        data = json.loads(clean_text)
        print("Parsed Gemini data:", data)
    except Exception:
        data = {"question": "Failed to parse Gemini output", "test_cases": []}
        print("Error parsing Gemini response:", clean_text)

    return data
