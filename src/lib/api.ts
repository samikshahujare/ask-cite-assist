// Client for the FastAPI backend. Configure VITE_API_URL.
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

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
  const r = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`Upload failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function listDocuments(): Promise<{ documents: DocItem[]; stats: { chunks: number; documents: number } }> {
  const r = await fetch(`${API_BASE}/documents`);
  if (!r.ok) throw new Error("Failed to list documents");
  return r.json();
}

export async function fetchHistory(): Promise<{ sessions: ResearchFinal[] }> {
  const r = await fetch(`${API_BASE}/history`);
  if (!r.ok) throw new Error("Failed to fetch history");
  return r.json();
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
  const r = await fetch(`${API_BASE}/metrics`);
  if (!r.ok) throw new Error("Failed to fetch metrics");
  return r.json();
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
  const r = await fetch(`${API_BASE}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
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