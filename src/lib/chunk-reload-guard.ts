// `WindowEventMap["vite:preloadError"]` is already declared by vite/client's
// own ambient types (see node_modules/vite/client.d.ts) -- only the app-local
// flag needs adding here.
declare global {
  interface Window {
    __poolChunkReloadGuardInstalled?: boolean;
  }
}

const RELOAD_FLAG_KEY = "pool-configurator:chunk-reload-attempted";

/**
 * Vite dispatches `vite:preloadError` on `window` whenever a dynamically
 * imported chunk fails to fetch -- the standard "stale chunk" failure: the
 * browser still holds an old module graph (from before a rebuild/redeploy)
 * that references a chunk filename no longer served, and every `lazy()` in
 * this app (PoolScene, PremiumPostFX, PhotoModeRenderer, …) is exactly that
 * kind of dynamic import. This is Vite's own documented recovery hook
 * (https://vite.dev/guide/build.html#load-error-handling) -- not a guess at
 * one error's wording, so it fires the same way for any lazy import, in dev
 * and in a production build.
 *
 * A single automatic reload recovers from that specific, well-understood
 * failure by re-fetching the current index.html and its real module graph.
 * `sessionStorage` (scoped to this browser tab until it's closed) makes the
 * "one attempt" durable across the reload itself, so a genuinely broken
 * deployment or a persistent network failure does not reload forever --
 * on a second failure within the same tab session, the error is left to
 * propagate to the route error boundary instead, which now shows full
 * diagnostics on screen (see __root.tsx's ErrorComponent).
 */
export function installChunkReloadGuard(): void {
  if (typeof window === "undefined") return;
  if (window.__poolChunkReloadGuardInstalled) return;
  window.__poolChunkReloadGuardInstalled = true;

  window.addEventListener("vite:preloadError", (event) => {
    const alreadyAttempted = window.sessionStorage.getItem(RELOAD_FLAG_KEY) === "1";
    if (alreadyAttempted) return;
    event.preventDefault();
    window.sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
    window.location.reload();
  });
}
