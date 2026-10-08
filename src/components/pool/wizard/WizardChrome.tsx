import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MacroStep } from "./wizard-model";

/** Phase icons of the frozen icon family: 24px grid, 1.5px round stroke. */
const PHASE_ICON_PATHS: Record<string, ReactNode> = {
  piscina: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="M6.5 12.5c1.2-.9 2.3-.9 3.5 0s2.3.9 3.5 0 2.3-.9 3.5 0" />
    </>
  ),
  sistema: (
    <>
      <path d="M3.5 9.5c1.4-1.1 2.9-1.1 4.3 0s2.9 1.1 4.2 0 2.9-1.1 4.2 0 2.9 1.1 4.3 0" />
      <path d="M3.5 14.5c1.4-1.1 2.9-1.1 4.3 0s2.9 1.1 4.2 0 2.9-1.1 4.2 0 2.9 1.1 4.3 0" />
    </>
  ),
  accesso: (
    <>
      <path d="M3 7.5h3V18h12V7.5h3" />
      <path d="M6 11.5h5V18" />
      <circle cx="14.5" cy="14" r=".9" />
      <circle cx="15.6" cy="11.2" r=".7" />
    </>
  ),
  finiture: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  esterno: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M8.5 14.3V19" />
    </>
  ),
  optional: (
    <>
      <path d="M3.5 15h10l5-6.5" />
      <path d="M5.5 15v3.5M12.5 15v3.5M18.5 8.5l2-1" />
    </>
  ),
  presentazione: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 15.5l5-4.5 4 3.5 3-2.5 6 4.5" />
      <circle cx="15.5" cy="9" r="1.3" />
    </>
  ),
};

function PhaseIcon({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4 shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
    >
      {PHASE_ICON_PATHS[id] ?? <circle cx="12" cy="12" r="4" />}
    </svg>
  );
}

/**
 * Primary navigation: the seven phases of the frozen wizard in one line.
 * Each phase shows its icon (a check once done), its name, the chosen value
 * underneath and a thin progress bar -- ink when done, violet while
 * current. On phones it collapses to "03 / 07 · Accesso & comfort" with a
 * segmented bar.
 */
export function WizardNav({
  macros,
  current,
  onSelect,
  progress = 0.5,
}: {
  macros: ReadonlyArray<MacroStep>;
  current: number;
  onSelect: (index: number) => void;
  /** 0..1 progress inside the current phase (its internal steps). */
  progress?: number;
}) {
  const active = macros[current];
  return (
    <nav aria-label="Fasi della configurazione" className="min-w-0">
      <ol className="hidden items-stretch gap-1.5 xl:flex 2xl:gap-3">
        {macros.map((macro, index) => {
          const isCurrent = index === current;
          const done = macro.complete && !isCurrent;
          return (
            <li key={macro.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={!macro.reachable}
                aria-current={isCurrent ? "step" : undefined}
                title={macro.value ? `${macro.label} · ${macro.value}` : macro.label}
                className="flex w-auto min-w-[92px] max-w-[160px] flex-col gap-1.5 rounded-lg px-1.5 pt-1.5 text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    "flex items-center gap-2 text-[12.5px] leading-4 tracking-tight whitespace-nowrap",
                    isCurrent
                      ? "font-normal text-foreground"
                      : done
                        ? "text-foreground"
                        : "text-muted-foreground/70",
                  )}
                >
                  <span className={cn(isCurrent ? "text-brand" : done ? "text-foreground" : "")}>
                    {done ? (
                      <Check className="size-4" strokeWidth={1.75} />
                    ) : (
                      <PhaseIcon id={macro.id} />
                    )}
                  </span>
                  <span>{macro.label}</span>
                </span>
                <span
                  className={cn(
                    "block h-3.5 truncate text-[11px] leading-[14px]",
                    isCurrent ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {macro.value ?? ""}
                </span>
                <span aria-hidden className="block h-0.5 overflow-hidden rounded-full bg-hairline">
                  <span
                    className={cn(
                      "block h-full rounded-full transition-[width] duration-300",
                      isCurrent ? "bg-brand" : "bg-foreground/80",
                    )}
                    style={{
                      width: done
                        ? "100%"
                        : isCurrent
                          ? `${Math.round(Math.max(0.15, progress) * 100)}%`
                          : "0%",
                    }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex min-w-0 flex-col gap-1.5 xl:hidden">
        <p className="truncate text-[12px] tracking-tight text-foreground">
          <span className="tabular-nums text-brand">
            {String(current + 1).padStart(2, "0")}/{String(macros.length).padStart(2, "0")}
          </span>{" "}
          {active?.label}
        </p>
        <div className="flex gap-1" aria-hidden>
          {macros.map((macro, index) => (
            <span
              key={macro.id}
              className={cn(
                "h-0.5 flex-1 rounded-full",
                index < current ? "bg-foreground" : index === current ? "bg-brand" : "bg-hairline",
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
  total,
  nextLabel,
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
  /** Phase count: shows "Fase 03 di 07" when set. */
  total?: number | undefined;
  /** Name of the next phase, shown inside Continua on desktop. */
  nextLabel?: string | undefined;
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
              {total
                ? `Fase ${String(number).padStart(2, "0")} di ${String(total).padStart(2, "0")}`
                : String(number).padStart(2, "0")}
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

        <ScrollCueArea className={expanded ? "flex" : "hidden lg:flex"}>{children}</ScrollCueArea>
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
            {nextLabel && canContinue ? (
              <span className="text-[11.5px] font-light opacity-80">· {nextLabel}</span>
            ) : null}
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

/**
 * The tray's scrolling body. When more options continue below the fold it
 * shows a soft fade and a small "Altre opzioni" cue (a quiet two-beat nudge,
 * then still) that scrolls the next options into view -- so content that
 * appears after a choice (e.g. the stair shape, the inox ladder) is never
 * silently hidden under the edge.
 */
function ScrollCueArea({ className, children }: { className: string; children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const update = () =>
      setMoreBelow(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 24);
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    observer.observe(content);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);
  const reveal = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({ top: scroller.clientHeight * 0.7, behavior: reduced ? "auto" : "smooth" });
  };
  return (
    <div className={cn("relative min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scrollRef}
        className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 pb-5 lg:px-7 lg:py-6"
      >
        <div ref={contentRef}>{children}</div>
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent transition-opacity duration-300",
          moreBelow ? "opacity-100" : "opacity-0",
        )}
      />
      {moreBelow ? (
        <button
          type="button"
          onClick={reveal}
          className="absolute right-4 bottom-2.5 inline-flex animate-[cue_1.6s_cubic-bezier(0.2,0,0,1)_2] items-center gap-1 rounded-full border border-hairline bg-card px-3 py-1 text-[11px] text-foreground/75 shadow-[0_6px_18px_-10px_rgb(16_16_24/0.35)] transition-colors hover:text-foreground"
        >
          Altre opzioni
          <ChevronDown className="size-3.5 text-brand" strokeWidth={1.6} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
