# views.py (or wherever your view lives)
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from rest_framework.response import Response
from rest_framework import status
import os
# import google.generativeai as genai (REMOVED)
from .services.groq_service import GroqService

# configure genai for other endpoints (summarize/quiz)
# genai.configure... (REMOVED)
groq_service = GroqService()


@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def tutor_chat(request):
    user = request.user
    message = request.data.get("message", "")
    if not message:
        return Response({"error": "Message required"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .services.persistent_tutor import handle_persistent_chat
        result = handle_persistent_chat(user, message)
        
        return Response(
            {
                "reply": result.get("reply"),
                "awaiting_reply": bool(result.get("awaiting_reply", False)),
                "ended": bool(result.get("ended", False)),
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Summarize conversation endpoint (unchanged except small validation improvement)
from rest_framework.permissions import IsAuthenticated

# model = genai.GenerativeModel("gemini-2.5-flash") (REMOVED)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def summarize_conversation(request):
    try:
        messages = request.data.get("messages", [])
        if not messages or not isinstance(messages, list):
            return Response({"error": "Missing or invalid 'messages' list."}, status=status.HTTP_400_BAD_REQUEST)

        full_text = "\n".join(messages)

        prompt = f"""
        You are an educational summarizer. Summarize the following tutor conversation
        into clear, structured learning notes. Highlight main ideas, definitions,
        and examples in a concise form suitable for quick revision.

        Conversation content:
        {full_text}
        """

        # response = model.generate_content(prompt)
        # summary_text = getattr(response, "text", None)
        summary_text = groq_service.generate_content(prompt)
        summary_text = summary_text.strip() if summary_text else "No summary generated."

        return Response({"summary": summary_text}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": f"Summary generation failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_quiz(request):
    try:
        messages = request.data.get("messages", [])
        if not messages:
            return Response({"error": "No messages provided"}, status=status.HTTP_400_BAD_REQUEST)

        text_context = "\n".join([m.get("text", "") for m in messages if m.get("sender") == "bot"])

        prompt = f"""
        Based on the following tutoring conversation:
        {text_context}

        Generate 5 multiple-choice quiz questions that test understanding.
        Return them in JSON format like:
        [
          {{
            "question": "...",
            "options": ["A", "B", "C", "D"],
            "answer": "A"
          }},
          ...
        ]
        """

        # model = genai.GenerativeModel("gemini-2.0-flash")
        # result = model.generate_content(prompt)
        # text = getattr(result, "text", "") or ""
        text = groq_service.generate_content(prompt)

        import json, re
        json_match = re.search(r"\[.*\]", text, re.DOTALL)
        quiz_data = json.loads(json_match.group()) if json_match else []

        return Response({"quiz": quiz_data}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
