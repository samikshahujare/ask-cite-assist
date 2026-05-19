"""Embeddings wrapper. Supports OpenAI-compatible API or local sentence-transformers."""
from __future__ import annotations

from typing import List
import numpy as np

from agents.llm import get_client
from config import settings

# Dim depends on provider. OpenAI text-embedding-3-small=1536, MiniLM-L6-v2=384.
EMBED_DIM = 384 if settings.EMBEDDING_PROVIDER == "local" else 1536

_local_model = None


def _get_local_model():
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        _local_model = SentenceTransformer(settings.LOCAL_EMBEDDING_MODEL)
    return _local_model


def embed_texts(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, EMBED_DIM), dtype="float32")
    if settings.EMBEDDING_PROVIDER == "local":
        model = _get_local_model()
        arr = np.array(model.encode(texts, show_progress_bar=False), dtype="float32")
    else:
        client = get_client()
        out: List[List[float]] = []
        BATCH = 100
        for i in range(0, len(texts), BATCH):
            chunk = texts[i:i + BATCH]
            resp = client.embeddings.create(model=settings.OPENAI_EMBEDDING_MODEL, input=chunk)
            out.extend([d.embedding for d in resp.data])
        arr = np.array(out, dtype="float32")
    # L2-normalize for cosine via inner product
    norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
    return arr / norms


def embed_query(text: str) -> np.ndarray:
    return embed_texts([text])[0]