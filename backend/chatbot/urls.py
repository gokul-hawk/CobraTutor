from django.urls import path
from . import views

# Define the app name for URL namespace separation

urlpatterns = [
    path("", views.tutor_chat, name="tutor_chat"), 
    path("summarize/", views.summarize_conversation, name="summarize_conversation"),
    path("generate_quiz/", views.generate_quiz, name="generate_quiz"),
]