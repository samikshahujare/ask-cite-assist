"""PDF ingestion: PyMuPDF → 500-token chunks (50 overlap) → embed → FAISS upsert."""
from __future__ import annotations

import hashlib
import uuid
from pathlib import Path
from typing import Iterable, List, Dict, Any

import fitz  # PyMuPDF
import tiktoken

from config import settings
from .embeddings import embed_texts
from .vectorstore import get_store

_enc = tiktoken.get_encoding("cl100k_base")


def _chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    toks = _enc.encode(text)
    out: List[str] = []
    i = 0
    while i < len(toks):
        window = toks[i:i + chunk_size]
        out.append(_enc.decode(window))
        if i + chunk_size >= len(toks):
            break
        i += chunk_size - overlap
    return out


def _hash_file(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()[:12]


def ingest_pdf_bytes(filename: str, data: bytes) -> Dict[str, Any]:
    """Parse a PDF file (bytes), chunk per page, embed, and upsert into FAISS.
    Returns {doc_id, filename, chunks_added}."""
    doc_id = _hash_file(data)
    store = get_store()

    # Skip if already ingested
    if any(m.get("doc_id") == doc_id for m in store.meta):
        return {"doc_id": doc_id, "filename": filename, "chunks_added": 0, "skipped": True}

    pdf = fitz.open(stream=data, filetype="pdf")
    texts: List[str] = []
    metas: List[Dict[str, Any]] = []

    for page_num, page in enumerate(pdf, start=1):
        page_text = page.get_text("text") or ""
        if not page_text.strip():
            continue
        for chunk in _chunk_text(page_text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP):
            if not chunk.strip():
                continue
            chunk_id = uuid.uuid4().hex[:10]
            texts.append(chunk)
            metas.append({
                "chunk_id": chunk_id,
                "doc_id": doc_id,
                "filename": filename,
                "page": page_num,
                "text": chunk,
            })

    if not texts:
        return {"doc_id": doc_id, "filename": filename, "chunks_added": 0}

    vecs = embed_texts(texts)
    store.add(vecs, metas)
    return {"doc_id": doc_id, "filename": filename, "chunks_added": len(texts)}


def ingest_pdf_paths(paths: Iterable[Path]) -> List[Dict[str, Any]]:
    results = []
    for p in paths:
        with open(p, "rb") as f:
            results.append(ingest_pdf_bytes(p.name, f.read()))
    return results