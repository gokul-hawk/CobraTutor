from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from django.conf import settings
import jwt
from .models import User

class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        try:
            prefix, token = auth_header.split(" ")
            if prefix.lower() != "bearer":
                raise exceptions.AuthenticationFailed("Invalid token prefix")
        except ValueError:
            raise exceptions.AuthenticationFailed("Invalid Authorization header")

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user = User.objects(id=payload["user_id"]).first()
            if not user:
                raise exceptions.AuthenticationFailed("User not found")
            return (user, token)
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Token expired")
        except jwt.DecodeError:
            raise exceptions.AuthenticationFailed("Invalid token")
