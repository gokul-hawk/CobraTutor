from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import UserRegistrationSerializer
from .auth_utils import generate_jwt_for_mongo_user  

class UserRegistrationView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = (AllowAny,)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        tokens = generate_jwt_for_mongo_user(user)

        return Response({
            "user": serializer.data,
            "refresh": tokens["refresh"],
            "access": tokens["access"],
        }, status=status.HTTP_201_CREATED)
