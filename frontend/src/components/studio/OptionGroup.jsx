import { cn } from "@/lib/utils";

export const OptionGroup = ({ label, description, options, value, onChange, columns = 3, testid }) => {
  return (
    <div className="space-y-3" data-testid={testid}>
      <div>
        <h4 className="font-display text-base font-bold text-foreground">{label}</h4>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              data-testid={`${testid}-${opt.value.toString().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              onClick={() => onChange(opt.value)}
              className={cn(
                "group flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98]",
                active
                  ? "border-primary bg-primary/10 dark:bg-primary/15 ring-2 ring-primary/60 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40"
              )}
            >
              <span className={cn("text-sm font-semibold tracking-tight", active ? "text-primary dark:text-primary-foreground font-bold" : "text-foreground")}>
                {opt.label}
              </span>
              {opt.hint && (
                <span className={cn("mt-1 text-xs leading-snug", active ? "text-primary/80 dark:text-muted-foreground" : "text-muted-foreground")}>
                  {opt.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OptionGroup;
