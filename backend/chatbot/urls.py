from django.urls import path
from . import views


urlpatterns = [
    path("", views.tutor_chat, name="tutor_chat"), 
    path("summarize/", views.summarize_conversation, name="summarize_conversation"),
    path("generate_quiz/", views.generate_quiz, name="generate_quiz"),
    path("welcome/", views.welcome_message, name="welcome_message"),
]