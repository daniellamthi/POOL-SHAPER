import { isPorcelainSelection, REFERENCE_FINISHES } from "@/lib/pool/reference-finishes";

export type FinishFamily = "porcelain" | "travertine";
export const TRAVERTINE_FINISHES = REFERENCE_FINISHES.filter(finish =>
  finish.id === "reference-travertine-light" || finish.id === "reference-travertine-veined");
export const isTravertineReference = (id: unknown) => TRAVERTINE_FINISHES.some(finish => finish.id === id);
export const finishFamily = (id: unknown): FinishFamily | null =>
  isPorcelainSelection(id) ? "porcelain" : id === "travertine" || isTravertineReference(id) ? "travertine" : null;

/** Deliberately scroll only the existing wizard's scrollport, never the page,
 * 3D viewport, or any ancestor. Called only after an explicit material click. */
export function revealWizardFinish(section: HTMLElement, reducedMotion: boolean): boolean {
  const scroller = section.closest<HTMLElement>(".pool-dock-scroll");
  if (!scroller) return false;
  const targetTop = scroller.scrollTop + section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
  const top = Math.max(0, Math.min(targetTop, scroller.scrollHeight - scroller.clientHeight));
  section.focus({ preventScroll: true });
  scroller.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
  return true;
}
