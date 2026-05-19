# Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│                    React + TS Frontend                        │
│ Workspace · Documents · History · Evaluation Dashboard        │
│  - drag-drop upload      - SSE streaming                      │
│  - markdown + citations  - expandable retrieved chunks        │
└──────────────┬────────────────────────────────────────────────┘
               │ HTTP / SSE (VITE_API_URL)
┌──────────────▼────────────────────────────────────────────────┐
│                   FastAPI Backend                              │
│ /upload   /research   /history   /metrics   /documents         │
└──────────────┬────────────────────────────────────────────────┘
               │
      ┌────────┴───────────────────────────┐
      ▼                                    ▼
 ┌──────────────┐                  ┌──────────────────┐
 │ RAG Pipeline │                  │  LangGraph DAG   │
 │ PyMuPDF →    │                  │ Planner          │
 │ chunk(500/50)│                  │   ↓              │
 │ → embed      │                  │ Researcher ──── FAISS ──── Tavily (opt)
 │ → FAISS      │                  │   ↓              │
 └──────────────┘                  │ Critic           │
                                   │   ↓              │
                                   │ Writer → MD + citations
                                   └──────────────────┘
```

## LangGraph workflow (deterministic, no loops)

```text
START
  │
  ▼
┌─────────┐   PlannerOutput
│ Planner │ ───────────────► retrieval_query, sub_questions, needs_web_search
└────┬────┘
     ▼
┌────────────┐  ResearcherOutput
│ Researcher │ ─────────────► top-k chunks from FAISS (+ optional Tavily)
└────┬───────┘
     ▼
┌────────┐ CriticOutput
│ Critic │ ─────────────────► grounded?, coverage_score, hallucination_risk
└────┬───┘
     ▼
┌────────┐ WriterOutput
│ Writer │ ─────────────────► markdown answer + [n] citations
└────┬───┘
     ▼
   END  → ResearchResponse {answer, citations, chunks, metrics}
```

Every agent's input/output is a **Pydantic model** (`backend/agents/schemas.py`),
so the JSON returned by the LLM is validated before the next node runs.

## Storage layout

```
backend/data/
  pdfs/           # raw PDFs (gitignored)
  index.faiss     # FAISS IndexFlatIP, 1536 dims (text-embedding-3-small, L2-normalized)
  meta.jsonl      # sidecar metadata: chunk_id, doc_id, filename, page, text
  sessions.jsonl  # past Q&A sessions (for /history)
  metrics.jsonl   # per-session metrics (for /metrics)
```

## Why FAISS `IndexFlatIP`?

- Vectors are L2-normalized → inner product == cosine similarity.
- For a portfolio-scale corpus (10k–100k chunks) exhaustive search is fast and trivially correct.
- Swap to HNSW (`IndexHNSWFlat`) by changing one line in `backend/rag/vectorstore.py` when scale demands it.