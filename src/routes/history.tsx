import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchHistory, type ResearchFinal } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { CitationCard } from "@/components/citation-card";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["history"], queryFn: fetchHistory });
  const [open, setOpen] = useState<ResearchFinal | null>(null);
  return (
    <div className="flex-1 grid grid-cols-[360px_1fr] min-h-0">
      <aside className="border-r border-border overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-sm font-semibold">Session History</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">{data?.sessions.length ?? 0} sessions</p>
        </div>
        {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="p-4 text-sm text-destructive">Backend unreachable.</div>}
        <ul className="divide-y divide-border">
          {data?.sessions.map((s, i) => (
            <li key={i}>
              <button
                onClick={() => setOpen(s)}
                className="w-full text-left px-4 py-3 hover:bg-accent/40 text-sm"
              >
                <div className="truncate font-medium">{s.query}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {s.metrics.citation_count} citations · {(s.metrics.latency_ms / 1000).toFixed(1)}s · risk {s.metrics.hallucination_risk}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="overflow-y-auto px-8 py-6">
        {!open && <div className="text-sm text-muted-foreground">Select a session to view the answer and citations.</div>}
        {open && (
          <div className="space-y-4 max-w-3xl">
            <h2 className="text-base font-semibold">{open.query}</h2>
            <div className="rounded-lg border border-border bg-card p-5"><Markdown>{open.answer_markdown}</Markdown></div>
            {open.citations.length > 0 && (
              <div className="grid md:grid-cols-2 gap-2">
                {open.citations.map((c) => <CitationCard key={c.n} c={c} />)}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}