import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings

def generate_jwt_for_mongo_user(user):
    """
    Generates JWT tokens manually for MongoEngine User model.
    Mimics SimpleJWT behavior but works with your User document.
    """
    now = datetime.now(timezone.utc)

    payload = {
        "user_id": str(user.id),
        "username": user.username,
        "role": user.role,
        "exp": now + timedelta(minutes=60),  # 1 hour expiry
        "iat": now,
    }
    access_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    refresh_payload = {
        "user_id": str(user.id),
        "type": "refresh",
        "exp": now + timedelta(days=7),
        "iat": now,
    }
    refresh_token = jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm="HS256")

    return {
        "access": access_token,
        "refresh": refresh_token,
    }
