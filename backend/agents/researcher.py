"""Researcher agent: retrieves chunks from FAISS, optionally augments with Tavily web search."""
from __future__ import annotations

from typing import List

from .schemas import PlannerOutput, ResearcherOutput, RetrievedChunk
from rag.retriever import retrieve
from config import settings


def _web_search(query: str, k: int = 3) -> List[RetrievedChunk]:
    if not settings.TAVILY_API_KEY:
        return []
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        res = client.search(query=query, max_results=k, search_depth="basic")
        out: List[RetrievedChunk] = []
        for i, r in enumerate(res.get("results", [])):
            out.append(RetrievedChunk(
                chunk_id=f"web-{i}",
                doc_id="web",
                filename=r.get("title", "Web result")[:80],
                page=0,
                text=r.get("content", ""),
                score=float(r.get("score", 0.0)),
                source="web",
                url=r.get("url"),
            ))
        return out
    except Exception as e:
        print(f"[researcher] Tavily failed: {e}")
        return []


def run_researcher(plan: PlannerOutput) -> ResearcherOutput:
    chunks = retrieve(plan.retrieval_query, k=settings.RETRIEVAL_TOP_K)
    if plan.needs_web_search:
        chunks = chunks + _web_search(plan.retrieval_query)
    return ResearcherOutput(chunks=chunks)