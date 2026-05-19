"""Writer agent: composes the final markdown answer with [n] citations."""
from __future__ import annotations

import re
from typing import List

from .schemas import Citation, RetrievedChunk, WriterOutput
from .llm import chat_text

SYSTEM = """You are the WRITER agent. Write a clear, well-structured markdown
answer to the user's question USING ONLY the numbered passages provided.

STRICT RULES:
- Cite every factual claim inline as [1], [2], etc. matching the passage numbers.
- Do NOT invent facts that aren't supported by the passages.
- If the passages don't answer the question, say so plainly.
- Use markdown headings, bullet points, and short paragraphs.
- Do not include a "Sources" section — the UI renders citations separately.
"""


def run_writer(query: str, chunks: List[RetrievedChunk]) -> WriterOutput:
    if not chunks:
        return WriterOutput(
            markdown="I couldn't find any relevant passages in the uploaded documents to answer this question. Try uploading more PDFs or rephrasing.",
            citations=[],
        )

    passages = "\n\n".join(
        f"[{i+1}] ({c.filename} p.{c.page}) {c.text}" for i, c in enumerate(chunks)
    )
    user = f"USER QUESTION:\n{query}\n\nPASSAGES:\n{passages}\n\nWrite the answer now."
    md = chat_text(SYSTEM, user)

    # Determine which citations were actually used
    used = set(int(n) for n in re.findall(r"\[(\d+)\]", md))
    citations: List[Citation] = []
    for i, c in enumerate(chunks, start=1):
        if i in used:
            citations.append(Citation(
                n=i,
                chunk_id=c.chunk_id,
                filename=c.filename,
                page=c.page,
                snippet=c.text[:240] + ("…" if len(c.text) > 240 else ""),
                url=c.url,
            ))
    return WriterOutput(markdown=md, citations=citations)