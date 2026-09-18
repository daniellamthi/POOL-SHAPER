import type { Outline } from "./types";
import { skimmerWall } from "./walls.ts";

/** Lighting DESIGN defaults, not a statutory light count or a compliance check. */
export const POOL_LIGHTING_DESIGN = {
  targetIlluminance: 45,
  utilization: 0.65,
  maintenance: 0.85,
  referenceDepth: 1.5,
  depthAllowance: 0.2,
  maxSpacing: 4,
  minCount: 2,
  maxRenderedCount: 8,
  submergence: 0.6,
  floorClearance: 0.2,
  cornerClearance: 0.6,
  fixtureRadius: 0.13,
} as const;

export const POOL_LUMINAIRE = {
  // Generic preview product, not a certified or selected commercial SKU.
  lumens: 1500,
  trim: "steel" as "steel" | "white",
  installation: "fixed-immersed",
  requiredIngressProtection: "IP68; verify declared continuous-immersion conditions",
  supplyAssumption: "12 V AC SELV; transformer and installation to be designed separately",
  certification: "Pool-use certification and installation instructions must be verified",
  complianceVerified: false,
  // Reference for product-class assumptions, not an endorsement of this generic model:
  // https://www.astralpool.com/en/en/pool-lighting/led-lighting/lumiplus-essential/par56-lamps.html
  // https://webstore.iec.ch/en/publication/90423 (IEC 60598-2-18:2022 test report scope)
} as const;

export type LightingExclusion =
  | { kind: "skimmer" | "inlet"; x: number; z: number; radius: number }
  | { kind: "access"; polygon: Outline; clearance: number };

export interface PoolLightPosition {
  x: number; y: number; z: number; rotation: number; throwDistance: number;
}
export interface PoolLightingPlan {
  count: number;
  requestedCount: number;
  surfaceArea: number;
  submergence: number;
  positions: PoolLightPosition[];
  warnings: string[];
}

