# Agentic AI Research Assistant with Evaluation Framework

Multi-agent RAG over your PDFs. **Planner → Researcher → Critic → Writer** pipeline,
grounded markdown answers with `[n]` citations, live evaluation dashboard.

- **Frontend**: React + TypeScript + Tailwind + shadcn/ui (TanStack Start) — deploys to Vercel
- **Backend**: FastAPI + Pydantic + LangGraph + FAISS + PyMuPDF + OpenAI — deploys to Render/Railway/Docker

## What you need to do

1. Get an **OpenAI API key** at https://platform.openai.com/api-keys
2. (Optional) Get a **Tavily API key** at https://tavily.com for web-search fallback
3. Run the backend, run the frontend, point one at the other (instructions below)

You only fill in `.env` and `VITE_API_URL`. Everything else is wired.

---

## Run the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env → paste your OPENAI_API_KEY (and TAVILY_API_KEY if you have one)

# (optional) preload ~50 arXiv PDFs into data/pdfs/
python scripts/scrape_pdfs.py

uvicorn app:app --reload --port 8000
```

Backend is now live at http://localhost:8000. Swagger UI at `/docs`.

## Run the frontend

```bash
# from repo root
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Open the printed URL, drop PDFs in the right panel, ask a question.

## Run the evaluation harness

```bash
cd backend
python eval/run_eval.py        # 100 questions, GPT-4o-mini judges faithfulness + citation accuracy
# writes eval/results.json
```

Live aggregates also stream into the **Evaluation** tab in the UI as you query.

## Deploy

- **Frontend → Vercel**: import this repo, set `VITE_API_URL` to your backend URL.
- **Backend → Render**: New Web Service → root dir `backend` → Docker → env vars `OPENAI_API_KEY`, `TAVILY_API_KEY` (optional), `ALLOWED_ORIGINS=https://your-frontend.vercel.app`.

## API

| Method | Path         | Purpose                                                |
|--------|--------------|--------------------------------------------------------|
| POST   | `/upload`    | Multipart PDFs → parse, chunk, embed, upsert in FAISS |
| POST   | `/research`  | `{query}` → SSE stream of agent steps + final answer  |
| GET    | `/documents` | List indexed documents                                 |
| GET    | `/history`   | Past sessions                                          |
| GET    | `/metrics`   | Aggregate p50/p95 latency, citations, confidence       |

See `ARCHITECTURE_DIAGRAM.md` and `SYSTEM_FLOW.md` for diagrams and request lifecycle.