from django.db import models
from django.contrib.auth.models import User


class Repository(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='repositories')
    url = models.URLField(max_length=500)
    name = models.CharField(max_length=255, blank=True)
    owner = models.CharField(max_length=255, blank=True)
    default_branch = models.CharField(max_length=100, blank=True)
    branches = models.JSONField(default=list, blank=True)
    languages = models.JSONField(default=list, blank=True)
    file_count = models.IntegerField(default=0)
    folder_count = models.IntegerField(default=0)
    last_commit_date = models.DateTimeField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True)
    recent_commits = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Phase 2 — AI Knowledge Indexing
    # is_indexed is set to True only after the explicit POST /index/ completes successfully.
    # Chat will NOT auto-index; it checks this flag and returns a 409 if not yet indexed.
    is_indexed = models.BooleanField(default=False)
    index_status = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="'indexing' | 'indexed' | 'failed'"
    )
    index_error = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'repositories'

    def __str__(self):
        return f"{self.owner}/{self.name} ({self.status})"


class ChatSession(models.Model):
    """
    A named conversation thread between a user and a repository.
    One repository can have many sessions (e.g. 'Authentication Flow', 'API Structure').
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
    A single message turn within a ChatSession.
    role: 'user' | 'assistant'
    sources: JSON list of {file_path, symbol_name, symbol_type, start_line, end_line}
             populated for assistant messages only.
    """
    ROLE_USER = 'user'
    ROLE_ASSISTANT = 'assistant'
    ROLE_CHOICES = [
        (ROLE_USER, 'User'),
        (ROLE_ASSISTANT, 'Assistant'),
    ]

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=12, choices=ROLE_CHOICES)
    content = models.TextField()
    # Populated for assistant messages: list of source chunk references
    sources = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'[{self.role}] {self.content[:60]}'
