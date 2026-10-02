from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import CustomUser


def _known_role(value):
    from apps.access.services import role_keys
    if value not in role_keys():
        raise serializers.ValidationError('Choose one of the roles under Users, Access.')
    return value


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    def validate_role(self, value):
        return _known_role(value)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'password', 'role', 'is_active']

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data['role'],
            is_active=validated_data.get('is_active', True),  # ← respect is_active on create
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(
            username=data['username'],
            password=data['password']
        )
        if not user:
            raise serializers.ValidationError("Invalid username or password.")
        data['user'] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    role_label = serializers.SerializerMethodField()

    def get_role_label(self, obj) -> str:
        from apps.access.services import role_label
        return role_label(obj.role)

    def validate_role(self, value):
        return _known_role(value)

    last_login_display = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role', 'role_label', 'is_active', 'last_login', 'last_login_display']

    def get_last_login_display(self, obj) -> str:
        if obj.last_login:
            return obj.last_login.strftime('%d %b %Y, %I:%M %p')
        return 'Never'