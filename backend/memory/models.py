"""
CommitMemory model (Phase 3 — Repository Memory).

Stores individual git commits extracted from a repository's GitHub history,
along with vector embeddings for RAG retrieval. Uses the same 384-dimensional
all-MiniLM-L6-v2 embeddings as CodeChunk, enabling unified vector search
across code AND commit history.
"""

from django.db import models
from repositories.models import Repository


class CommitMemory(models.Model):
    """
    A single git commit extracted from the repository's history.
    Stores commit metadata + an embedded vector for RAG retrieval.
    """
    repository = models.ForeignKey(
        Repository,
        on_delete=models.CASCADE,
        related_name='commit_memories',
    )

    # Git metadata
    commit_sha = models.CharField(max_length=40)
    author_name = models.CharField(max_length=255)
    author_email = models.CharField(max_length=255, blank=True)
    committed_date = models.DateTimeField()
    message = models.TextField()  # Full commit message

    # Extracted structured data
    files_changed = models.JSONField(default=list)   # [{filename, status, additions, deletions}]
    stats = models.JSONField(default=dict)           # {total_additions, total_deletions, files_changed_count}

    # Embedding
    embedding_text = models.TextField(blank=True)    # Structured text sent to SentenceTransformers
    embedding = models.JSONField(null=True, blank=True)  # 384-dim vector (same model as CodeChunk)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-committed_date']
        unique_together = ['repository', 'commit_sha']
        indexes = [
            models.Index(fields=['repository']),
            models.Index(fields=['repository', 'committed_date']),
            models.Index(fields=['repository', 'author_name']),
        ]

    def __str__(self):
        return f'[{self.commit_sha[:7]}] {self.message[:60]}'
