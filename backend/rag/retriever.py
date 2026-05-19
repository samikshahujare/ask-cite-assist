"""Top-k retrieval against the FAISS store, returning typed RetrievedChunk objects."""
from __future__ import annotations

from typing import List

from agents.schemas import RetrievedChunk
from .embeddings import embed_query
from .vectorstore import get_store


def retrieve(query: str, k: int = 5) -> List[RetrievedChunk]:
    qv = embed_query(query)
    hits = get_store().search(qv, k=k)
    return [
        RetrievedChunk(
            chunk_id=h["chunk_id"],
            doc_id=h["doc_id"],
            filename=h["filename"],
            page=h["page"],
            text=h["text"],
            score=float(h["score"]),
            source="pdf",
        )
        for h in hits
    ]