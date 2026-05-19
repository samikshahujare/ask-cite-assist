"""Critic agent: scores whether the retrieved chunks actually cover the question."""
from __future__ import annotations

from .schemas import CriticOutput, RetrievedChunk
from .llm import chat_json

SYSTEM = """You are the CRITIC agent. Given a user question and a set of retrieved
passages, judge whether the passages contain enough grounded evidence to answer it.

Return strictly JSON:
{
  "grounded": bool,
  "coverage_score": float (0..1),
  "hallucination_risk": "low" | "medium" | "high",
  "notes": str
}

Rules:
- coverage_score reflects how well the passages cover the user's question.
- hallucination_risk = "high" if passages are off-topic or sparse, "low" if directly relevant.
- Be strict. Do not invent evidence.
"""


def run_critic(query: str, chunks: list[RetrievedChunk]) -> CriticOutput:
    passages = "\n\n".join(
        f"[{i+1}] ({c.filename} p.{c.page}) {c.text[:600]}" for i, c in enumerate(chunks)
    ) or "(no passages retrieved)"
    user = f"USER QUESTION:\n{query}\n\nRETRIEVED PASSAGES:\n{passages}"
    return chat_json(SYSTEM, user, CriticOutput)