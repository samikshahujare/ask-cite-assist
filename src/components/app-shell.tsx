import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquare, FileText, History, BarChart3, Sparkles } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Workspace", icon: MessageSquare },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/history", label: "History", icon: History },
  { to: "/evaluation", label: "Evaluation", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Research Assistant</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Agentic RAG</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = path === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="rounded-md bg-card/50 border border-border px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pipeline</div>
            <div className="text-xs mt-1 leading-relaxed">
              Planner → Researcher → Critic → Writer
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      <Toaster richColors position="top-right" />
    </div>
  );
}