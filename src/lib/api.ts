// Client for the FastAPI backend. Configure VITE_API_URL.
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

export function getBackendConnectionHelp() {
  const fromLovablePreview = typeof window !== "undefined" && window.location.hostname.endsWith(".lovable.app");
  const usingLocalBackend = API_BASE.startsWith("http://localhost") || API_BASE.startsWith("http://127.0.0.1");

  if (fromLovablePreview && usingLocalBackend) {
    return "Lovable preview cannot reach a backend running on your computer. Set VITE_API_URL to a public backend URL, or use an HTTPS tunnel like ngrok.";
  }

  return `Backend unreachable at ${API_BASE}. Make sure the FastAPI server is running and CORS allows this frontend origin.`;
}

async function request<T>(path: string, init?: RequestInit, fallback = "Request failed"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch (error) {
    throw new Error(getBackendConnectionHelp(), { cause: error });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${fallback}: ${response.status}${detail ? ` ${detail}` : ""}`);
  }

  return response.json();
}

export interface RetrievedChunk {
  chunk_id: string;
  doc_id: string;
  filename: string;
  page: number;
  text: string;
  score: number;
  source: "pdf" | "web";
  url?: string | null;
}

export interface Citation {
  n: number;
  chunk_id: string;
  filename: string;
  page: number;
  snippet: string;
  url?: string | null;
}

export interface ResearchMetrics {
  latency_ms: number;
  retrieval_count: number;
  citation_count: number;
  confidence: number;
  hallucination_risk: "low" | "medium" | "high";
  coverage_score: number;
}

export interface ResearchFinal {
  session_id?: string;
  query: string;
  answer_markdown: string;
  citations: Citation[];
  chunks: RetrievedChunk[];
  metrics: ResearchMetrics;
}

export interface UploadResult {
  results: Array<{
    doc_id?: string;
    filename: string;
    chunks_added?: number;
    skipped?: boolean;
    error?: string;
  }>;
  stats: { chunks: number; documents: number };
}

export interface DocItem {
  doc_id: string;
  filename: string;
  chunks: number;
}

export async function uploadPdfs(files: File[]): Promise<UploadResult> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return request<UploadResult>("/upload", { method: "POST", body: fd }, "Upload failed");
}

export async function listDocuments(): Promise<{ documents: DocItem[]; stats: { chunks: number; documents: number } }> {
  return request("/documents", undefined, "Failed to list documents");
}

export async function fetchHistory(): Promise<{ sessions: ResearchFinal[] }> {
  return request("/history", undefined, "Failed to fetch history");
}

export interface AggregateMetrics {
  count: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  avg_citation_count: number;
  avg_confidence: number;
  avg_coverage: number;
  hallucination_risk_distribution: { low: number; medium: number; high: number };
}

export async function fetchMetrics(): Promise<AggregateMetrics> {
  return request("/metrics", undefined, "Failed to fetch metrics");
}

export type SseEvent =
  | { event: "agent_step"; data: { step: string; status: "start" | "done"; output?: unknown; count?: number } }
  | { event: "chunks"; data: { chunks: RetrievedChunk[] } }
  | { event: "final"; data: ResearchFinal }
  | { event: "error"; data: { message: string } };

// Stream /research as Server-Sent Events. We POST JSON and parse the SSE manually
// since EventSource doesn't support POST bodies.
export async function streamResearch(
  query: string,
  onEvent: (e: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal,
    });
  } catch (error) {
    throw new Error(getBackendConnectionHelp(), { cause: error });
  }

  if (!r.ok || !r.body) throw new Error(`Research failed: ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const lines = raw.split("\n");
      let event = "message";
      let dataStr = "";
      for (const ln of lines) {
        if (ln.startsWith("event:")) event = ln.slice(6).trim();
        else if (ln.startsWith("data:")) dataStr += ln.slice(5).trim();
      }
      if (!dataStr) continue;
      try {
        const data = JSON.parse(dataStr);
        onEvent({ event, data } as SseEvent);
      } catch {
        // ignore parse errors
      }
    }
  }
}