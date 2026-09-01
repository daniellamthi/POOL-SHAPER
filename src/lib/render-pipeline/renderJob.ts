/**
 * The "Generate Photorealistic Render" job interface -- deliberately
 * separate from the Three.js renderer (PoolScene.tsx / PhotoModeRenderer.tsx)
 * and from React: this module knows nothing about the Canvas, R3F, or the
 * live scene graph, only about `PoolRenderConfig` JSON.
 *
 * It is NOT a live server round-trip that runs Blender for you. This app
 * builds to the `cloudflare-module` Nitro preset (see the generated
 * `.output/server/wrangler.json`) -- a Cloudflare Worker, which has no
 * filesystem and cannot spawn a `blender` subprocess. There is no edge
 * runtime this app could deploy to that would let a button press run Cycles
 * server-side. So the real job boundary here is: this module hands back a
 * validated JSON export plus the exact CLI invocation to run it through
 * rendering/blender/pool_render.py -- Cycles itself runs wherever Blender is
 * actually installed (a developer machine or a dedicated render box), kicked
 * off by that command.
 */
import { validatePoolRenderConfig } from "./schema";
import type { PoolRenderConfig } from "./types";

const CYCLES_ENTRY_POINT = "rendering/blender/pool_render.py";

export interface PhotorealisticRenderJob {
  config: PoolRenderConfig;
  /** Suggested filename for the exported config JSON. */
  configFilename: string;
  /** Suggested filename for the rendered still. */
  outputFilename: string;
  /** Pretty-printed JSON, ready to write to disk or download. */
  json: string;
  /** The exact `blender --background ...` invocation that consumes `configFilename` and produces `outputFilename`. */
  cyclesCommand: string;
}

function buildCyclesCommand(
  configFilename: string,
  outputFilename: string,
  config: PoolRenderConfig,
): string {
  return [
    "blender",
    "--background",
    "--factory-startup",
    "--python",
    CYCLES_ENTRY_POINT,
    "--",
    "--config",
    configFilename,
    "--assets-root",
    "public",
    "--out",
    outputFilename,
    "--width",
    String(config.outputPreset.width),
    "--height",
    String(config.outputPreset.height),
    "--samples",
    String(config.outputPreset.samples),
  ].join(" ");
}

/**
 * Validates a `PoolRenderConfig` and prepares everything needed to hand it
 * off to Blender. Throws (via `validatePoolRenderConfig`) if the config
 * doesn't satisfy the schema -- callers should not send an unvalidated
 * config any further down the pipeline.
 */
export function preparePhotorealisticRenderJob(config: PoolRenderConfig): PhotorealisticRenderJob {
  const validated = validatePoolRenderConfig(config);
  const stamp = validated.generatedAt.replace(/[:.]/g, "-");
  const configFilename = `pool-render-config-${stamp}.json`;
  const outputFilename = `pool-render-${stamp}.png`;
  return {
    config: validated,
    configFilename,
    outputFilename,
    json: JSON.stringify(validated, null, 2),
    cyclesCommand: buildCyclesCommand(configFilename, outputFilename, validated),
  };
}

/**
 * Browser-only: triggers a JSON file download via a temporary object URL --
 * the same client-side, no-server pattern `exportCurrentFrame` uses for the
 * Photo Mode PNG export (see PhotoModeRenderer.tsx).
 */
export function downloadPhotorealisticRenderJob(job: PhotorealisticRenderJob): void {
  const blob = new Blob([job.json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = job.configFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
