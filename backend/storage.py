"""Simple JSONL-backed persistence for sessions + metrics. Avoids needing a DB."""
from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List

from config import settings

_LOCK = threading.Lock()


def _sessions_path() -> Path:
    return settings.data_path / "sessions.jsonl"


def _metrics_path() -> Path:
    return settings.data_path / "metrics.jsonl"


def save_session(record: Dict[str, Any]) -> str:
    sid = record.get("id") or uuid.uuid4().hex[:10]
    record["id"] = sid
    record["created_at"] = record.get("created_at") or int(time.time())
    with _LOCK, _sessions_path().open("a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return sid


def list_sessions(limit: int = 50) -> List[Dict[str, Any]]:
    p = _sessions_path()
    if not p.exists():
        return []
    with p.open("r", encoding="utf-8") as f:
        rows = [json.loads(l) for l in f if l.strip()]
    rows.sort(key=lambda r: r.get("created_at", 0), reverse=True)
    return rows[:limit]


def append_metric(m: Dict[str, Any]):
    m["ts"] = int(time.time())
    with _LOCK, _metrics_path().open("a", encoding="utf-8") as f:
        f.write(json.dumps(m) + "\n")


def read_metrics() -> List[Dict[str, Any]]:
    p = _metrics_path()
    if not p.exists():
        return []
    with p.open("r", encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]