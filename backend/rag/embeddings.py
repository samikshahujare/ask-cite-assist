"""OpenAI embeddings wrapper (text-embedding-3-small, 1536 dims)."""
from __future__ import annotations

from typing import List
import numpy as np

from agents.llm import get_client
from config import settings

EMBED_DIM = 1536  # text-embedding-3-small


def embed_texts(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, EMBED_DIM), dtype="float32")
    client = get_client()
    # Batch in groups of 100 to be safe
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