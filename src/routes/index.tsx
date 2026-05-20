import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, ChevronDown, ChevronRight, Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { UploadPanel } from "@/components/upload-panel";
import { Markdown } from "@/components/markdown";
import { CitationCard } from "@/components/citation-card";
import { AgentSteps, type StepName, type StepStatus } from "@/components/agent-steps";
import { MetricCard } from "@/components/metric-card";
import {
  streamResearch,
  type Citation,
  type RetrievedChunk,
  type ResearchMetrics,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Record<StepName, StepStatus>>({
    planner: "idle", researcher: "idle", critic: "idle", writer: "idle",
  });
  const [chunks, setChunks] = useState<RetrievedChunk[]>([]);
  const [answer, setAnswer] = useState<string>("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [metrics, setMetrics] = useState<ResearchMetrics | null>(null);
  const [chunksOpen, setChunksOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSteps({ planner: "idle", researcher: "idle", critic: "idle", writer: "idle" });
    setChunks([]); setAnswer(""); setCitations([]); setMetrics(null);
    try {
      await streamResearch(query, (e) => {
        if (e.event === "agent_step") {
          const step = e.data.step as StepName;
          setSteps((s) => ({ ...s, [step]: e.data.status === "done" ? "done" : "running" }));
        } else if (e.event === "chunks") {
          setChunks(e.data.chunks);
        } else if (e.event === "final") {
          setAnswer(e.data.answer_markdown);
          setCitations(e.data.citations);
          setMetrics(e.data.metrics);
        } else if (e.event === "error") {
          setError(e.data.message);
          toast.error(e.data.message);
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      toast.error(msg, { duration: 9000 });
    } finally {
      setBusy(false);
    }
  }

  function downloadMarkdown() {
    const body = [
      `# ${query}`,
      "",
      answer,
      "",
      "## Sources",
      ...citations.map((c) => `- [${c.n}] ${c.filename} · p.${c.page}`),
    ].join("\n");
    const blob = new Blob([body], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
      {/* Main column */}
      <div className="flex flex-col min-w-0">
        <header className="px-8 py-5 border-b border-border">
          <h1 className="text-lg font-semibold">Research Workspace</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Ask a question. A 4-agent pipeline plans, retrieves from your PDFs, critiques, and writes a cited answer.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {!answer && !busy && (
            <div className="rounded-lg border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Upload PDFs in the right panel, then ask a question below.
            </div>
          )}

          {(busy || answer) && (
            <div className="space-y-4">
              <AgentSteps states={steps} />

              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              {answer && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <Markdown>{answer}</Markdown>
                </div>
              )}

              {metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Latency" value={`${(metrics.latency_ms / 1000).toFixed(1)}s`} hint="end-to-end" />
                  <MetricCard label="Citations" value={metrics.citation_count} hint={`${metrics.retrieval_count} retrieved`} />
                  <MetricCard label="Confidence" value={metrics.confidence.toFixed(2)} hint="avg cosine of cited" tone="good" />
                  <MetricCard
                    label="Hallucination risk"
                    value={metrics.hallucination_risk}
                    hint={`coverage ${metrics.coverage_score.toFixed(2)}`}
                    tone={metrics.hallucination_risk === "low" ? "good" : metrics.hallucination_risk === "medium" ? "warn" : "bad"}
                  />
                </div>
              )}

              {citations.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Citations</div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {citations.map((c) => <CitationCard key={c.n} c={c} />)}
                  </div>
                </div>
              )}

              {chunks.length > 0 && (
                <div>
                  <button
                    onClick={() => setChunksOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {chunksOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Retrieved chunks ({chunks.length})
                  </button>
                  {chunksOpen && (
                    <div className="mt-2 space-y-2">
                      {chunks.map((c, i) => (
                        <div key={c.chunk_id} className="rounded-md border border-border bg-card/60 p-3 text-xs">
                          <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                            <span className="text-primary font-semibold">#{i + 1}</span>
                            <span className="font-medium text-foreground">{c.filename}</span>
                            {c.page > 0 && <span>· p.{c.page}</span>}
                            <span className="ml-auto">score {c.score.toFixed(3)}</span>
                          </div>
                          <div className="text-muted-foreground leading-relaxed line-clamp-4">{c.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {answer && (
                <div className="flex gap-2">
                  <button
                    onClick={downloadMarkdown}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
                  >
                    <Download className="w-3.5 h-3.5" /> Download .md
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border px-8 py-4 bg-background">
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
              }}
              placeholder="Ask a research question about your uploaded PDFs… (⌘/Ctrl+Enter to submit)"
              className="flex-1 resize-none rounded-md bg-input border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            />
            <button
              onClick={run}
              disabled={busy || !query.trim()}
              className="px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Research
            </button>
          </div>
        </div>
      </div>

      {/* Side panel: upload */}
      <aside className="border-l border-border bg-sidebar/40 p-5 overflow-y-auto">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Documents</div>
        <UploadPanel />
        <div className="mt-6 rounded-md bg-card/60 border border-border p-3 text-[11px] text-muted-foreground leading-relaxed">
          Backend: <code className="text-foreground">{API_BASE}</code>
          <br />
          Set <code className="text-foreground">VITE_API_URL</code> to point at your FastAPI server.
        </div>
      </aside>
    </div>
  );
}
