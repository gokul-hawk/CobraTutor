from django.http import JsonResponse
import google.generativeai as genai
model = genai.GenerativeModel("gemini-2.5-flash")
from django.http import JsonResponse
from .models import  UserQuestion
from users.models import User
import requests
from django.views.decorators.csrf import csrf_exempt
import json
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from .services.ai_utility import generate_question_with_testcases

from rest_framework.decorators import api_view, authentication_classes, permission_classes

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def generate_question(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST request required"}, status=400)
    print(request.body)
    data = json.loads(request.body)
    topic = data.get("topic")   
    user_id = request.user.id  # or get from session/auth
    print(topic,user_id)
    if not topic or not user_id:
        return JsonResponse({"error": "Topic and user_id are required"}, status=400)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)

    # --- Call Gemini API to generate question + test cases ---
    gemini_payload = {
        "prompt": f"Generate a new random coding question and test cases on topic '{topic}'. Return JSON with keys: question_text, test_cases."
    }
    try:
        gemini_resp = generate_question_with_testcases(topic)
        print(123)
    except Exception as e:
        return JsonResponse({"error": f"Gemini request failed: {str(e)}"}, status=500)
    question_text = gemini_resp.get("question", "No question generated")
    test_cases = gemini_resp.get("test_cases", [])
    print(question_text,test_cases)
    
    UserQuestion(user=user, topic=topic, question_text=question_text, test_cases=test_cases).save()


    # --- Return response to frontend ---
    return JsonResponse({
        "topic": topic,
        "question_text": question_text,
        "test_cases": test_cases
    })


# Provide hints
def get_hint(request):
    question = request.GET.get("question", "reverse a string")
    prompt = f"Give a step-by-step hint for solving: {question}, \
               but do not provide the full solution."

    response = model.generate_content(prompt)
    return JsonResponse({"hint": response.text})

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import requests
import os

API_KEY = os.environ.get("GEMINI_API_KEY", "")

@api_view(["POST"])
@permission_classes([AllowAny])
def generate_visualization(request):
    prompt = request.data.get("prompt", "")
    if not prompt:
        return Response({"error": "Prompt is required"}, status=400)

    system_prompt = """
    You are a specialized Visualization Code Generator.

Your task is to generate a complete, self-contained **single-page HTML document** (one file) that visually and interactively demonstrates the requested algorithm or data structure.

RULES:
1. Respond ONLY with the plain HTML document as a single string (start with <!DOCTYPE html> and include <html> ...). Do NOT wrap the output in JSON, Markdown, comments, or any additional text.
2. The document MUST include Tailwind CSS loaded via CDN (https://cdn.tailwindcss.com) and use Tailwind utility classes for styling. Do NOT include external CSS files other than the Tailwind CDN.
3. Use only plain, vanilla JavaScript for interactivity. Do NOT use React, Vue, or any other frameworks/libraries. You may include inline <script> tags inside the HTML file.
4. The page MUST include at least two visible controls labeled "Next Step" and "Reset" to control the visualization, and display the current step index.
5. The HTML should be self-contained and runnable inside an iframe (no module imports, no ESM import/export statements, no external network calls other than the Tailwind CDN).
6. Ensure all DOM element IDs and classes are unique and descriptive to avoid collisions when embedded in an iframe.
7. The visual output should be responsive and usable on common desktop/mobile widths.
8. Include a small legend explaining colors/states used in the visualization (e.g., comparing, swapping, sorted).
9. Keep the code robust: sanitize inputs if accepting user input, avoid using `eval`, and do not depend on server-side resources.
10. The HTML must be ready to render as-is; the user should be able to paste it into an iframe or file and see the fully working visualization without modifications.
11.The input should be from the user 
12.The visualization should also say what is happening at each step
13.Every step should be understandable visually
14.Add animation how they connect or change in real time
15.Visualize the problem first before visualizing the algorithm and then change the visualization to show how the algorithm works
16.provide how the datastructureschange if It needed in the problem 
17.Make sure the illustrattion of how a real code algorithm would work
18.do the swapping or changing of datastructures in real time.
Do not add any additional commentary — output only the HTML document.
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
    }

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={API_KEY}"

    try:
        r = requests.post(api_url, json=payload)
        r.raise_for_status()
        data = r.json()
        jsx = data["candidates"][0]["content"]["parts"][0]["text"]
        # Clean any markdown fences
        jsx = jsx.replace("```jsx", "").replace("```", "").strip()
        return Response({"code": jsx})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
