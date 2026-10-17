"""
Health Dashboard Data Models for RepoMind Phase 5.

Stores:
- RepositoryHealthSnapshot: Dated snapshot of overall health score, grade, component breakdowns,
  metrics summary, findings summary, and optional AI summary.
- HealthFinding: Individual technical debt finding with exact location, severity, category,
  measured evidence, remediation recommendation, and stable tracking fingerprint.
"""

from django.db import models
from repositories.models import Repository


class RepositoryHealthSnapshot(models.Model):
    repository = models.ForeignKey(
        Repository,
        on_delete=models.CASCADE,
        related_name='health_snapshots',
    )
    commit_sha = models.CharField(max_length=40, db_index=True)
    overall_score = models.FloatField()
    grade = models.CharField(max_length=2)  # 'A+', 'A', 'B', 'C', 'D', 'F'

    # Component scores (each 0.0 - 100.0)
    # { complexity, maintainability, duplication, testing, documentation, dependencies }
    component_scores = models.JSONField(default=dict)

    # Detailed metrics summary
    # { total_files, total_loc, total_functions, avg_complexity, duplication_pct, ... }
    metrics_summary = models.JSONField(default=dict)

    # Findings counts by severity: { critical, high, medium, low, info, total }
    findings_summary = models.JSONField(default=dict)

    # Detailed file metrics list for file explorer table
    file_metrics = models.JSONField(default=list, blank=True)

    # Grounded AI Health Summary
    ai_summary = models.TextField(blank=True)
    ai_summary_available = models.BooleanField(default=False)
    ai_recommended_actions = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['repository', '-created_at']),
            models.Index(fields=['repository', 'commit_sha']),
        ]

    def __str__(self):
        return f"[{self.repository.name}] Score {self.overall_score} ({self.grade}) @ {self.commit_sha[:7]}"


class HealthFinding(models.Model):
    class Severity(models.TextChoices):
        CRITICAL = 'CRITICAL', 'Critical'
        HIGH = 'HIGH', 'High'
        MEDIUM = 'MEDIUM', 'Medium'
        LOW = 'LOW', 'Low'
        INFO = 'INFO', 'Info'

    class Category(models.TextChoices):
        COMPLEXITY = 'COMPLEXITY', 'Code Complexity'
        MAINTAINABILITY = 'MAINTAINABILITY', 'Maintainability & Size'
        DUPLICATION = 'DUPLICATION', 'Duplication'
        TESTING = 'TESTING', 'Testing & Coverage'
        DOCUMENTATION = 'DOCUMENTATION', 'Documentation'
        ARCHITECTURE = 'ARCHITECTURE', 'Architecture & Dependencies'

    snapshot = models.ForeignKey(
        RepositoryHealthSnapshot,
        on_delete=models.CASCADE,
        related_name='findings',
    )
    repository = models.ForeignKey(
        Repository,
        on_delete=models.CASCADE,
        related_name='health_findings',
    )

    finding_type = models.CharField(max_length=64, db_index=True)
    category = models.CharField(max_length=32, choices=Category.choices, db_index=True)
    severity = models.CharField(max_length=16, choices=Severity.choices, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField()

    # Exact file location
    file_path = models.CharField(max_length=500, db_index=True)
    start_line = models.IntegerField(null=True, blank=True)
    end_line = models.IntegerField(null=True, blank=True)
    symbol_name = models.CharField(max_length=255, blank=True)

    # Measurable evidence & recommendations
    evidence = models.JSONField(default=dict)
    recommendation = models.TextField()
    estimated_effort = models.CharField(
        max_length=20,
        default='MODERATE',
        help_text="'QUICK_FIX' (<30m) | 'MODERATE' (1-3h) | 'SIGNIFICANT' (>3h)"
    )
    is_effort_estimate = models.BooleanField(default=True)
    is_ai_inferred = models.BooleanField(default=False)

    # Stable fingerprint for tracking introduced vs resolved findings
    fingerprint = models.CharField(max_length=64, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['severity', 'file_path']
        indexes = [
            models.Index(fields=['snapshot', 'severity']),
            models.Index(fields=['repository', 'fingerprint']),
            models.Index(fields=['repository', 'category']),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.title} ({self.file_path})"
