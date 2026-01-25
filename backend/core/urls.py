# The CORRECTED code
from django.contrib import admin
from django.urls import path, include
from users.views import UserRegistrationView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls), # <-- Included only ONCE
    path('api/', include('users.urls')),  # <-- Included only ONCE
    path('api/kg/', include('knowledge_graph.urls')),
    path('api/quizzes/', include('quizzes.urls')),
    path('api/code/', include('Code.urls')),
    path('api/chat/', include('chatbot.urls')),
    path('api/debugger/', include('debugger.urls')),
    path('api/main-agent/', include('main_agent.urls')),
]