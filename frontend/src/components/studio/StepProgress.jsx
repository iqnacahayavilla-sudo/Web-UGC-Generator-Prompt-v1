import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { title: "Upload Produk", sub: "Foto & Analisis AI" },
  { title: "Gaya Video", sub: "Rasio, Format & Hook" },
  { title: "Kreator", sub: "Persona & Suasana" },
  { title: "Generate Prompt", sub: "Bahasa & Output" },
];

export const StepProgress = ({ current, onStepClick, maxReached }) => {
  return (
    <div className="flex flex-col gap-1.5" data-testid="step-progress">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxReached;
        return (
          <button
            key={step.title}
            type="button"
            disabled={!reachable}
            data-testid={`step-nav-${i}`}
            onClick={() => reachable && onStepClick(i)}
            className={cn(
              "flex items-center gap-3 rounded-xl p-3 text-left transition-all",
              active ? "bg-primary/10 dark:bg-primary/15 border border-primary/30" : "hover:bg-secondary/60 border border-transparent",
              !reachable && "cursor-not-allowed opacity-40"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                done && "bg-primary text-primary-foreground shadow-sm",
                active && "border-2 border-primary text-primary bg-primary/10 font-extrabold",
                !done && !active && "border border-border bg-secondary/50 text-muted-foreground"
              )}
            >
              {done ? <Check className="h-4 w-4" /> : `0${i + 1}`}
            </span>
            <div className="flex flex-col">
              <span className={cn("text-sm font-semibold", active ? "text-foreground font-bold" : "text-muted-foreground")}>
                {step.title}
              </span>
              <span className="text-[11px] text-muted-foreground/80 leading-tight">
                {step.sub}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StepProgress;
