// Minimal dependency-free markdown renderer suited to LLM answers with [n] citations.
import { useMemo } from "react";

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string) {
  let out = escape(s);
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-[0.85em]">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[(\d+)\]/g, '<sup class="text-primary font-medium">[<a href="#cite-$1">$1</a>]</sup>');
  out = out.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a class="text-primary underline underline-offset-2" href="$2" target="_blank" rel="noreferrer">$1</a>');
  return out;
}

export function Markdown({ children }: { children: string }) {
  const html = useMemo(() => {
    const lines = children.split(/\r?\n/);
    const out: string[] = [];
    let inList = false;
    let inCode = false;
    let codeBuf: string[] = [];
    for (const raw of lines) {
      if (raw.startsWith("```")) {
        if (inCode) {
          out.push(`<pre class="rounded-md bg-muted p-3 overflow-x-auto text-xs"><code>${escape(codeBuf.join("\n"))}</code></pre>`);
          codeBuf = [];
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }
      if (inCode) { codeBuf.push(raw); continue; }
      const line = raw.trimEnd();
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        if (inList) { out.push("</ul>"); inList = false; }
        const lvl = h[1].length;
        const cls = lvl === 1 ? "text-xl font-semibold mt-4 mb-2" : lvl === 2 ? "text-lg font-semibold mt-4 mb-2" : "text-base font-semibold mt-3 mb-1.5";
        out.push(`<h${lvl} class="${cls}">${inline(h[2])}</h${lvl}>`);
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        if (!inList) { out.push('<ul class="list-disc pl-5 space-y-1 my-2">'); inList = true; }
        out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
        continue;
      }
      if (inList) { out.push("</ul>"); inList = false; }
      if (!line.trim()) { out.push(""); continue; }
      out.push(`<p class="my-2 leading-relaxed">${inline(line)}</p>`);
    }
    if (inList) out.push("</ul>");
    if (inCode) out.push(`<pre class="rounded-md bg-muted p-3 overflow-x-auto text-xs"><code>${escape(codeBuf.join("\n"))}</code></pre>`);
    return out.join("\n");
  }, [children]);

  return <div className="prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}