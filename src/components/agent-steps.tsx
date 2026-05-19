import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["planner", "researcher", "critic", "writer"] as const;
export type StepName = (typeof STEPS)[number];
export type StepStatus = "idle" | "running" | "done";

export function AgentSteps({ states }: { states: Record<StepName, StepStatus> }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STEPS.map((s, i) => {
        const st = states[s];
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] capitalize",
                st === "done" && "border-primary/40 bg-primary/10 text-primary",
                st === "running" && "border-primary/40 bg-primary/15 text-primary animate-pulse",
                st === "idle" && "border-border bg-card text-muted-foreground",
              )}
            >
              {st === "done" ? <Check className="w-3 h-3" /> :
                st === "running" ? <Loader2 className="w-3 h-3 animate-spin" /> :
                <Circle className="w-3 h-3" />}
              {s}
            </div>
            {i < STEPS.length - 1 && <div className="w-3 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}