from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import CustomUser


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'password', 'role']

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data.get('role', 'admin'),
            is_active=True,  # ← add this line
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
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role']