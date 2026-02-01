from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from rest_framework.response import Response
from rest_framework import status
from .services.orchestrator import MainAgentOrchestrator
from .models import AgentSession

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def main_agent_chat(request):
    """
    Main Agent Entry Point. Delegates to Orchestrator.
    """
    try:
        message = request.data.get("message", "")
        if not message:
            return Response({"error": "Message required"}, status=status.HTTP_400_BAD_REQUEST)
        
        orchestrator = MainAgentOrchestrator(request.user)
        result = orchestrator.process_message(message)
        
        return Response(result, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def report_success(request):
    """
    Endpoint for tools (Coding/Quiz/Debug) to report success.
    Advances the user's learning plan or cycles independent mode.
    """
    try:
        session = AgentSession.objects(user=request.user).first()
        
        # ------------------------------------------------------------------
        # SCENARIO A: INDEPENDENT MODE (No Active Plan)
        # ------------------------------------------------------------------
        if not session or not session.current_plan:
            current_topic = session.current_topic if session else "General"
            source = request.data.get("source")
            
            # State Machine: Quiz -> Tutor -> Code -> Debug -> Dashboard
            if source == "quiz":
                reply_text = f"Diagnosis complete! Let's dive into the theory of **{current_topic}**."
                action_view = "tutor"
            elif source == "tutor":
                reply_text = f"Theory on **{current_topic}** covered. Time to write some code!"
                action_view = "code"
            elif source == "code":
                reply_text = f"Coding challenge passed! Now let's fix a buggy implementation of **{current_topic}**."
                action_view = "debugger"
            elif source == "debug":
                reply_text = f"Excellent! You've mastered **{current_topic}** across all domains. Returning found dashboard."
                action_view = "dashboard"
            else:
                # Default / Fallback from unknown sources
                reply_text = f"Step completed. Continuing with **{current_topic}**."
                action_view = "tutor" # Default to tutor if unsure

            result = {
                "reply": reply_text,
                "action": {
                    "type": "SWITCH_TAB",
                    "view": action_view,
                    "data": {"topic": current_topic}
                }
            }
            
            if session:
                session.chat_history.append({"sender": "bot", "text": reply_text})
                session.save()
                
            return Response(result, status=status.HTTP_200_OK)

        # ------------------------------------------------------------------
        # SCENARIO B: ACTIVE PLAN MODE
        # ------------------------------------------------------------------
        
        # 1. Complete current step
        completed_step = session.current_plan.pop(0)
        print(1,completed_step)
        # 2. Capture Failed Topics (if any)
        failed_topics = request.data.get("failed_topics", [])
        if failed_topics:
            session.failed_prereqs = failed_topics
        else:
            session.failed_prereqs = [] 
        print(failed_topics)
        session.last_step_result = {"step": completed_step, "status": "completed", "failed_topics": failed_topics}
        session.save()
        print(session.current_plan)
        
        # 3. Trigger next step immediately via Orchestrator
        orchestrator = MainAgentOrchestrator(request.user)
        msg = f"Step {completed_step.get('topic')} completed."
        print(3,msg)
        if failed_topics:
            safe_topics = [str(t) for t in failed_topics]
            msg += f" User FAILED prerequisites: {', '.join(safe_topics)}."
        else:
            msg += " User PASSED."
            
        result = orchestrator.advance_plan(msg)
        print(4,result)
        return Response(result, status=status.HTTP_200_OK)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_chat_history(request):
    """
    Returns the persistent chat history for the user's Agent Session.
    """
    try:
        session = AgentSession.objects(user=request.user).first()
        if not session:
             return Response([], status=status.HTTP_200_OK)
             
        # Return last 50 messages strictly
        return Response(session.chat_history[-50:], status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from chatbot.services.groq_service import GroqService 
groq_service = GroqService()

from Code.models import UserQuestion

@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def welcome_message(request):
    """
    Main Agent Welcome.
    """
    user = request.user
    
    # 1. Fetch Context
    # Get recent questions
    try:
        recent_questions = UserQuestion.objects.filter(user=user).order_by('-created_at')[:3]
        recent_topics = [q.topic for q in recent_questions]
    except Exception:
        recent_topics = []

    # Dynamic Conversational Prompt for Main Agent
    prompt = f"""
    You are the Main Orchestrator of CobraTutor.
    User: {user.username}
    Context - Recent Topics: {", ".join(recent_topics) if recent_topics else "None (New User)"}
    
    Task:
    Generate a welcome message that sounds like a proactive tutor suggesting specific, exciting activities.
    
    Structure (Strictly follow this layout, but GENERATE your own content for the bullets):
    "Hi {user.username}! What shall we tackle today?
    - [Suggest a Theory Session on a topic]
    - [Suggest a Visualization of an algorithm]
    - [Suggest a Coding Challenge]
    - [Suggest Exam/Interview Prep for a topic]
    - [Suggest a Practical/Real-world application]
    
    I recommend we start with: [Pick one specific topic]"
    
    Guidelines:
    - Do NOT use generic placeholders like "[Topic]". Fill them with actual, interesting CS topics (e.g. Heaps, DP, React Hooks, deadlock).
    - If the user has recent topics, try to suggest related advanced concepts.
    - If the user is new, suggest fundamental but interesting topics (e.g. Binary Search, OOP, API design).
    - Be creative!
       
    Output strictly JSON:
    {{
      "message": "..."
    }}
    """
    try:
        response_text = groq_service.generate_content(prompt)
        import re, json
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
        else:
             # Fallback
             data = {
                 "message": f"Hi {user.username}! Ready to code?\n- Learn Python Basics?\n- Visualize Sorting Algorithms?\n- Practice LeetCode Easy?\n\nI recommend we start with: Python Lists."
             }
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            "message": f"Hi {user.username}! Ready to learn?\n- Python Basics?\n- Data Structures?\n\nI recommend: Variables."
        }, status=status.HTTP_200_OK)
