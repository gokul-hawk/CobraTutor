from django.http import JsonResponse
# import google.generativeai as genai (REMOVED)
from chatbot.services.groq_service import GroqService
groq_service = GroqService()
# model = genai.GenerativeModel("gemini-2.5-flash") (REMOVED)
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

    # --- Call Agent Service (Groq) ---
    from .services.agent_service import process_user_query
    
    # Construct a query to trigger intent detection or directly use tools
    # Since we want a question for a topic, we can simulate a query
    query = f"Generate a coding question about {topic}"
    
    try:
        user = User.objects.get(id=user_id)
        # process_user_query saves the question to DB (QuestionB/Plan)
        # We need to adapt the return to what frontend expects
        # process_user_query returns {"type": "single", "question": qdata} or plan
        
        result_data = process_user_query(query, user)
        
        if result_data.get("type") == "single":
            qdata = result_data.get("question", {})
            question_text = qdata.get("description", "") # or title + description
            # Frontend expects "question_text"
            if qdata.get("title"):
                question_text = f"**{qdata.get('title')}**\n\n{question_text}"
                
            test_cases = qdata.get("testcases", [])
            
        elif result_data.get("type") == "plan":
             # If it generated a plan, just take the first question?
             # Or inform frontend?
             # For now, let's just take the first question from the plan if available
             questions = result_data.get("questions", [])
             if questions:
                 qdata = questions[0]
                 question_text = f"**{qdata.get('title')}**\n\n{qdata.get('description')}"
                 test_cases = qdata.get("testcases", [])
             else:
                 question_text = "No question generated."
                 test_cases = []
        else:
            question_text = "Unexpected agent response."
            test_cases = []

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": f"Agent request failed: {str(e)}"}, status=500)
    
    # Note: process_user_query already saves QuestionB / Plan models.
    # The frontend seems to rely on the response JSON directly or maybe refetching.
    # The original view saved UserQuestion (mongoengine).
    # agent_service saves QuestionB (mongoengine).
    # We might want to save UserQuestion too if frontend relies on it specifically?
    # Original view saved: UserQuestion(user=user, topic=topic, question_text=question_text, test_cases=test_cases).save()
    
    # Let's save UserQuestion to maintain backward compatibility for now, 
    # even though agent_service saves QuestionB.
    # UserQuestion matches the simple schema frontend might expect if it lists them.
    try:
        UserQuestion(user=user, topic=topic, question_text=question_text, test_cases=test_cases).save()
    except Exception as e:
        print(f"Error saving legacy UserQuestion: {e}")

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

    # response = model.generate_content(prompt)
    # return JsonResponse({"hint": response.text})
    text = groq_service.generate_content(prompt)
    return JsonResponse({"hint": text})

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import requests
# API_KEY = os.environ.get("GEMINI_API_KEY", "") (REMOVED)

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

Steps:
1. Get the problem or algorithm from the user
2. identify the problem or algorithm
3. Find the best method or implementation of the solution for the problem
4. Identify the Datastructures needed for the problem
5. now plan the blocks to get input
6 now plan all possible interaction in the HTML
7. now plan all the code, data structure and explaination of each step in the HTML
8. now plan the final code
9. provide code snippet 
10. now generate html with clean code and provide best animaation for with tailwind css
    """

    # Use Groq logic instead of direct Gemini REST call
    # Construct a full prompt with system instruction
    full_prompt = f"{system_prompt}\n\nUser Prompt: {prompt}"
    
    try:
        jsx = groq_service.generate_content(full_prompt)
        # Clean any markdown fences
        jsx = jsx.replace("```html", "").replace("```", "").strip()
        return Response({"code": jsx})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
# api/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from mongoengine import connect
from django.conf import settings
from .services.agent_service import process_user_query


class CodeAgentView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    def post(self, request):
        user_query = request.data.get("query", "")
        if not user_query:
            return Response({"error": "Missing query"}, status=400)
        try:
            user=request.user.id
            result = process_user_query(user_query,user)
            print("Agent result:", result)
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

