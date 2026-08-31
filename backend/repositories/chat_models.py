"""
Chat Models — ChatSession and ChatMessage for persistent conversation history.
"""

from django.db import models
from django.contrib.auth.models import User
from repositories.models import Repository


class ChatSession(models.Model):
    """
    A named conversation thread between a user and a specific repository.
    One repository can have many chat sessions (e.g. 'Authentication Flow', 'API Structure').
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_sessions')
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='chat_sessions')
    title = models.CharField(max_length=255, default='New Chat')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'[{self.repository.name}] {self.title}'


class ChatMessage(models.Model):
    """
    A single turn in a ChatSession. Role is either 'user' or 'assistant'.
    Assistant messages carry the sources (code chunks) used to generate the response.
    """

    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    # JSON list of source references: [{file_path, symbol_name, symbol_type, start_line, end_line}]
    sources = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'[{self.role}] {self.content[:60]}...'
