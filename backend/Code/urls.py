from django.urls import path
from . import views

urlpatterns = [
    path("generate-question/", views.generate_question),
    
    path("get-hint/", views.get_hint),
    path("vis/", views.generate_visualization),
    path("next-step/", views.get_next_plan_step),
    path("user-plans/", views.get_user_plans),
    path("ai-assist/", views.ai_assist),
    path("", views.CodeAgentView.as_view(), name="code_agent"),
]
