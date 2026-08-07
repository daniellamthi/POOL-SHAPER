import { cn } from "@/lib/utils";
import type { StepDefinition } from "@/lib/pool/types";
import { Check } from "lucide-react";

interface Props {
  current: number;
  isStepComplete: (index: number) => boolean;
  onSelect: (index: number) => void;
  steps: ReadonlyArray<StepDefinition>;
}

export function StepIndicator({ current, isStepComplete, onSelect, steps }: Props) {
  const visibleSteps = steps ?? [];
  return (
    <nav aria-label="Configuration steps" className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <span className="label-xs">
          Step {String(current + 1).padStart(2, "0")} — {visibleSteps[current]?.short}
        </span>
        <span className="numeric text-[10px] text-muted-foreground/60">
          {String(current + 1).padStart(2, "0")}/{String(visibleSteps.length).padStart(2, "0")}
        </span>
      </div>
      <ol className="flex items-start gap-2">
        {visibleSteps.map((step) => {
          const active = step.index === current;
          const done = isStepComplete(step.index) && step.index < current;
          const future = step.index > current;
          return (
            <li key={step.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelect(step.index)}
                disabled={future}
                title={step.title}
                aria-current={active ? "step" : undefined}
                className="group block w-full rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:cursor-default"
              >
                <span className="relative block h-px w-full bg-border/60">
                  <span
                    className={cn(
                      "absolute -inset-y-px left-0 w-full origin-left transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      active
                        ? "scale-x-100 bg-brand"
                        : done
                          ? "scale-x-100 bg-foreground/45"
                          : "scale-x-0 bg-foreground",
                    )}
                  />
                </span>
                <span className="mt-3 flex min-h-4 items-center justify-center">
                  {done ? (
                    <Check
                      className="size-3 animate-[veil_300ms_ease-out_both] text-foreground/60"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <span
                      className={cn(
                        "block truncate text-[8px] uppercase tracking-[0.12em] transition-colors duration-300",
                        active ? "text-brand" : "text-muted-foreground/30",
                      )}
                    >
                      {step.short}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
