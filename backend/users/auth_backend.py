from .models import User

class MongoAuthBackend:
    """
    Custom authentication backend to authenticate users against the MongoEngine User model.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            user = User.objects.get(username=username)
            if user.check_password(password):
                return user
        except User.DoesNotExist:
            return None
        return None

    def get_user(self, user_id):
        try:
            # In MongoEngine, the primary key is 'id'
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None