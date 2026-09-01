import { cn } from "@/lib/utils";
import type { StepDefinition } from "@/lib/pool/types";

interface Props {
  current: number;
  isStepComplete: (index: number) => boolean;
  onSelect: (index: number) => void;
  steps: ReadonlyArray<StepDefinition>;
}

/**
 * Slim progress rail -- no per-tab labels. At ten steps, text labels have no
 * room to breathe (they were truncating to fragments like "STRU_"/"EQUIP_",
 * reading as broken rather than premium); the full current-step name already
 * lives in the line above, and `title` keeps every segment identifiable on
 * hover/focus.
 */
export function StepIndicator({ current, isStepComplete, onSelect, steps }: Props) {
  const visibleSteps = steps ?? [];
  return (
    <nav aria-label="Configuration steps" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label-xs">Step {String(current + 1).padStart(2, "0")}</p>
          <p className="mt-2 font-display text-[1.45rem] tracking-[-0.04em] text-foreground/95">
            {visibleSteps[current]?.short}
          </p>
        </div>
        <span className="numeric text-[10px] text-muted-foreground/70">
          {String(current + 1).padStart(2, "0")}/{String(visibleSteps.length).padStart(2, "0")}
        </span>
      </div>

      <ol className="relative flex items-center justify-between gap-2 rounded-full border border-hairline/80 bg-card/30 px-3 py-3 backdrop-blur-sm">
        {visibleSteps.map((step) => {
          const active = step.index === current;
          const done = isStepComplete(step.index) && step.index < current;
          const future = step.index > current;
          return (
            <li key={step.id} className="relative z-10 flex-1">
              <button
                type="button"
                onClick={() => onSelect(step.index)}
                disabled={future}
                title={step.title}
                aria-label={step.title}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group relative flex w-full items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:cursor-default",
                  active && "pointer-events-none",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-[9px] font-medium tracking-[0.18em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_14px_28px_-18px_rgba(120,118,215,0.95)]"
                      : done
                        ? "border-foreground/30 bg-foreground/8 text-foreground/80"
                        : "border-border bg-background text-muted-foreground/65 group-hover:border-foreground/25 group-hover:text-foreground/75",
                  )}
                >
                  {String(step.index + 1).padStart(2, "0")}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
