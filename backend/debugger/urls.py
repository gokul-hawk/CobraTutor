from django.urls import path
from . import views

urlpatterns = [
    path('get-challenge/', views.get_debugger_challenge, name='get_debugger_challenge'),
    path('verify/', views.verify_debugger_explanation, name='verify_debugger_explanation'),
]
