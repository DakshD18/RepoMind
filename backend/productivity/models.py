"""
Productivity Models (Phase 6 — Productivity Intelligence).

Stores persistent analytical caches and grounded AI insights for
repository productivity queries, preventing expensive redundant recalculations
while supporting seamless cache invalidation as new commits are ingested.
"""

from django.db import models
from repositories.models import Repository


class ProductivityCache(models.Model):
    """
    Cached productivity metrics and AI insights for a repository
    over a specific time range and aggregation interval.
    """
    repository = models.ForeignKey(
        Repository,
        on_delete=models.CASCADE,
        related_name='productivity_caches',
    )
    time_range = models.CharField(max_length=20, default='30d')
    aggregation = models.CharField(max_length=20, default='daily')
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)

    # Cached JSON payloads
    calculated_metrics = models.JSONField(default=dict)
    ai_insights = models.JSONField(default=dict)

    # Invalidation metadata
    commits_count_at_generation = models.IntegerField(default=0)
    latest_commit_date_at_generation = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['repository', 'time_range', 'aggregation']),
            models.Index(fields=['repository', 'updated_at']),
        ]

    def __str__(self):
        return f"[{self.repository.name}] ProductivityCache ({self.time_range}, {self.aggregation})"
