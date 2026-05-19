import { FileText, ExternalLink } from "lucide-react";
import type { Citation } from "@/lib/api";

export function CitationCard({ c }: { c: Citation }) {
  return (
    <div id={`cite-${c.n}`} className="rounded-md border border-border bg-card p-3 text-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-primary/15 text-primary text-[10px] font-semibold">{c.n}</span>
        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium truncate">{c.filename}</span>
        {c.page > 0 && <span className="text-muted-foreground">· p.{c.page}</span>}
        {c.url && (
          <a href={c.url} target="_blank" rel="noreferrer" className="ml-auto text-primary hover:underline">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <div className="text-muted-foreground leading-relaxed">{c.snippet}</div>
    </div>
  );
}