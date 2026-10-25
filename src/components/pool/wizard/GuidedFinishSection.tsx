import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { revealWizardFinish } from "./finish-guide";
import { claimWizardGuidance, wizardGuidanceVersion } from "./wizard-guidance";

export function useFinishGuide() {
  const [activation, setActivation] = useState(0);
  const consumed = useRef(0);
  return { guide: { activation, consumed }, request: () => setActivation(count => count + 1) };
}

/** The activation counter changes only on a deliberate material action, not
 * on locale, configuration, navigation or hydration updates. */
export function GuidedFinishSection({ label, description, guide, children }: {
  label: string;
  description?: string;
  guide: { activation: number; consumed: RefObject<number> };
  children: ReactNode;
}) {
  const headingId = useId();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(false);
  const { activation, consumed } = guide;
  useEffect(() => {
    if (!activation || consumed.current >= activation) return;
    const scroller = sectionRef.current?.closest<HTMLElement>(".pool-dock-scroll");
    if (scroller) claimWizardGuidance(scroller);
    const version = scroller ? wizardGuidanceVersion(scroller) : 0;
    const frame = requestAnimationFrame(() => {
      const section = sectionRef.current;
      if (!section || scroller && wizardGuidanceVersion(scroller) !== version) return;
      consumed.current = activation;
      revealWizardFinish(section, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setHighlight(true);
    });
    const timeout = window.setTimeout(() => setHighlight(false), 1600);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timeout); };
  }, [activation, consumed]);
  return <div ref={sectionRef} role="group" aria-labelledby={headingId} tabIndex={-1}
    data-finish-guidance={highlight ? "active" : undefined}
    className={cn("col-span-full space-y-3 rounded-xl border p-3 outline-none transition-colors duration-300 motion-reduce:transition-none",
      highlight ? "border-brand/60 bg-brand-soft" : "border-hairline")}>
    <h4 id={headingId} className="text-[13px] font-medium tracking-[-0.01em]">{label}</h4>
    {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
    {children}
  </div>;
}
