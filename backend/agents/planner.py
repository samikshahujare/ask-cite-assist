"""Planner agent: rewrites a user question into a retrieval-friendly query."""
from __future__ import annotations

from .schemas import PlannerOutput
from .llm import chat_json

SYSTEM = """You are the PLANNER agent in a research assistant.
Your job: take a user's natural-language research question and produce:
  1. retrieval_query: a dense, keyword-rich rewriting optimized for vector search
     over a corpus of academic PDFs.
  2. sub_questions: 1-4 atomic sub-questions that, answered together, fully cover the query.
  3. needs_web_search: true ONLY if the query clearly requires very recent
     information (news, dates after the likely training cutoff). Default false.

Return strictly JSON matching this schema:
{"retrieval_query": str, "sub_questions": [str], "needs_web_search": bool}
"""


def run_planner(query: str) -> PlannerOutput:
    return chat_json(SYSTEM, f"User query:\n{query}", PlannerOutput)