from django.urls import path
from . import views

urlpatterns = [
    path("generate-question/", views.generate_question),
    
    path("get-hint/", views.get_hint),
    path("vis/", views.generate_visualization),
]
