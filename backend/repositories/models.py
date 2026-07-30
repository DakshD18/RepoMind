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

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'repositories'

    def __str__(self):
        return f"{self.owner}/{self.name} ({self.status})"
