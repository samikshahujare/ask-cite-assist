
# Agentic AI Research Assistant — Build Plan

## Important: how this will run

Lovable's sandbox runs **Node/Cloudflare Workers**, not Python. It cannot execute FastAPI, LangGraph, FAISS or PyMuPDF. Since you want that exact stack preserved, I will:

1. **Build the React frontend live here** (you see it in the preview, deploy to Vercel from Lovable's Publish).
2. **Write the full Python backend as source files inside `/backend/`** in this same repo. Lovable won't run it, but every file will be there, production-quality, ready for you to `pip install` and `uvicorn app:app --reload` locally, or deploy to Render/Railway with the included Dockerfile.

You will end up with **one repo, two deployables** — exactly the architecture in your brief.

---

## What you get

### Frontend (`/src` — built and previewable in Lovable)
- React + TypeScript + Tailwind + shadcn/ui (already scaffolded; I'll keep TanStack Start router — it's still React+TS, deploys to Vercel)
- Dark Perplexity/Notion aesthetic, responsive
- **Pages/components**
  - Sidebar nav (Workspace / History / Documents / Evaluation / Settings)
  - **Upload panel**: drag-drop, multi-file, per-file progress, document list with delete
  - **Chat workspace**: streaming answer, markdown rendering, citation cards `[1] filename · p.4`, expandable retrieved chunks under each answer, agent-step indicator (Planner → Researcher → Critic → Writer)
  - **Session history**: list of past Q&As, click to reload
  - **Evaluation dashboard**: cards for latency (p50/p95), citation count, confidence (avg cosine), retrieval count, hallucination risk badge, faithfulness/citation-accuracy scores from LLM-judge
  - **Download report**: button to export the current answer as `.md` or `.pdf`
- API client reads `VITE_API_URL` (your deployed backend URL)

### Backend (`/backend` — source code only, you run it)
```
backend/
  app.py                    # FastAPI app, CORS, routes /upload /research /history /metrics
  config.py                 # env loading (OPENAI_API_KEY, TAVILY_API_KEY, etc.)
  requirements.txt
  Dockerfile
  .env.example              # placeholders for keys
  agents/
    schemas.py              # Pydantic models for every agent I/O
    planner.py              # rewrites query → retrieval query + sub-questions
    researcher.py           # FAISS retrieval + optional Tavily web search
    critic.py               # validates citations / grounding
    writer.py               # final markdown w/ [n] citations
    graph.py                # LangGraph wiring: Planner→Researcher→Critic→Writer (deterministic, no loops)
  rag/
    ingest.py               # PyMuPDF parse → 500-token chunks, 50 overlap
    embeddings.py           # text-embedding-3-small wrapper
    vectorstore.py          # FAISS index load/save (/data/index.faiss + meta.jsonl)
    retriever.py            # top-k cosine retrieval w/ metadata
  eval/
    judge.py                # GPT-4o-mini LLM-as-judge: faithfulness 0–1, citation_accuracy 0–1
    run_eval.py             # runs the 100-question set, writes eval/results.json
    questions.jsonl         # 100 Q&A pairs (HotpotQA dev subset bundled)
  scripts/
    scrape_pdfs.py          # fetches ~50 arXiv PDFs into /data/pdfs
  data/
    pdfs/                   # (gitignored, scrape script populates)
    index.faiss             # (gitignored, built on first upload/ingest)
README.md
ARCHITECTURE_DIAGRAM.md     # mermaid system diagram + LangGraph flow
SYSTEM_FLOW.md              # request lifecycle, beginner-friendly
```

### API contract (stable — frontend talks to this)
- `POST /upload` — multipart PDFs → parse, chunk, embed, upsert into FAISS → returns `{doc_ids, chunks_added}`
- `POST /research` — `{query, session_id?}` → SSE stream of `{type: "agent_step"|"chunk"|"citation"|"final", ...}` ending with the final markdown + metrics
- `GET /history` — list of past sessions
- `GET /metrics` — aggregate latency p50/p95, citation count, faithfulness, etc.

### Multi-agent workflow (deterministic, no autonomous loops)
```text
User Query
   ↓
Planner   (OpenAI)  → retrieval_query + sub_questions     [Pydantic]
   ↓
Researcher          → FAISS top-k (+ optional Tavily)      [Pydantic]
   ↓
Critic    (OpenAI)  → grounded? citations valid? score     [Pydantic]
   ↓
Writer    (OpenAI)  → final markdown w/ [n] citations      [Pydantic]
   ↓
Response + metrics (latency, citation_count, confidence, hallucination_risk)
```

---

## What you need to do (step by step)

### One-time setup
1. **Get API keys** (free tiers fine for portfolio):
   - OpenAI: https://platform.openai.com/api-keys
   - Tavily (optional, for web search): https://tavily.com — free tier
2. **Frontend env**: in Lovable, after I'm done, set `VITE_API_URL` to wherever your backend will live (e.g. `http://localhost:8000` for local dev, or your Render URL).

### Run the backend locally
```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# open .env, paste OPENAI_API_KEY=...   TAVILY_API_KEY=... (optional)
python scripts/scrape_pdfs.py          # optional: pre-load 50 arXiv PDFs
uvicorn app:app --reload --port 8000
```
Backend now live at `http://localhost:8000`. Swagger docs at `/docs`.

### Run the frontend locally (or use Lovable preview)
- In Lovable: just open the preview — it points at `VITE_API_URL` from project env.
- Locally:
```bash
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

### Run evaluation
```bash
cd backend
python eval/run_eval.py          # runs 100 Q&A, GPT-4o-mini judges, writes eval/results.json
```
Numbers also appear live in the frontend Evaluation Dashboard via `/metrics`.

### Deploy
- **Frontend → Vercel**: click Publish in Lovable, or `vercel` CLI from repo root. Set `VITE_API_URL` to your backend URL in Vercel env.
- **Backend → Render**: New Web Service → connect repo → root dir `backend` → use included Dockerfile. Add `OPENAI_API_KEY` and `TAVILY_API_KEY` in Render env. Free tier works.

---

## What I will NOT do
- Not build mock backend code in TypeScript — your spec keeps Python.
- Not add autonomous agent loops or self-improving agents (per your brief).
- Not invent API keys or hide them — `.env.example` has placeholders, you fill them.
- Not add authentication (you said it's not required).

---

## Build order (single batch, no further questions needed)
1. Scaffold `/backend` with all Python files, requirements, Dockerfile, .env.example
2. Write Pydantic schemas, 4 agents, LangGraph wiring
3. Write RAG pipeline (PyMuPDF ingest, FAISS store, retriever, OpenAI embeddings)
4. Write FastAPI app with the 4 endpoints + SSE streaming
5. Write eval harness + 100-question seed set + scrape script
6. Build the React frontend: sidebar, upload, chat workspace, citations, history, eval dashboard, MD/PDF export
7. Write `README.md`, `ARCHITECTURE_DIAGRAM.md` (mermaid), `SYSTEM_FLOW.md`
8. Hand back with a clear "what to do now" checklist

After you approve this plan I'll execute all of it. Confirm and I'll start building.
