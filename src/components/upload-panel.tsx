import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadPdfs } from "@/lib/api";
import { cn } from "@/lib/utils";

export function UploadPanel({ onUploaded }: { onUploaded?: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<
    { name: string; status: "pending" | "uploading" | "done" | "error"; msg?: string }[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
      if (!pdfs.length) {
        toast.error("Please drop PDF files only");
        return;
      }
      const idx = queue.length;
      setQueue((q) => [...q, ...pdfs.map((f) => ({ name: f.name, status: "uploading" as const }))]);
      try {
        const res = await uploadPdfs(pdfs);
        setQueue((q) => {
          const next = [...q];
          res.results.forEach((r, i) => {
            const target = next[idx + i];
            if (!target) return;
            if (r.error) {
              target.status = "error";
              target.msg = r.error;
            } else {
              target.status = "done";
              target.msg = r.skipped ? "already ingested" : `${r.chunks_added} chunks`;
            }
          });
          return next;
        });
        toast.success(`Indexed ${pdfs.length} file(s) · ${res.stats.chunks} chunks total`);
        onUploaded?.();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setQueue((q) => q.map((it, i) => (i >= idx ? { ...it, status: "error", msg } : it)));
        toast.error(msg, { duration: 9000 });
      }
    },
    [queue.length, onUploaded],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/30",
        )}
      >
        <UploadCloud className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
        <div className="text-sm font-medium">Drop PDFs or click to upload</div>
        <div className="text-xs text-muted-foreground mt-1">
          Parsed, chunked (500 tokens, 50 overlap), embedded, indexed in FAISS
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {queue.length > 0 && (
        <div className="space-y-1">
          {queue.map((it, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-card/50 border border-border"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{it.name}</span>
              {it.status === "uploading" && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              )}
              {it.status === "done" && <span className="text-primary text-[10px]">{it.msg}</span>}
              {it.status === "error" && (
                <span
                  className="text-destructive text-[10px] truncate max-w-[360px]"
                  title={it.msg}
                >
                  {it.msg}
                </span>
              )}
              <button
                onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
