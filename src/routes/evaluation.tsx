import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMetrics } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";

export const Route = createFileRoute("/evaluation")({ component: EvalPage });

function EvalPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics"], queryFn: fetchMetrics, refetchInterval: 5000,
  });
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 max-w-5xl">
      <h1 className="text-lg font-semibold">Evaluation Dashboard</h1>
      <p className="text-xs text-muted-foreground mt-1 mb-6">
        Live aggregates across {data?.count ?? 0} sessions. Run <code className="text-foreground">python eval/run_eval.py</code> in the backend for offline LLM-as-judge scoring on the 100-question set.
      </p>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-destructive">Backend unreachable.</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="p50 Latency" value={`${(data.latency_p50_ms / 1000).toFixed(1)}s`} />
            <MetricCard label="p95 Latency" value={`${(data.latency_p95_ms / 1000).toFixed(1)}s`} tone="warn" />
            <MetricCard label="Avg Citations" value={data.avg_citation_count.toFixed(1)} />
            <MetricCard label="Avg Confidence" value={data.avg_confidence.toFixed(2)} tone="good" />
          </div>

          <div className="mt-6 grid md:grid-cols-2 gap-3">
            <MetricCard label="Avg Coverage (Critic)" value={data.avg_coverage.toFixed(2)} hint="0..1, higher is better" tone="good" />
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Hallucination Risk Distribution</div>
              <div className="space-y-1.5">
                {(["low", "medium", "high"] as const).map((k) => {
                  const v = data.hallucination_risk_distribution[k] ?? 0;
                  const total = Object.values(data.hallucination_risk_distribution).reduce((a, b) => a + b, 0) || 1;
                  const pct = Math.round((v / total) * 100);
                  return (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="w-16 capitalize text-muted-foreground">{k}</span>
                      <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                        <div
                          className={k === "low" ? "h-full bg-emerald-500" : k === "medium" ? "h-full bg-amber-500" : "h-full bg-rose-500"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}