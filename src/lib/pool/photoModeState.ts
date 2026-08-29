/**
 * Cross-cutting, non-reactive signal read from inside per-frame `useFrame`
 * callbacks (water reflector, caustics uniform updates) that live several
 * component layers away from the Photo Mode toggle. A plain mutable object
 * is deliberate here instead of React context/state: these reads happen
 * every animation frame and must never themselves trigger a re-render.
 *
 * `samples` is the bridge from the path tracer running inside the R3F/Canvas
 * tree back out to the plain-DOM "Refining… N samples" overlay outside the
 * Canvas, which polls this on an interval rather than re-rendering on every
 * accumulated sample.
 *
 * `exportRequestId` is the same bridge in the other direction: the "Generate
 * photo" button lives outside the Canvas (it has to -- it's plain DOM in
 * PoolViewport, not an R3F node) but the frame it needs to save only exists
 * inside PhotoModeRenderer's `useFrame`. The button increments this counter;
 * PhotoModeRenderer compares it against the id it last handled and, on a
 * mismatch, captures that frame's canvas and triggers the download -- a
 * counter rather than a boolean so two rapid clicks can't collapse into one
 * export getting silently dropped.
 */
export const photoModeState = {
  active: false,
  samples: 0,
  exportRequestId: 0,
};

/**
 * Samples measured (see docs/PHOTO_MODE.md) below which the image is still
 * visibly noisy. Below this the "Generate photo" export stays disabled --
 * exporting earlier would just save a grainy frame the user didn't ask for.
 */
export const PHOTO_MODE_EXPORT_READY_SAMPLES = 190;
