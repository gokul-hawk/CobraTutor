from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from users.authentication import JWTAuthentication
from .models import DebuggerChallenge
from chatbot.services.groq_service import GroqService
import json
import random

groq_service = GroqService()

@api_view(["GET"])
@permission_classes([AllowAny]) # Or IsAuthenticated depending on reqs, mostly IsAuthenticated for authorized users
def get_debugger_challenge(request):
    try:
        topic = request.GET.get("topic", "General")
        difficulty = request.GET.get("difficulty", "Beginner")
        count = int(request.GET.get("count", 5)) # Default to 5 challenges
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    # 1. Check if we already have enough challenges for this topic/difficulty
    existing_challenges = list(DebuggerChallenge.objects.filter(topic=topic, difficulty=difficulty))
    
    if len(existing_challenges) >= count:
        # If we have enough, just return a random sample of them
        selected_challenges = random.sample(existing_challenges, count)
        result = []
        for c in selected_challenges:
            result.append({
                "id": str(c.id),
                "topic": c.topic,
                "description": c.description,
                "buggy_code": c.buggy_code,
                "error_output": c.error_output,
                "difficulty": c.difficulty
            })
        return JsonResponse(result, safe=False)

    # 2. If not, generate a batch using LLM
    prompt = f"""
    Generate {count} unique Python debugging challenges for the topic '{topic}' and difficulty '{difficulty}'.
    
    Focus on COMMON ERRORS and MISTAKES specific to this topic (e.g. off-by-one errors for arrays, recursion depth for recursion, etc).
    
    The output must be a valid JSON ARRAY of objects. Each object must have:
    - description: A short instruction.
    - buggy_code: The python code containing the error.
    - error_output: The simulated compiler or runtime error message.
    - expected_reason: The correct explanation for the error.
    
    Example JSON Structure:
    [
        {{
            "description": "Fix the loop",
            "buggy_code": "while True print('hi')",
            "error_output": "SyntaxError: invalid syntax",
            "expected_reason": "Missing colon after True"
        }}
    ]
    
    Return ONLY the raw JSON array. No markdown.
    """
    
    try:
        content = groq_service.generate_content(prompt)
        content = content.replace("```json", "").replace("```", "").strip()
        data_list = json.loads(content)
        
        if not isinstance(data_list, list):
            data_list = [data_list] # Handle single object edge case

        created_challenges = []
        for data in data_list:
            challenge = DebuggerChallenge(
                topic=topic,
                difficulty=difficulty,
                description=data.get("description", "Debug this code"),
                buggy_code=data.get("buggy_code", "# Error generating code"),
                error_output=data.get("error_output", "Unknown Error"),
                expected_reason=data.get("expected_reason", "Unknown")
            )
            challenge.save()
            created_challenges.append({
                "id": str(challenge.id),
                "topic": challenge.topic,
                "description": challenge.description,
                "buggy_code": challenge.buggy_code,
                "error_output": challenge.error_output,
                "difficulty": challenge.difficulty
            })
            
        return JsonResponse(created_challenges, safe=False)

    except Exception as e:
        return JsonResponse({"error": f"Batch generation failed: {str(e)}"}, status=500)

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def verify_debugger_explanation(request):
    data = json.loads(request.body)
    challenge_id = data.get("challenge_id")
    user_explanation = data.get("user_explanation")
    
    if not challenge_id or not user_explanation:
        return JsonResponse({"error": "Missing challenge_id or user_explanation"}, status=400)
        
    try:
        challenge = DebuggerChallenge.objects.get(id=challenge_id)
    except Exception:
        return JsonResponse({"error": "Challenge not found"}, status=404)
        
    # Construct Prompt for LLM
    prompt = f"""
    You are a strict code tutor. A student is debugging the following code:
    
    ```python
    {challenge.buggy_code}
    ```
    
    The error output is:
    {challenge.error_output}
    
    The canonical reason (hidden from student) is:
    {challenge.expected_reason}
    
    The student's explanation is:
    "{user_explanation}"
    
    Evaluate the student's explanation. They must identify:
    1. The Line Number (approximate is okay if logic is sound).
    2. The Reason (what is wrong).
    3. The Fix (how to correct it).
    
    Return ONLY a JSON object with this structure:
    {{
        "line_correct": boolean,
        "reason_correct": boolean,
        "fix_correct": boolean,
        "is_correct": boolean (true only if all above are true or close enough),
        "feedback": "Short helpful feedback string"
    }}
    """
    
    try:
        # Call Groq
        response_text = groq_service.generate_content(prompt)
        
        # Clean response (remove markdown if any)
        cleaned_response = response_text.replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned_response)
        
        return JsonResponse(result)
    except Exception as e:
        # Fallback if JSON parsing fails or LLM errors
        return JsonResponse({
            "is_correct": False, 
            "feedback": f"Could not verify explanation. Error: {str(e)}",
            "detailed_feedback": {}
        }, status=500)
