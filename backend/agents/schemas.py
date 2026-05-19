"""Pydantic schemas for every agent's input/output. Strict typing keeps the
LangGraph workflow predictable and makes it easy to validate the LLM JSON
responses before the next agent runs."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class RetrievedChunk(BaseModel):
    chunk_id: str
    doc_id: str
    filename: str
    page: int
    text: str
    score: float
    source: str = "pdf"  # "pdf" | "web"
    url: Optional[str] = None


class Citation(BaseModel):
    n: int
    chunk_id: str
    filename: str
    page: int
    snippet: str
    url: Optional[str] = None


# ---- Agent outputs (validated against LLM JSON) ----

class PlannerOutput(BaseModel):
    retrieval_query: str = Field(..., description="A keyword-rich query optimized for vector search")
    sub_questions: List[str] = Field(default_factory=list)
    needs_web_search: bool = False


class ResearcherOutput(BaseModel):
    chunks: List[RetrievedChunk]


class CriticOutput(BaseModel):
    grounded: bool
    coverage_score: float = Field(ge=0.0, le=1.0)
    hallucination_risk: str  # "low" | "medium" | "high"
    notes: str = ""


class WriterOutput(BaseModel):
    markdown: str
    citations: List[Citation]


class ResearchMetrics(BaseModel):
    latency_ms: int
    retrieval_count: int
    citation_count: int
    confidence: float  # avg cosine similarity of cited chunks
    hallucination_risk: str
    coverage_score: float


class ResearchResponse(BaseModel):
    query: str
    answer_markdown: str
    citations: List[Citation]
    chunks: List[RetrievedChunk]
    metrics: ResearchMetrics


# ---- Graph state ----

class GraphState(BaseModel):
    """Single source of truth flowing through the LangGraph DAG."""
    query: str
    plan: Optional[PlannerOutput] = None
    chunks: List[RetrievedChunk] = Field(default_factory=list)
    critic: Optional[CriticOutput] = None
    answer: Optional[WriterOutput] = None

    class Config:
        arbitrary_types_allowed = True