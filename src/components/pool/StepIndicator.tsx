import { cn } from "@/lib/utils";
import type { StepDefinition } from "@/lib/pool/types";
import type { StepGroup } from "@/lib/pool/config";

interface Props {
  current: number;
  isStepComplete: (index: number) => boolean;
  onSelect: (index: number) => void;
  steps: ReadonlyArray<StepDefinition>;
  /** When provided, the rail collapses to one dot per group instead of one
   * per raw step -- the "Nuova piscina" 7-phase rail (VASCA/ACQUA/STILE/…)
   * over the finer-grained `steps` array underneath. Renovation passes
   * nothing and keeps the original one-dot-per-step rendering. */
  groups?: ReadonlyArray<StepGroup> | undefined;
}

interface ResolvedGroup {
  key: string;
  label: string;
  indices: number[];
}

function resolveGroups(
  groups: ReadonlyArray<StepGroup>,
  steps: ReadonlyArray<StepDefinition>,
): ResolvedGroup[] {
  return groups
    .map((group) => ({
      key: group.id,
      label: group.label,
      indices: group.stepIds
        .map((id) => steps.findIndex((step) => step.id === id))
        .filter((index) => index >= 0),
    }))
    .filter((group) => group.indices.length > 0);
}

/**
 * Slim progress rail -- no per-tab labels. At ten steps, text labels have no
 * room to breathe (they were truncating to fragments like "STRU_"/"EQUIP_",
 * reading as broken rather than premium); the full current-step name already
 * lives in the line above, and `title` keeps every segment identifiable on
 * hover/focus.
 */
export function StepIndicator({ current, isStepComplete, onSelect, steps, groups }: Props) {
  const visibleSteps = steps ?? [];
  const resolvedGroups = groups ? resolveGroups(groups, visibleSteps) : null;

  if (resolvedGroups && resolvedGroups.length > 0) {
    const activeGroupIndex = resolvedGroups.findIndex((group) => group.indices.includes(current));
    return (
      <nav aria-label="Fasi della configurazione" className="flex flex-col gap-3.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label-xs">Step {String(current + 1).padStart(2, "0")}</p>
            <p className="mt-1.5 font-display text-[1.25rem] tracking-[-0.025em] text-foreground/95">
              {visibleSteps[current]?.short}
            </p>
          </div>
          <span className="numeric text-[10px] text-muted-foreground/70">
            {String(Math.max(0, activeGroupIndex) + 1).padStart(2, "0")}/
            {String(resolvedGroups.length).padStart(2, "0")}
          </span>
        </div>

        <ol className="relative flex items-center justify-between gap-1 border-t border-hairline/70 pt-3">
          {resolvedGroups.map((group, position) => {
            const firstIndex = group.indices[0]!;
            const lastIndex = group.indices[group.indices.length - 1]!;
            const active = group.indices.includes(current);
            const done =
              lastIndex < current && group.indices.every((index) => isStepComplete(index));
            const future = firstIndex > current;
            return (
              <li key={group.key} className="relative z-10 flex-1">
                <button
                  type="button"
                  onClick={() => onSelect(firstIndex)}
                  disabled={future}
                  title={group.label}
                  aria-label={group.label}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "group relative flex h-11 w-full items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:cursor-default",
                    active && "pointer-events-none",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5.5 items-center justify-center rounded-full border text-[8px] font-medium tracking-[0.08em] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : done
                          ? "border-foreground/25 bg-transparent text-foreground/75"
                          : "border-border/80 bg-transparent text-muted-foreground/60 group-hover:border-foreground/25 group-hover:text-foreground/75",
                    )}
                  >
                    {String(position + 1).padStart(2, "0")}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Configuration steps" className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label-xs">Step {String(current + 1).padStart(2, "0")}</p>
          <p className="mt-1.5 font-display text-[1.25rem] tracking-[-0.025em] text-foreground/95">
            {visibleSteps[current]?.short}
          </p>
        </div>
        <span className="numeric text-[10px] text-muted-foreground/70">
          {String(current + 1).padStart(2, "0")}/{String(visibleSteps.length).padStart(2, "0")}
        </span>
      </div>

      <ol className="relative flex items-center justify-between gap-1 border-t border-hairline/70 pt-3">
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
                  "group relative flex h-11 w-full items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:cursor-default",
                  active && "pointer-events-none",
                )}
              >
                <span
                  className={cn(
                    "flex size-5.5 items-center justify-center rounded-full border text-[8px] font-medium tracking-[0.08em] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-foreground/25 bg-transparent text-foreground/75"
                        : "border-border/80 bg-transparent text-muted-foreground/60 group-hover:border-foreground/25 group-hover:text-foreground/75",
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
