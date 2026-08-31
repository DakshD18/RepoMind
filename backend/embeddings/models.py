"""
Embeddings Models — CodeChunk stores AST-parsed code segments with vector embeddings.
"""

from django.db import models
from repositories.models import Repository


class CodeChunk(models.Model):
    """
    A parsed segment of source code from a repository.

    Stores:
    - The source repository (strict isolation: every search is scoped by this FK)
    - File path relative to the repository root
    - Symbol name (function, class, method identifier), if extracted via AST
    - Symbol type (function, class, method, module, block)
    - Line range for the chunk in the original file
    - The actual source code content
    - The 384-dimensional embedding vector stored as a JSON array
      (pgvector native column applied via migration using raw SQL)
    """

    SYMBOL_TYPES = [
        ('function', 'Function'),
        ('class', 'Class'),
        ('method', 'Method'),
        ('module', 'Module'),
        ('block', 'Block'),
    ]

    repository = models.ForeignKey(
        Repository,
        on_delete=models.CASCADE,
        related_name='code_chunks',
    )
    file_path = models.CharField(max_length=1000)
    symbol_name = models.CharField(max_length=255, blank=True, default='')
    symbol_type = models.CharField(
        max_length=20,
        choices=SYMBOL_TYPES,
        default='block',
    )
    start_line = models.IntegerField(default=0)
    end_line = models.IntegerField(default=0)
    content = models.TextField()
    # Embedding stored as a JSON list; pgvector column applied via raw SQL migration
    embedding = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['file_path', 'start_line']
        indexes = [
            models.Index(fields=['repository']),
        ]

    def __str__(self):
        symbol = f' — {self.symbol_name}' if self.symbol_name else ''
        return f'{self.file_path}:{self.start_line}-{self.end_line}{symbol}'
