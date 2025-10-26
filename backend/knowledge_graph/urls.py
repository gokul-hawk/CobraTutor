from django.urls import path
from .views import TopicDetailView, PrerequisiteCheckView

urlpatterns = [
    # e.g., /api/kg/topics/Variables/
    path('topics/<str:topic_name>/', TopicDetailView.as_view(), name='topic-detail'),
    # e.g., POST to /api/kg/check-prerequisites/ with {"target_topic_name": "Functions"}
    path('check-prerequisites/', PrerequisiteCheckView.as_view(), name='check-prerequisites'),
]