from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.main_agent_chat, name='main_agent_chat'),
    path('report_success/', views.report_success, name='report_success'),
    path('history/', views.get_chat_history, name='get_chat_history'),
    path('welcome/', views.welcome_message, name='welcome_message'),
]
