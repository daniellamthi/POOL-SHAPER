import { useI18n } from "@/lib/i18n";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MacroStep } from "./wizard-model";
import "./fullscreen.css";

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
 * current. All seven buttons remain available on phones in a compact,
 * horizontally scrolling row.
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
  const { t } = useI18n();
  const phasesRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = phasesRef.current;
    const active = list?.children[current];
    if (!list || !(active instanceof HTMLElement)) return;
    const bounds = list.getBoundingClientRect();
    const phase = active.getBoundingClientRect();
    if (phase.left < bounds.left || phase.right > bounds.right) {
      list.scrollBy({ left: phase.left - bounds.left - (bounds.width - phase.width) / 2 });
    }
  }, [current]);
  return (
    <nav aria-label={t("Fasi della configurazione")} className="pool-phase-nav">
      <ol ref={phasesRef} className="pool-phase-list">
        {macros.map((macro, index) => {
          const isCurrent = index === current;
          const done = macro.complete && !isCurrent;
          return (
            <li key={macro.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={!macro.reachable}
                aria-current={isCurrent ? "step" : undefined}
                title={macro.value ? `${t(macro.label)} · ${t(macro.value)}` : t(macro.label)}
                className="pool-phase-button outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    "pool-phase-label",
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
                  <span className="pool-phase-name">{t(macro.label)}</span>
                </span>
                <span
                  className={cn(
                    "pool-phase-value",
                    isCurrent ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {t(macro.value ?? "")}
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
    </nav>
  );
}

/**
 * A compact dock over the viewport, with persistent navigation and a
 * bounded, collapsible options pane. Options stay mounted when hidden.
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
  onViewPool,
  nextChoice,
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
  onViewPool: () => void;
  nextChoice?: string | undefined;
}) {
  const { t } = useI18n();
  const optionsId = useId();
  const hintId = useId();
  return (
    <section
      aria-label={t("Passo {number}: {title}", { number, title: t(title) })}
      data-camera-occluder="dock"
      className="pool-config-dock"
    >
      <div id={optionsId} hidden={!expanded} className="pool-dock-options">
        <ScrollCueArea decisionKey={`${number}-${substep ?? ""}`} className="flex">
          <p className="pool-dock-description">{t(subtitle)}</p>
          {children}
          {nextChoice && canContinue ? <button type="button" onClick={onContinue}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-2 text-xs text-brand">
            {t("Prossima scelta")}: {t(nextChoice)} <ArrowRight className="size-3.5" aria-hidden />
          </button> : null}
        </ScrollCueArea>
      </div>
      <div className="pool-dock-bar">
        <header className="pool-dock-heading">
          <div className="min-w-0">
            <p className="label-xs tabular-nums">
              {total
                ? t("Fase {current} di {total}", { current: String(number).padStart(2, "0"), total: String(total).padStart(2, "0") })
                : String(number).padStart(2, "0")}
              {substep ? (
                <span className="ml-2 normal-case tracking-normal">· {t(substep)}</span>
              ) : null}
            </p>
            <h2 className="pool-dock-title">{t(title)}</h2>
            <p className="pool-dock-selection" title={t(selection)}>
              {t(selection)}
            </p>
          </div>
        </header>
        <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center">
        <Button type="button" variant="ghost" onClick={onViewPool}
          className="pool-dock-toggle rounded-full">
          <Scan aria-hidden />{t("Vedi la piscina")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={optionsId}
          onClick={() => onExpandedChange(!expanded)}
          className="pool-dock-toggle rounded-full"
        >
          {expanded ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
          {t(expanded ? "Riduci" : "Scegli le opzioni")}
        </Button>
        </div>
        <footer className="pool-dock-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={!canBack}
            className="rounded-full px-3"
          >
            <ArrowLeft />
            {t("Indietro")}{" "}</Button>
          <Button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            title={canContinue || !continueHint ? undefined : t(continueHint)}
            aria-describedby={!canContinue && continueHint ? hintId : undefined}
            className="pool-dock-continue rounded-full px-5"
          >
            {t(continueLabel)}
            {nextLabel && canContinue ? (
              <span className="pool-dock-next">· {t(nextLabel)}</span>
            ) : null}
            <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </Button>
        </footer>
      </div>
      {!canContinue && continueHint ? (
        <p id={hintId} className="pool-dock-hint">
          {t(continueHint)}
        </p>
      ) : null}
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
function ScrollCueArea({ className, children, decisionKey }: { className: string; children: ReactNode; decisionKey: string }) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    // Decision identity only: changing a finish never repeatedly scrolls.
  }, [decisionKey]);
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
      <div ref={scrollRef} className="pool-dock-scroll scroll-slim">
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
          {t("Altre opzioni")}{" "}<ChevronDown className="size-3.5 text-brand" strokeWidth={1.6} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
