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
  /** A requested wall cannot hold the complete hydraulic row. */
  reason?: string;
}

/** Existing hydraulic sizing retained; this is indicative configuration, not certification. */
export function planSkimmers(
  outline: Outline,
  waterSurface: number,
  enabled = true,
  infinityExcluded: InfinityExclusion | null = null,
  placement?: { head: { axis: "x" | "z"; coordinate: number }; reserved: ReadonlyArray<Outline>; clearance: number },
): SkimmerPlan {
  if (!enabled || outline.length < 3 || !Number.isFinite(waterSurface) || waterSurface <= 0)
    return { count: 0, positions: [], spacing: 0, cornerDistance: 0 };
  const count = Math.max(1, Math.ceil(waterSurface / SQM_PER_SKIMMER));
  if (placement) return skimmersOnHead(outline, count, infinityExcluded, placement);
  const preferred = skimmerWall(outline, infinityExcluded);
  const axis = preferred.axis === "x" ? 0 : 1;
  const runs = boundaryRuns(outline, infinityExcluded)
    .filter((r) => r.length > 0.588)
    .sort((a, b) => {
      const pa = sampleWall(a, a.length / 2),
        pb = sampleWall(b, b.length / 2);
      const da = Math.abs((axis === 0 ? pa.x : pa.z) - preferred.coordinate),
        db = Math.abs((axis === 0 ? pb.x : pb.z) - preferred.coordinate);
      // A shortened side of an L is not a suitable preference over its
      // uninterrupted wall. Spread the row on the longest actual mounting
      // run; use the established preferred side only to break equal lengths.
      return b.length - a.length || da - db;
    });
  const positions: Array<{ x: number; z: number; rotation: number }> = [];
  let spacing = 0;
  for (const run of runs) {
    const margin = Math.min(0.6, run.length / 2);
    const n = Math.min(
      count - positions.length,
      Math.max(1, Math.floor((run.length - 2 * margin) / 0.9) + 1),
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

/** Keep the actual wall plane and existing 90 cm fitting spacing. A selected
 * shelf owns its head; skimmers use the opposite head's genuinely free spans. */
function skimmersOnHead(outline: Outline, required: number, excluded: InfinityExclusion | null,
  placement: { head: { axis: "x" | "z"; coordinate: number }; reserved: ReadonlyArray<Outline>; clearance: number }): SkimmerPlan {
  const axis = placement.head.axis === "x" ? 0 : 1, cross = axis === 0 ? 1 : 0;
  const runs = boundaryRuns(outline, excluded).map(run => {
    const points = run.points.filter(point => Math.abs(point[axis] - placement.head.coordinate) < 1e-5);
    const length = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0]-points[i]![0],point[1]-points[i]![1]), 0);
    return { ...run, points, length };
  }).filter(run => run.points.length >= 2 && run.length > 1e-5);
  const positions: Array<{ x: number; z: number; rotation: number }> = [];
  let spacing = 0;
  for (const run of runs) {
    const margin = Math.min(0.6, run.length / 2), start = run.points[0]!, end = run.points.at(-1)!;
    const direction = Math.sign(end[cross] - start[cross]);
    if (!direction) continue;
    let spans: [number,number][] = [[margin, run.length - margin]];
    for (const polygon of placement.reserved) {
      if (!polygon.length) continue;
      const normal = polygon.map(point => point[axis]);
      if (placement.head.coordinate < Math.min(...normal) - placement.clearance || placement.head.coordinate > Math.max(...normal) + placement.clearance) continue;
      const along = polygon.map(point => (point[cross] - start[cross]) * direction);
      const lo = Math.min(...along) - placement.clearance, hi = Math.max(...along) + placement.clearance;
      spans = spans.flatMap(([a,b]) => hi < a || lo > b ? [[a,b] as [number,number]] : [
        ...(lo > a ? [[a, Math.min(b,lo)] as [number,number]] : []),
        ...(hi < b ? [[Math.max(a,hi), b] as [number,number]] : []),
      ]);
    }
    for (const [a,b] of spans.sort((one,two) => (two[1]-two[0])-(one[1]-one[0]))) {
      const n = Math.min(required - positions.length, Math.max(1, Math.floor((b-a+1e-7)/0.9)+1));
      if (n <= 0) break;
      const pitch = n > 1 ? Math.min((b-a)/(n-1), Math.max(0.9,(b-a)/n)) : 0;
      for (let i=0;i<n;i++) {
        const p = sampleWall(run,(a+b)/2 + (i-(n-1)/2)*pitch);
        if (positions.some(q => Math.hypot(q.x-p.x,q.z-p.z) < 0.9-1e-7)) continue;
        positions.push({x:p.x,z:p.z,rotation:Math.atan2(p.nx,p.nz)});
      }
      spacing = pitch || b-a;
    }
  }
  return {count:positions.length,positions,spacing,cornerDistance:Math.min(0.6,spacing/2),
    ...(positions.length < required ? {reason:"Spazio insufficiente sulla testata opposta alla spiaggetta per tutti gli skimmer previsti. Modifica dimensioni, accesso o sistema acqua."} : {})};
}