export function insideLightingOutline(x: number, z: number, outline: Outline): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function segmentDistance(x: number, z: number, a: readonly number[], b: readonly number[]) {
  const dx = b[0]! - a[0]!, dz = b[1]! - a[1]!;
  const t = Math.max(0, Math.min(1, ((x - a[0]!) * dx + (z - a[1]!) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0]! - dx * t, z - a[1]! - dz * t);
}

export function clearsLightingExclusions(x: number, z: number, exclusions: readonly LightingExclusion[], radius: number = POOL_LIGHTING_DESIGN.fixtureRadius): boolean {
  return exclusions.every(exclusion => {
    if (exclusion.kind !== "access") return Math.hypot(x - exclusion.x, z - exclusion.z) > exclusion.radius + radius;
    if (insideLightingOutline(x, z, exclusion.polygon)) return false;
    return exclusion.polygon.every((a, i) => segmentDistance(x, z, a, exclusion.polygon[(i + 1) % exclusion.polygon.length]!) > exclusion.clearance + radius);
  });
}

/** One symmetric row on a clear long wall. Never force a fixture into an obstacle. */
export function planPoolLighting({ outline, waterY, floorY, lumenOutput = POOL_LUMINAIRE.lumens, exclusions = [], design = POOL_LIGHTING_DESIGN }: {
  outline: Outline;
  waterY: number;
  floorY: number;
  lumenOutput?: number;
  exclusions?: readonly LightingExclusion[];
  design?: { [K in keyof typeof POOL_LIGHTING_DESIGN]: number };
}): PoolLightingPlan {
  const empty = (warning: string): PoolLightingPlan => ({ count: 0, requestedCount: 0, surfaceArea: 0, submergence: 0, positions: [], warnings: [warning] });
  if (outline.length < 3 || !outline.every(point => point.every(Number.isFinite)) || !Number.isFinite(waterY) || !Number.isFinite(floorY) || !Number.isFinite(lumenOutput) || lumenOutput <= 0) return empty("Invalid pool or luminaire data");
  const depth = waterY - floorY;
  const minSubmergence = design.fixtureRadius + 0.08;
  const maxSubmergence = depth - design.floorClearance - design.fixtureRadius;
  if (maxSubmergence < minSubmergence) return empty("Insufficient submerged installation clearance");
  const submergence = Math.min(design.submergence, maxSubmergence);
  let signedArea = 0;
  // Luminaires face the skimmers across the basin: they go on the wall
  // parallel to the skimmer run and on the far side of it, never on the
  // skimmer wall itself. The wall is derived from the same canonical rule the
  // skimmers are placed by, so the two can never drift apart, and the row's
  // spacing still comes from the wall's own length.
  const skimmers = skimmerWall(outline);
  const axis = skimmers.axis === "x" ? 0 : 1;
  // 0 = the wall opposite the skimmers, 1 = any other wall, 2 = theirs.
  const wallRank = (a: readonly number[], b: readonly number[]) => {
    if (Math.abs(a[axis]! - b[axis]!) > 1e-6) return 1;
    if (Math.abs(a[axis]! - skimmers.coordinate) < 1e-6) return 2;
    return a[axis]! > skimmers.coordinate ? 0 : 1;
  };
  const edges = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    signedArea += a[0] * b[1] - b[0] * a[1];
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]), rank: wallRank(a, b) };
  }).filter(edge => edge.length > 2 * design.cornerClearance).sort((a, b) => a.rank - b.rank || b.length - a.length);
  const area = Math.abs(signedArea) / 2;
  if (!edges.length || area <= 0) return empty("No straight wall suitable for a symmetric lighting row");
  // Photometrics follow the longest wall in the basin; candidate selection
  // below follows the ranking above.
  const length = Math.max(...edges.map(edge => edge.length));
  const depthFactor = 1 + design.depthAllowance * Math.max(0, depth - design.referenceDepth);
  const requestedCount = Math.max(design.minCount, Math.ceil(length / design.maxSpacing), Math.ceil(area * design.targetIlluminance * depthFactor / (lumenOutput * design.utilization * design.maintenance)));
  const count = Math.min(requestedCount, design.maxRenderedCount);
  const warnings = requestedCount > count ? ["Design exceeds preview light budget; photometric review required"] : [];
  if (submergence < 0.5) warnings.push("Shallow pool: confirm product minimum immersion before installation");
  const result: PoolLightingPlan = { count: 0, requestedCount, surfaceArea: area, submergence, positions: [], warnings };
  for (const edge of edges.filter(candidate => candidate.length >= length * 0.9 && candidate.rank < 2)) {
    const tx = (edge.b[0] - edge.a[0]) / edge.length, tz = (edge.b[1] - edge.a[1]) / edge.length;
    const mx = (edge.a[0] + edge.b[0]) / 2, mz = (edge.a[1] + edge.b[1]) / 2;
    const sign = insideLightingOutline(mx - tz * 0.05, mz + tx * 0.05, outline) ? 1 : -1;
    const nx = -tz * sign, nz = tx * sign;
    // Contract spacing symmetrically only when the full balanced row is obstructed.
    for (const contraction of [1, 0.9, 0.8, 0.7]) {
      const halfSpan = Math.min(edge.length * (count - 1) / (2 * count), edge.length / 2 - design.cornerClearance) * contraction;
      const spacing = count > 1 ? 2 * halfSpan / (count - 1) : 0;
      if (count > 1 && spacing < 2 * design.fixtureRadius + 0.35) continue;
      const row: PoolLightPosition[] = [];
      for (let i = 0; i < count; i++) {
        const along = count === 1 ? 0 : -halfSpan + i * spacing;
        const x = mx + tx * along, z = mz + tz * along;
        if (!clearsLightingExclusions(x, z, exclusions, design.fixtureRadius)) break;
        if (![-design.fixtureRadius, 0, design.fixtureRadius].every(t => insideLightingOutline(x + nx * 0.06 + tx * t, z + nz * 0.06 + tz * t, outline))) break;
        let throwDistance = 0.1;
        while (throwDistance < 40 && insideLightingOutline(x + nx * (throwDistance + 0.1), z + nz * (throwDistance + 0.1), outline)) throwDistance += 0.1;
        if (throwDistance < 1) break;
        row.push({ x, y: waterY - submergence, z, rotation: Math.atan2(nx, nz), throwDistance });
      }
      if (row.length === count) return { ...result, count, positions: row };
    }
  }
  return { ...result, warnings: [...warnings, "No collision-free symmetric row; specialist layout required"] };
}
