const GROUP_SELECTOR = '[data-wizard-choice-grid], [data-wizard-guidance-group], [role="group"], [role="radiogroup"], fieldset';
const CHOICE_SELECTOR = '[data-wizard-choice], button[aria-pressed], button[aria-expanded], [role="radio"]';
const guidanceVersions = new WeakMap<HTMLElement, number>();

/** An explicit disclosure guide owns this interaction, ahead of the generic
 * next-options guide. This is local to the existing dock scrollport. */
export function claimWizardGuidance(scroller: HTMLElement): void {
  guidanceVersions.set(scroller, wizardGuidanceVersion(scroller) + 1);
}

export function wizardGuidanceVersion(scroller: HTMLElement): number {
  return guidanceVersions.get(scroller) ?? 0;
}

function visible(element: HTMLElement): boolean {
  return !element.closest('[hidden], [aria-hidden="true"]') && element.getClientRects().length > 0;
}

function groups(content: HTMLElement): HTMLElement[] {
  return Array.from(content.querySelectorAll<HTMLElement>(GROUP_SELECTOR)).filter(group =>
    visible(group) && !!group.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled), [role="radio"]'));
}

function groupIdentity(group: HTMLElement): string {
  return group.getAttribute("aria-label") ?? group.querySelector("h3, h4, legend")?.textContent ?? "";
}

function follows(element: HTMLElement, candidate: HTMLElement): boolean {
  return !element.contains(candidate) && !!(element.compareDocumentPosition(candidate) & 4);
}

export type WizardChoiceSnapshot = {
  choice: HTMLElement;
  boundary: HTMLElement | null;
  groups: Map<HTMLElement, string>;
  version: number;
};

/** Capture before the choice handler changes React state. Ordinary inputs,
 * navigation, loading, hydration and scene changes never create a request. */
export function captureWizardChoice(content: HTMLElement, scroller: HTMLElement, target: Element): WizardChoiceSnapshot | null {
  const choice = target.closest<HTMLElement>(CHOICE_SELECTOR);
  if (!choice || !content.contains(choice) || choice.matches(':disabled, [aria-disabled="true"]') ||
    choice.closest('[role="tablist"], .day-night-switch, [data-wizard-guidance-ignore]')) return null;
  if (!choice.closest(GROUP_SELECTOR) && !choice.hasAttribute("data-wizard-choice")) return null;
  claimWizardGuidance(scroller);
  let boundary = choice.closest<HTMLElement>(GROUP_SELECTOR);
  // Variants may be interleaved with their parent alternatives in a grid.
  // Finish that entire decision before moving to a separate options group.
  let grid = choice.closest<HTMLElement>('[data-wizard-choice-grid]');
  while (grid && content.contains(grid)) {
    boundary = grid;
    grid = grid.parentElement?.closest<HTMLElement>('[data-wizard-choice-grid]') ?? null;
  }
  return {
    choice,
    boundary: boundary && content.contains(boundary) ? boundary : null,
    groups: new Map(groups(content).map(group => [group, groupIdentity(group)])),
    version: wizardGuidanceVersion(scroller),
  };
}

/** Newly disclosed children win. Otherwise move past the whole choice group,
 * never from a clicked card to an arbitrary later card in that same group. */
export function nextWizardOptions(content: HTMLElement, snapshot: WizardChoiceSnapshot): HTMLElement | null {
  const { choice, boundary } = snapshot;
  const connected = content.contains(choice);
  if (connected && choice.getAttribute("aria-pressed") === "false" && choice.getAttribute("aria-expanded") !== "true") return null;
  const current = groups(content);
  const disclosed = current.find(group =>
    snapshot.groups.get(group) !== groupIdentity(group) && !group.contains(choice) && (!connected || follows(choice, group)));
  if (disclosed) return disclosed;
  if (!connected || !boundary || !content.contains(boundary)) return null;
  return current.find(group => follows(boundary, group)) ?? null;
}

/** Show the beginning and some options without moving a group that already
 * fits in view. Never use scrollIntoView: it can move the page/3D viewport. */
export function revealWizardOptions(scroller: HTMLElement, target: HTMLElement, reducedMotion: boolean): boolean {
  const viewport = scroller.getBoundingClientRect();
  const bounds = target.getBoundingClientRect();
  const visibleBottom = Math.min(bounds.bottom, bounds.top + 96);
  if (bounds.top >= viewport.top + 8 && visibleBottom <= viewport.bottom - 24) return false;
  const top = Math.max(0, Math.min(
    scroller.scrollTop + bounds.top - viewport.top - 12,
    Math.max(0, scroller.scrollHeight - scroller.clientHeight),
  ));
  scroller.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
  return true;
}
