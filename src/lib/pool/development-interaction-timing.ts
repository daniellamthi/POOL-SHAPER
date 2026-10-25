// Tab-local QA state survives a Scene remount in the embedded browser. It is
// not project data; resuming removes it, and production never calls these helpers.
const QA_RENDER_PAUSE_KEY = "pool-shaper:qa-render-paused";
export function readDevelopmentRenderPause(): boolean {
  try { return window.sessionStorage.getItem(QA_RENDER_PAUSE_KEY) === "true"; }
  catch { return false; }
}
export function writeDevelopmentRenderPause(paused: boolean): void {
  try {
    if (paused) window.sessionStorage.setItem(QA_RENDER_PAUSE_KEY, "true");
    else window.sessionStorage.removeItem(QA_RENDER_PAUSE_KEY);
  } catch { /* A blocked session store must not break the configurator. */ }
}

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
