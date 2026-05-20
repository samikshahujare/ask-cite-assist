import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { listDocuments } from "@/lib/api";
import { UploadPanel } from "@/components/upload-panel";

export const Route = createFileRoute("/documents")({ component: DocumentsPage });

function DocumentsPage() {
  const { data, refetch, isLoading, error } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
    refetchInterval: 5000,
  });
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl">
      <h1 className="text-lg font-semibold">Documents</h1>
      <p className="text-xs text-muted-foreground mt-1 mb-6">
        PDFs indexed in FAISS. Drop more below.
      </p>
      <UploadPanel onUploaded={() => refetch()} />
      <div className="mt-6 rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border text-xs uppercase tracking-wider text-muted-foreground flex justify-between">
          <span>Indexed Documents</span>
          <span>
            {data?.stats.chunks ?? 0} chunks · {data?.stats.documents ?? 0} docs
          </span>
        </div>
        {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
        {error && (
          <div className="p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Backend unreachable."}
          </div>
        )}
        {data?.documents?.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">No documents yet.</div>
        )}
        <ul className="divide-y divide-border">
          {data?.documents?.map((d) => (
            <li key={d.doc_id} className="px-4 py-3 flex items-center gap-3 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 truncate">{d.filename}</span>
              <span className="text-xs text-muted-foreground">{d.chunks} chunks</span>
              <span className="text-[10px] text-muted-foreground font-mono">{d.doc_id}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
