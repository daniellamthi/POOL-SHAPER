import { SQM_PER_SKIMMER } from "./config";
import { skimmerWall } from "./walls.ts";
import type { InfinityExclusion } from "./walls.ts";
import { boundaryRuns, sampleWall } from "./boundary-placement.ts";
import type { Outline } from "./types";

export interface SkimmerPlan {
  count: number;
  positions: ReadonlyArray<{ x: number; z: number; rotation: number }>;
  spacing: number;
  cornerDistance: number;
}

/** Existing hydraulic sizing retained; this is indicative configuration, not certification. */
export function planSkimmers(
  outline: Outline,
  waterSurface: number,
  enabled = true,
  infinityExcluded: InfinityExclusion | null = null,
): SkimmerPlan {
  if (!enabled || outline.length < 3 || !Number.isFinite(waterSurface) || waterSurface <= 0)
    return { count: 0, positions: [], spacing: 0, cornerDistance: 0 };
  const count = Math.max(1, Math.ceil(waterSurface / SQM_PER_SKIMMER));
  const preferred = skimmerWall(outline, infinityExcluded);
  const axis = preferred.axis === "x" ? 0 : 1;
  const runs = boundaryRuns(outline, infinityExcluded)
    .filter((r) => r.length > 0.588)
    .sort((a, b) => {
      const pa = sampleWall(a, a.length / 2),
        pb = sampleWall(b, b.length / 2);
      const da = Math.abs((axis === 0 ? pa.x : pa.z) - preferred.coordinate),
        db = Math.abs((axis === 0 ? pb.x : pb.z) - preferred.coordinate);
      return da - db || b.length - a.length;
    });
  const positions: Array<{ x: number; z: number; rotation: number }> = [];
  let spacing = 0;
  for (const run of runs) {
    const margin = Math.min(0.6, run.length / 2);
    const n = Math.min(
      count - positions.length,
      Math.max(1, Math.floor((run.length - 0.588) / 0.9) + 1),
    );
    if (n <= 0) break;
    const pitch = run.length / n;
    for (let i = 0; i < n; i++) {
      const p = sampleWall(run, Math.max(margin, Math.min(run.length - margin, pitch * (i + 0.5))));
      if (positions.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.9)) continue;
      positions.push({ x: p.x, z: p.z, rotation: Math.atan2(p.nx, p.nz) });
    }
    spacing = pitch;
  }
  return {
    count: positions.length,
    positions,
    spacing,
    cornerDistance: Math.min(0.6, spacing / 2),
  };
}
