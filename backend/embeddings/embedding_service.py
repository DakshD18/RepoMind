"""
Embedding Service (Phase 2).

Uses SentenceTransformers (all-MiniLM-L6-v2) to generate 384-dimensional
vector embeddings for code chunks and user queries.

Single provider by design — no complex provider abstraction at this stage.
Uses lazy loading so Django startup is not delayed by model download.
"""

import logging
import os
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

_MODEL_NAME = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
_EMBEDDING_DIM = int(os.getenv('EMBEDDING_DIMENSION', '384'))

_model = None   # lazily loaded


def _get_model():
    """Return the SentenceTransformer model, loading it on first call."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info('Loading SentenceTransformer model: %s', _MODEL_NAME)
            _model = SentenceTransformer(_MODEL_NAME)
            logger.info('Model loaded successfully.')
        except Exception as exc:
            logger.error('Failed to load SentenceTransformer: %s', exc)
            raise RuntimeError(f'Embedding model unavailable: {exc}') from exc
    return _model


def embed_text(text: str) -> list[float]:
    """
    Generate a 384-dimensional embedding for a single text string.
    Returns a Python list of floats suitable for JSON storage or pgvector.
    """
    model = _get_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def embed_batch(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """
    Generate embeddings for a list of texts in batches.
    Returns a list of 384-dim float lists.
    """
    if not texts:
        return []
    model = _get_model()
    vecs = model.encode(texts, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False)
    return [v.tolist() for v in vecs]


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Compute cosine similarity between two normalized vectors.
    Since SentenceTransformer uses normalize_embeddings=True, this is just a dot product.
    """
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    return float(np.dot(a, b))
