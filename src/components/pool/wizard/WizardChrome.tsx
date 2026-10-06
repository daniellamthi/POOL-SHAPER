import { useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MacroStep } from "./wizard-model";

/**
 * Numbered primary navigation: the nine macro steps of the configurator in
 * one line. The current step is filled, completed steps carry a check, and
 * future steps that are not reachable yet are inert. On phones it collapses
 * to "03 / 09 · Sistema piscina" with a thin progress bar.
 */
export function WizardNav({
  macros,
  current,
  onSelect,
}: {
  macros: ReadonlyArray<MacroStep>;
  current: number;
  onSelect: (index: number) => void;
}) {
  const active = macros[current];
  return (
    <nav aria-label="Fasi della configurazione" className="min-w-0">
      <ol className="hidden items-center gap-1 lg:flex">
        {macros.map((macro, index) => {
          const isCurrent = index === current;
          return (
            <li key={macro.id} className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={!macro.reachable}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={macro.label}
                title={macro.label}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-full px-3 text-[12px] tracking-tight transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-35",
                  isCurrent
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums",
                    isCurrent
                      ? "bg-background text-foreground"
                      : macro.complete
                        ? "bg-foreground/85 text-background"
                        : "border border-foreground/30",
                  )}
                >
                  {macro.complete && !isCurrent ? (
                    <Check className="size-3" strokeWidth={2.2} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={cn("whitespace-nowrap", isCurrent ? "" : "hidden 2xl:inline")}>
                  {macro.label}
                </span>
              </button>
              {index < macros.length - 1 ? (
                <span aria-hidden className="h-px w-3 bg-hairline xl:w-5" />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex min-w-0 flex-col gap-1.5 lg:hidden">
        <p className="truncate text-[12px] tracking-tight text-foreground">
          <span className="tabular-nums text-muted-foreground">
            {String(current + 1).padStart(2, "0")} / {String(macros.length).padStart(2, "0")}
          </span>{" "}
          · {active?.label}
        </p>
        <div className="flex gap-1" aria-hidden>
          {macros.map((macro, index) => (
            <span
              key={macro.id}
              className={cn(
                "h-[3px] flex-1 rounded-full",
                index <= current ? "bg-foreground" : "bg-hairline",
              )}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

/**
 * The contextual configuration drawer under the 3D viewport. Desktop: a
 * wide tray with the step's title and current choice on the left and only
 * that step's cards on the right. Phones: a bottom sheet with two states --
 * collapsed (title, current choice, Continue) and expanded (the cards) --
 * toggled by tap or a vertical drag on the handle.
 */
export function ConfiguratorTray({
  number,
  title,
  subtitle,
  substep,
  selection,
  children,
  canBack,
  canContinue,
  continueLabel,
  continueHint,
  onBack,
  onContinue,
  expanded,
  onExpandedChange,
}: {
  number: number;
  title: string;
  subtitle: string;
  substep?: string | undefined;
  selection: string;
  children: ReactNode;
  canBack: boolean;
  canContinue: boolean;
  continueLabel: string;
  continueHint?: string | undefined;
  onBack: () => void;
  onContinue: () => void;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
}) {
  const drag = useRef<{ y: number; id: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  // Phones snap between three heights: collapsed, half (cards beside a
  // still-visible pool) and full (long lists). `expanded` covers both open
  // heights so the shell only needs to know whether options are showing.
  const [full, setFull] = useState(false);
  const open = (value: boolean) => {
    if (!value) setFull(false);
    onExpandedChange(value);
  };
  const endDrag = () => {
    if (!drag.current) return;
    if (dragOffset < -40) {
      if (expanded) setFull(true);
      else open(true);
    } else if (dragOffset > 40) {
      if (full) setFull(false);
      else open(false);
    }
    drag.current = null;
    setDragOffset(0);
  };
  return (
    <section
      aria-label={`Passo ${number}: ${title}`}
      className={cn(
        "relative z-20 flex min-h-0 flex-col border-hairline bg-background",
        // phones: bottom sheet over the viewport
        "fixed inset-x-0 bottom-0 rounded-t-[24px] border-t shadow-[0_-24px_60px_-36px_rgba(0,0,0,0.55)] transition-[max-height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:static lg:rounded-[24px] lg:border lg:shadow-none",
        expanded
          ? full
            ? "max-h-[82dvh] lg:max-h-[40dvh]"
            : "max-h-[54dvh] lg:max-h-[40dvh]"
          : "max-h-[23dvh] lg:max-h-[40dvh]",
      )}
      style={
        dragOffset
          ? { transform: `translateY(${Math.max(-60, Math.min(60, dragOffset))}px)` }
          : undefined
      }
    >
      <button
        type="button"
        aria-label={expanded ? "Riduci opzioni" : "Mostra opzioni"}
        aria-expanded={expanded}
        onClick={() => open(!expanded)}
        onPointerDown={(event) => {
          drag.current = { y: event.clientY, id: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current?.id === event.pointerId) setDragOffset(event.clientY - drag.current.y);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex w-full shrink-0 touch-none justify-center pb-1 pt-2.5 lg:hidden"
      >
        <span className="h-1 w-10 rounded-full bg-foreground/25" />
      </button>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 lg:w-[290px] lg:flex-col lg:justify-start lg:border-r lg:border-hairline lg:px-7 lg:py-6 xl:w-[320px]">
          <div className="flex min-w-0 flex-col gap-1.5 lg:gap-3">
            <p className="label-xs tabular-nums">
              {String(number).padStart(2, "0")}
              {substep ? (
                <span className="ml-2 normal-case tracking-normal">· {substep}</span>
              ) : null}
            </p>
            <h2 className="truncate text-[21px] leading-tight font-extralight tracking-[-0.03em] text-foreground lg:whitespace-normal lg:text-[30px]">
              {title}
            </h2>
            <p className="hidden text-[12.5px] leading-[1.6] font-light text-muted-foreground lg:block">
              {subtitle}
            </p>
            <p className="truncate text-[12px] text-muted-foreground lg:mt-2 lg:whitespace-normal lg:rounded-xl lg:border lg:border-hairline lg:px-3 lg:py-2.5 lg:text-foreground">
              <span className="hidden label-xs lg:mb-1 lg:block">La tua scelta</span>
              {selection}
            </p>
          </div>
          <Button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            title={canContinue ? undefined : continueHint}
            className="shrink-0 rounded-full px-5 lg:hidden"
          >
            {continueLabel}
            <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </Button>
        </header>

        <div
          className={cn(
            "scroll-slim min-h-0 flex-1 overflow-y-auto px-5 pb-5 lg:px-7 lg:py-6",
            expanded ? "block" : "hidden lg:block",
          )}
        >
          {children}
        </div>
      </div>

      <footer className="hidden shrink-0 items-center justify-between gap-6 border-t border-hairline px-7 py-3.5 lg:flex">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={!canBack}
          className="rounded-full px-3"
        >
          <ArrowLeft />
          Indietro
        </Button>
        <div className="flex items-center gap-4">
          {!canContinue && continueHint ? (
            <span className="text-[12px] text-muted-foreground">{continueHint}</span>
          ) : null}
          <Button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="min-w-40 rounded-full px-6"
          >
            {continueLabel}
            <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </footer>
      {expanded ? (
        <div className="flex shrink-0 items-center justify-between border-t border-hairline px-5 py-2.5 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={!canBack}
            className="px-1"
          >
            <ArrowLeft />
            Indietro
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => open(false)}
            className="px-1"
          >
            <ChevronDown />
            Vedi la piscina
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => open(true)}
          className="flex shrink-0 items-center justify-center gap-1.5 pb-[max(10px,env(safe-area-inset-bottom))] pt-0.5 text-[12px] text-muted-foreground lg:hidden"
        >
          <ChevronUp className="size-3.5" />
          Scegli le opzioni
        </button>
      )}
    </section>
  );
}
