/** Opt-in DEV-only QA timing. Measures trusted input to second animation-frame
 * callback, NOT GPU completion or the final 3D paint. No customer values,
 * element text, credentials or project data are observed or logged. */
export function installDevelopmentInteractionTiming(): () => void {
  if (!new URLSearchParams(window.location.search).has("qaInteractionTiming")) return () => {};
  const pending = new Set<number>();
  let samples = 0;
  const record = (event: Event) => {
    if (!event.isTrusted || document.visibilityState !== "visible" || samples >= 60) return;
    if (!(event.target instanceof Element) || !event.target.closest("button,input,[role=slider]")) return;
    const sample = ++samples;
    const startedAt = performance.now();
    const first = requestAnimationFrame(() => {
      pending.delete(first);
      const second = requestAnimationFrame(() => {
        pending.delete(second);
        console.debug("[Pool3D input feedback]", JSON.stringify({
          sample, event: event.type,
          inputToSecondRafMs: Number((performance.now() - startedAt).toFixed(2)),
          visibility: document.visibilityState,
          method: "trusted input to second rAF; not GPU or final 3D paint",
        }));
      });
      pending.add(second);
    });
    pending.add(first);
  };
  const events = ["click", "input", "change"] as const;
  for (const event of events) window.addEventListener(event, record, { capture: true, passive: true });
  return () => {
    for (const event of events) window.removeEventListener(event, record, true);
    for (const frame of pending) cancelAnimationFrame(frame);
  };
}
