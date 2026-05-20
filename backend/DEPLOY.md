# Deploy to Render (Free)

## One-click deploy

1. Push this repo to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com) → **New +** → **Blueprint**.
3. Connect your GitHub repo.
4. Render reads `render.yaml` and creates the service automatically.

## Set environment variables

In the Render dashboard for the service, add these under **Environment**:

| Key | Value | Required? |
|---|---|---|
| `OPENAI_API_KEY` | Your **OpenRouter** key (`sk-or-...`) | Yes |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` | Yes |
| `TAVILY_API_KEY` | Your Tavily key (free tier at tavily.com) | No — enables web search fallback |

> **Zero-cost tip:** `EMBEDDING_PROVIDER=local` and `OPENAI_CHAT_MODEL=meta-llama/llama-3.1-8b-instruct:free` are already set in `render.yaml`, so you pay nothing for embeddings or chat.

## Update the frontend

After deploy, copy the Render service URL (e.g. `https://agentic-ai-research-assistant.onrender.com`).

In your Lovable frontend, go to **Settings → Environment Variables** and set:

```
VITE_API_URL=https://agentic-ai-research-assistant.onrender.com
```

Then republish the frontend.

## Local dev (fallback)

If you prefer not to deploy:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Create .env from .env.example, then:
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The Lovable preview will connect to `http://localhost:8000` automatically.

## Health check

```bash
curl https://<your-render-url>/health
```

Expected:
```json
{"status": "ok", "openai_configured": true, "chunks": 0}
```
