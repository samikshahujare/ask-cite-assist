# System Flow — End-to-End Request Lifecycle

## 1. Uploading a PDF

```
User drags file
   │
   ▼  POST /upload (multipart)
FastAPI receives bytes
   │
   ▼  PyMuPDF: fitz.open(stream=data)
for each page → page.get_text("text")
   │
   ▼  tiktoken: split into 500-token chunks, 50-token overlap
   ▼  OpenAI: text-embedding-3-small → 1536-dim vectors
   ▼  L2-normalize each vector
   ▼  FAISS IndexFlatIP.add(vectors); append metadata to meta.jsonl
   ▼  Persist index.faiss + meta.jsonl
Response: {doc_id, chunks_added, stats}
```

## 2. Asking a research question

```
User submits query in chat
   │
   ▼  POST /research {query}  (Server-Sent Events response)
   │
   ▼  Planner agent (OpenAI, JSON mode → PlannerOutput)
      emit:  event: agent_step  data: {step:"planner", status:"done", output:{...}}
   │
   ▼  Researcher agent
      • embed(retrieval_query)
      • FAISS.search(top_k=5) → RetrievedChunk[]
      • if needs_web_search: Tavily fallback
      emit:  event: chunks  data: {chunks:[...]}
   │
   ▼  Critic agent (OpenAI, JSON mode → CriticOutput)
      grounded?, coverage_score, hallucination_risk
   │
   ▼  Writer agent (OpenAI text)
      writes markdown with [n] citations
      regex-detects which [n] were actually used → Citation[]
   │
   ▼  Compute metrics (latency_ms, retrieval_count, citation_count,
                       confidence = avg cosine of cited chunks,
                       hallucination_risk, coverage_score)
   ▼  Persist session + metric to JSONL
   ▼  emit:  event: final  data: ResearchFinal
```

The frontend reads these SSE events live and updates the agent-step pills,
chunks list, answer markdown, citations, and metric cards in real time.

## 3. Evaluation

- **Live**: every `/research` call writes one row to `data/metrics.jsonl`.
  The Evaluation tab polls `/metrics` and shows p50/p95 latency, avg confidence,
  avg citations, hallucination-risk distribution.

- **Offline (LLM-as-judge)**: `python eval/run_eval.py` runs the 100-question
  set, calls GPT-4o-mini as a judge, and scores each answer for
  **faithfulness** (0..1) and **citation accuracy** (0..1). Output is
  `eval/results.json`. Use this to compare retrieval changes (e.g., chunk size,
  top-k, re-ranker) before/after.

## 4. Why each component

| Component   | Why                                                                       |
|-------------|---------------------------------------------------------------------------|
| **Planner**    | LLMs retrieve better when given keyword-rich queries, not chatty ones. |
| **Researcher** | Decouples retrieval (deterministic) from generation (probabilistic).   |
| **Critic**     | Cheap second-pass quality gate; surfaces hallucination risk to the UI. |
| **Writer**     | One responsibility: write grounded prose with `[n]` citations.         |
| **Pydantic**   | Validates every LLM JSON before the next node runs. Fail loudly, early. |
| **FAISS**      | Local, zero-ops vector store. Pluggable to HNSW for scale.              |
| **SSE**        | The user sees progress per agent, not a 15-second blank screen.        |