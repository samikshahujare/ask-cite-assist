"""FastAPI entrypoint: /upload /research /history /metrics /docs (auto)."""
from __future__ import annotations

import json
import time
from typing import List

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from config import settings
from rag.ingest import ingest_pdf_bytes
from rag.vectorstore import get_store
from agents.graph import get_graph
from agents.schemas import GraphState, ResearchMetrics
from storage import save_session, list_sessions, append_metric, read_metrics

app = FastAPI(title="Agentic AI Research Assistant", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": "Agentic AI Research Assistant", "status": "ok", "docs": "/docs"}


@app.get("/health")
def health():
    s = get_store().stats()
    return {"status": "ok", "openai_configured": bool(settings.OPENAI_API_KEY), **s}


# ---------- /upload ----------

@app.post("/upload")
async def upload(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "No files uploaded")
    out = []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            out.append({"filename": f.filename, "error": "not a PDF"})
            continue
        data = await f.read()
        try:
            res = ingest_pdf_bytes(f.filename, data)
            out.append(res)
        except Exception as e:
            out.append({"filename": f.filename, "error": str(e)})
    return {"results": out, "stats": get_store().stats()}


@app.get("/documents")
def list_documents():
    return {"documents": get_store().list_docs(), "stats": get_store().stats()}


# ---------- /research (SSE stream) ----------

class ResearchRequest(BaseModel):
    query: str
    session_id: str | None = None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/research")
def research(req: ResearchRequest):
    if not req.query.strip():
        raise HTTPException(400, "query is required")

    def gen():
        t0 = time.time()
        state = GraphState(query=req.query)
        try:
            yield _sse("agent_step", {"step": "planner", "status": "start"})
            from agents.planner import run_planner
            state.plan = run_planner(state.query)
            yield _sse("agent_step", {"step": "planner", "status": "done", "output": state.plan.model_dump()})

            yield _sse("agent_step", {"step": "researcher", "status": "start"})
            from agents.researcher import run_researcher
            res = run_researcher(state.plan)
            state.chunks = res.chunks
            yield _sse("agent_step", {"step": "researcher", "status": "done", "count": len(state.chunks)})
            yield _sse("chunks", {"chunks": [c.model_dump() for c in state.chunks]})

            yield _sse("agent_step", {"step": "critic", "status": "start"})
            from agents.critic import run_critic
            state.critic = run_critic(state.query, state.chunks)
            yield _sse("agent_step", {"step": "critic", "status": "done", "output": state.critic.model_dump()})

            yield _sse("agent_step", {"step": "writer", "status": "start"})
            from agents.writer import run_writer
            state.answer = run_writer(state.query, state.chunks)
            yield _sse("agent_step", {"step": "writer", "status": "done"})

            latency_ms = int((time.time() - t0) * 1000)
            cited_ids = {c.chunk_id for c in state.answer.citations}
            cited_chunks = [c for c in state.chunks if c.chunk_id in cited_ids]
            confidence = (
                sum(c.score for c in cited_chunks) / len(cited_chunks)
                if cited_chunks else 0.0
            )
            metrics = ResearchMetrics(
                latency_ms=latency_ms,
                retrieval_count=len(state.chunks),
                citation_count=len(state.answer.citations),
                confidence=round(float(confidence), 3),
                hallucination_risk=state.critic.hallucination_risk,
                coverage_score=state.critic.coverage_score,
            )

            final = {
                "query": state.query,
                "answer_markdown": state.answer.markdown,
                "citations": [c.model_dump() for c in state.answer.citations],
                "chunks": [c.model_dump() for c in state.chunks],
                "metrics": metrics.model_dump(),
            }

            sid = save_session({"query": state.query, **final})
            append_metric({"session_id": sid, **metrics.model_dump()})
            final["session_id"] = sid

            yield _sse("final", final)
        except Exception as e:
            yield _sse("error", {"message": str(e)})

    return StreamingResponse(gen(), media_type="text/event-stream")


# ---------- /history ----------

@app.get("/history")
def history():
    return {"sessions": list_sessions(100)}


# ---------- /metrics ----------

@app.get("/metrics")
def metrics():
    rows = read_metrics()
    if not rows:
        return {"count": 0, "latency_p50_ms": 0, "latency_p95_ms": 0,
                "avg_citation_count": 0, "avg_confidence": 0, "avg_coverage": 0,
                "hallucination_risk_distribution": {"low": 0, "medium": 0, "high": 0}}

    lat = sorted(r["latency_ms"] for r in rows)
    def pct(p):
        i = max(0, min(len(lat) - 1, int(len(lat) * p) - 1))
        return lat[i]
    dist = {"low": 0, "medium": 0, "high": 0}
    for r in rows:
        dist[r.get("hallucination_risk", "medium")] = dist.get(r.get("hallucination_risk", "medium"), 0) + 1

    return {
        "count": len(rows),
        "latency_p50_ms": pct(0.5),
        "latency_p95_ms": pct(0.95),
        "avg_citation_count": round(sum(r["citation_count"] for r in rows) / len(rows), 2),
        "avg_confidence": round(sum(r["confidence"] for r in rows) / len(rows), 3),
        "avg_coverage": round(sum(r["coverage_score"] for r in rows) / len(rows), 3),
        "hallucination_risk_distribution": dist,
    }