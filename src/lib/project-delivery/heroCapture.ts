/**
 * Clean hero capture (Build 2): a request/response channel between the
 * delivery UI and the live 3D canvas. Plain mutable state, matching the
 * `photoModeState` / `renderQualityState` pattern -- read every frame,
 * never a React re-render. The canvas holds only the 3D scene (all wizard
 * chrome is DOM on top of it), so the capture is overlay-free by design.
 */
export const heroCaptureState: {
  pending: ((dataUrl: string | null) => void) | null;
} = { pending: null };

/** Resolves with a JPEG data URL of the next settled frame, or null. */
export function requestHeroCapture(timeoutMs = 120_000): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (heroCaptureState.pending === done) heroCaptureState.pending = null;
      resolve(null);
    }, timeoutMs);
    const done = (dataUrl: string | null) => {
      clearTimeout(timer);
      resolve(dataUrl);
    };
    heroCaptureState.pending = done;
  });
}
