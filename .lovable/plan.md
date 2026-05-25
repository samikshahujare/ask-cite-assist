## Run & Deploy — Step by Step

You have two pieces: **Python backend** (FastAPI + LangGraph + FAISS) and **React frontend** (already live on Lovable preview). Run backend locally first, then deploy backend to Render, then point the frontend at it.

---

### PART A — Run locally (15 min)

**Prereqs:** Python 3.11+, Node 20+, Git, your OpenRouter key (`sk-or-v1-...`) and Tavily key (`tvly-...`).

**1. Clone your repo**
```bash
git clone https://github.com/samikshahujare/ask-cite-assist.git
cd ask-cite-assist/backend
```

**2. Create `.env` inside `backend/`**
```env
OPENAI_API_KEY=sk-or-v1-YOUR_OPENROUTER_KEY
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_CHAT_MODEL=meta-llama/llama-3.1-8b-instruct:free
EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
TAVILY_API_KEY=tvly-YOUR_TAVILY_KEY
CHUNK_SIZE=500
CHUNK_OVERLAP=50
RETRIEVAL_TOP_K=5
DATA_DIR=data
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
ALLOWED_ORIGIN_REGEX=https://.*\.(lovable\.app|lovableproject\.com)$
```

**3. Install Python deps** (use a venv)
```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```
First install downloads the MiniLM model (~90 MB) — that's normal.

**4. Scrape 50 arXiv PDFs**
```bash
python scripts/scrape_pdfs.py
```
Files land in `backend/data/pdfs/`.

**5. Build the FAISS index**
```bash
python -c "from rag.ingest import ingest_dir; ingest_dir('data/pdfs')"
```

**6. Start the API**
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```
Open `http://localhost:8000/docs` → try `/research?q=what+is+RAG`.

**7. (Optional) Run the eval harness**
```bash
python eval/run_eval.py
```
Writes `eval/results.json` with faithfulness + citation-accuracy scores.

**8. Point the Lovable frontend at your local backend** (only for local testing)
In the Lovable chat, ask: *"set VITE_API_URL to http://localhost:8000"*. The preview will hit your local API.

---

### PART B — Deploy backend to Render (10 min, free tier)

**1. Push to GitHub** — already done (`samikshahujare/ask-cite-assist`).

**2. Create a Render account** → https://render.com (sign in with GitHub).

**3. New Blueprint**
- Dashboard → **New +** → **Blueprint**
- Connect the `ask-cite-assist` repo
- Render reads `backend/render.yaml` and proposes a Web Service + 1 GB disk

**4. Set environment variables in Render UI** (the secret ones)
- `OPENAI_API_KEY` = your OpenRouter key
- `TAVILY_API_KEY` = your Tavily key
- (the rest are already in `render.yaml`)

**5. Click "Apply"** → Render builds (~5 min, downloads MiniLM during first deploy) → you get a URL like `https://ask-cite-assist.onrender.com`.

**6. One-time ingestion on Render** — open Render → your service → **Shell** tab → run:
```bash
python scripts/scrape_pdfs.py
python -c "from rag.ingest import ingest_dir; ingest_dir('data/pdfs')"
```
The FAISS index persists on the 1 GB disk across redeploys.

**7. Smoke test** — open `https://ask-cite-assist.onrender.com/docs` → call `/research?q=...`.

---

### PART C — Connect Lovable frontend to the live backend (2 min)

In the Lovable chat, paste:
> *"Set `VITE_API_URL` to `https://ask-cite-assist.onrender.com` and publish."*

Then click **Publish** (top right of the editor). Your frontend is live at `your-project.lovable.app` and talks to your Render backend.

---

### Notes & gotchas

- **Render free tier sleeps after 15 min idle** → first request after sleep takes ~30 s to wake. Fine for portfolio, not for production traffic.
- **OpenRouter free model is rate-limited** (~20 req/min). If eval fails midway, wait and re-run.
- **PDFs and FAISS index are NOT in Git** (gitignored). You must run the ingestion step on every fresh environment (local + Render).
- **If `/research` returns "no passages"**, ingestion didn't run — repeat step 5 (local) or step 6 (Render).
- **CORS already handles `*.lovable.app`** via `ALLOWED_ORIGIN_REGEX`, no extra config needed.

---

### What you tell the interviewer

> *"I run a FastAPI service with a LangGraph DAG — Planner → Researcher → Critic → Writer. Retrieval is FAISS over 50 ingested arXiv PDFs using MiniLM embeddings. Tavily provides web-search fallback. I evaluate 100 Q&A pairs with an LLM-as-judge scoring faithfulness and citation accuracy. Deployed on Render free tier, frontend on Lovable."*

Tell me to switch to build mode when you're ready and I'll walk through any step you get stuck on.