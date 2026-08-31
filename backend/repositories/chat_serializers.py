"""
Chat Serializers (Phase 2).
"""

from rest_framework import serializers
from repositories.models import ChatSession, ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'session', 'role', 'content', 'sources', 'created_at']
        read_only_fields = ['id', 'session', 'created_at']


class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ['id', 'repository', 'title', 'created_at', 'updated_at', 'messages']
        read_only_fields = ['id', 'repository', 'created_at', 'updated_at']


class ChatSessionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing sessions (no messages)."""
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ['id', 'repository', 'title', 'created_at', 'updated_at', 'message_count']

    def get_message_count(self, obj):
        return obj.messages.count()


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=1, max_length=2000)
    session_id = serializers.IntegerField(required=False, allow_null=True)
    debug = serializers.BooleanField(required=False, default=False)
