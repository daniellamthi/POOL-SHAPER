import type { PoolRenderOutputPreset, PoolRenderOutputPresetId } from "./types";

/**
 * The two render presets requested for the first pass -- HD for fast
 * iteration/preview, 4K for the final deliverable. Sample counts are
 * starting points (Cycles' adaptive sampling + OIDN denoising means a clean
 * image rarely needs the library's own bounce-heavy defaults) and are meant
 * to be tuned once a real Cycles run exists to measure against, the same way
 * docs/PHOTO_MODE.md's path-tracer numbers were tuned from measurements, not
 * guessed once and left alone.
 */
export const RENDER_OUTPUT_PRESETS: Record<PoolRenderOutputPresetId, PoolRenderOutputPreset> = {
  hd: { id: "hd", width: 1920, height: 1080, samples: 256, denoise: true },
  "4k": { id: "4k", width: 3840, height: 2160, samples: 512, denoise: true },
};

export const DEFAULT_RENDER_OUTPUT_PRESET_ID: PoolRenderOutputPresetId = "hd";
