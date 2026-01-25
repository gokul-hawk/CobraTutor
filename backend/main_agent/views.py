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
    Advances the user's learning plan.
    """
    try:
        session = AgentSession.objects(user=request.user).first()
        if not session or not session.current_plan:
            return Response({"message": "No active plan."}, status=status.HTTP_200_OK)
            
        # 1. Complete current step
        completed_step = session.current_plan.pop(0)
        
        # 1b. Capture Failed Topics (if any)
        failed_topics = request.data.get("failed_topics", [])
        if failed_topics:
            session.failed_prereqs = failed_topics
        else:
            session.failed_prereqs = [] # Clear if passed
            
        session.last_step_result = {"step": completed_step, "status": "completed", "failed_topics": failed_topics}
        session.save()
        
        # 2. Trigger next step immediately
        orchestrator = MainAgentOrchestrator(request.user)
        msg = f"Debug/Code/Quiz for {completed_step.get('topic')} completed."
        if failed_topics:
            safe_topics = [str(t) for t in failed_topics]
            msg += f" User FAILED prerequisites: {', '.join(safe_topics)}."
        else:
            msg += " User PASSED everything."
            
        result = orchestrator.process_message(msg)
        
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
