from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated,AllowAny
from .models import Topic
from .serializers import TopicSerializer, PrerequisiteQuizRequestSerializer
from neomodel.exceptions import DoesNotExist

class TopicDetailView(views.APIView):
    """
    API view to retrieve the definition of a specific topic.
    This is a protected endpoint, only authenticated users can access it.
    """
    permission_classes = [AllowAny]

    def get(self, request, topic_name):
        try:
            topic = Topic.nodes.get(name=topic_name)
            serializer = TopicSerializer(topic)
            return Response(serializer.data)
        except DoesNotExist:
            return Response({"error": "Topic not found."}, status=status.HTTP_404_NOT_FOUND)

class PrerequisiteCheckView(views.APIView):
    """
    API view to start the adaptive quiz process.
    It takes a target topic and returns its direct prerequisites.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PrerequisiteQuizRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        target_topic_name = serializer.validated_data['target_topic_name']
        
        try:
            target_topic = Topic.nodes.get(name=target_topic_name)
        except DoesNotExist:
            return Response({"error": "Target topic not found."}, status=status.HTTP_404_NOT_FOUND)
            
        # Get all direct prerequisites for the target topic
        prerequisites = target_topic.prerequisites.all()
        
        if not prerequisites:
            return Response({
                "message": "This topic has no prerequisites. You can start learning it directly.",
                "prerequisites": []
            }, status=status.HTTP_200_OK)

        prereq_serializer = TopicSerializer(prerequisites, many=True)
        return Response({
            "message": f"To learn '{target_topic_name}', you must first demonstrate understanding of its prerequisites.",
            "prerequisites": prereq_serializer.data
        })