/**
 * Adapter between the app and whatever actually runs Cycles for the
 * "Generate Photorealistic Render" button. Today that's the local dev
 * bridge in scripts/render-bridge.mjs (a plain Node server the developer
 * runs alongside `npm run dev`, see its own header comment for why this
 * can't live inside the Cloudflare Workers build). Every call here goes
 * through this one module and speaks only HTTP + jobId, so swapping the
 * local bridge for a remote render backend later is a change to this file
 * alone -- the UI never needs to know the difference.
 */
import type { PoolRenderConfig } from "./types";

export type RenderJobPhase = "queued" | "rendering" | "complete" | "error" | "cancelled";

export interface RenderJobStatus {
  status: RenderJobPhase;
  progress: { current: number; total: number } | null;
  error: string | null;
}

function bridgeUrl(): string {
  const fromEnv = import.meta.env["VITE_RENDER_BRIDGE_URL"] as string | undefined;
  return fromEnv && fromEnv.length > 0 ? fromEnv : "http://localhost:5177";
}

/** Cheap reachability probe -- lets the UI fall back to the JSON+CLI export instead of hanging on a bridge that isn't running. */
export async function isRenderBridgeAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${bridgeUrl()}/health`, { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function submitRenderJob(config: PoolRenderConfig): Promise<string> {
  const response = await fetch(`${bridgeUrl()}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Render bridge rejected the job (HTTP ${response.status}).`);
  }
  const body = (await response.json()) as { jobId: string };
  return body.jobId;
}

export async function getRenderJobStatus(jobId: string): Promise<RenderJobStatus> {
  const response = await fetch(`${bridgeUrl()}/render/${jobId}`);
  if (!response.ok) {
    throw new Error(`Couldn't read render status (HTTP ${response.status}).`);
  }
  return (await response.json()) as RenderJobStatus;
}

export function getRenderOutputUrl(jobId: string): string {
  return `${bridgeUrl()}/render/${jobId}/output`;
}

export async function cancelRenderJob(jobId: string): Promise<void> {
  await fetch(`${bridgeUrl()}/render/${jobId}/cancel`, { method: "POST" }).catch(() => {});
}

/**
 * Submits the job and polls until it settles. Resolves once the PNG is
 * ready; the caller reads it via `getRenderOutputUrl(jobId)`. Rejects (with
 * a human-readable message) on error/cancellation, or if `signal` aborts.
 */
export async function runPhotorealisticRender(
  config: PoolRenderConfig,
  options: {
    signal?: AbortSignal;
    onProgress?: (status: RenderJobStatus) => void;
    intervalMs?: number;
  } = {},
): Promise<string> {
  const jobId = await submitRenderJob(config);
  const interval = options.intervalMs ?? 1000;

  while (true) {
    if (options.signal?.aborted) {
      void cancelRenderJob(jobId);
      throw new Error("Render cancelled.");
    }
    const status = await getRenderJobStatus(jobId);
    options.onProgress?.(status);
    if (status.status === "complete") return jobId;
    if (status.status === "error") throw new Error(status.error ?? "Render failed.");
    if (status.status === "cancelled") throw new Error("Render cancelled.");
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
