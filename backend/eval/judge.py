"""LLM-as-judge using GPT-4o-mini. Scores faithfulness and citation accuracy 0..1."""
from __future__ import annotations

from pydantic import BaseModel, Field
from agents.llm import chat_json


class JudgeScore(BaseModel):
    faithfulness: float = Field(ge=0.0, le=1.0)
    citation_accuracy: float = Field(ge=0.0, le=1.0)
    rationale: str = ""


SYSTEM = """You are an evaluation judge. Score an answer for FAITHFULNESS to the
provided passages (0..1) and CITATION_ACCURACY (0..1: do [n] citations actually
point to passages that support the claim?). Be strict.

Return strictly JSON:
{"faithfulness": float, "citation_accuracy": float, "rationale": str}
"""


def judge(question: str, answer: str, passages: list[str]) -> JudgeScore:
    p = "\n\n".join(f"[{i+1}] {t[:600]}" for i, t in enumerate(passages))
    user = f"QUESTION:\n{question}\n\nANSWER:\n{answer}\n\nPASSAGES:\n{p}"
    return chat_json(SYSTEM, user, JudgeScore, model="gpt-4o-mini")