"""FAISS vector store with JSONL sidecar metadata. Cosine via inner product on L2-normalized vectors."""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Dict, List

import faiss
import numpy as np

from config import settings
from .embeddings import EMBED_DIM

_LOCK = threading.Lock()


class VectorStore:
    def __init__(self):
        self.index_path = settings.data_path / "index.faiss"
        self.meta_path = settings.data_path / "meta.jsonl"
        self.index: faiss.Index = self._load_index()
        self.meta: List[Dict[str, Any]] = self._load_meta()

    def _load_index(self) -> faiss.Index:
        if self.index_path.exists():
            return faiss.read_index(str(self.index_path))
        return faiss.IndexFlatIP(EMBED_DIM)

    def _load_meta(self) -> List[Dict[str, Any]]:
        if not self.meta_path.exists():
            return []
        with self.meta_path.open("r", encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    def _persist(self):
        faiss.write_index(self.index, str(self.index_path))
        with self.meta_path.open("w", encoding="utf-8") as f:
            for m in self.meta:
                f.write(json.dumps(m) + "\n")

    def add(self, vectors: np.ndarray, metadatas: List[Dict[str, Any]]):
        assert vectors.shape[0] == len(metadatas)
        with _LOCK:
            self.index.add(vectors)
            self.meta.extend(metadatas)
            self._persist()

    def search(self, query_vec: np.ndarray, k: int = 5) -> List[Dict[str, Any]]:
        if self.index.ntotal == 0:
            return []
        q = query_vec.reshape(1, -1).astype("float32")
        scores, idxs = self.index.search(q, min(k, self.index.ntotal))
        out: List[Dict[str, Any]] = []
        for score, i in zip(scores[0], idxs[0]):
            if i < 0 or i >= len(self.meta):
                continue
            m = dict(self.meta[i])
            m["score"] = float(score)
            out.append(m)
        return out

    def stats(self) -> Dict[str, int]:
        docs = {m.get("doc_id") for m in self.meta}
        return {"chunks": self.index.ntotal, "documents": len(docs)}

    def list_docs(self) -> List[Dict[str, Any]]:
        seen: Dict[str, Dict[str, Any]] = {}
        for m in self.meta:
            d = m.get("doc_id")
            if d not in seen:
                seen[d] = {"doc_id": d, "filename": m.get("filename"), "chunks": 0}
            seen[d]["chunks"] += 1
        return list(seen.values())


_store: VectorStore | None = None


def get_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store