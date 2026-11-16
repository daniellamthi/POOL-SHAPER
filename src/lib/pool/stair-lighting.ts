import type { resolveAccessPlan } from "@/components/pool/three/PoolAccessModel";
import type { ComfortPlan } from "./comfort-plan";
import type { FloorProfileModel } from "./floor-profile";

export interface StairMicroSpot {
  x: number;
  y: number;
  z: number;
  dir: readonly [number, number];
}

/** Fittings only: derive from the approved flight, never alter its geometry.
 * One small fitting per straight riser; corner returns follow their actual
 * rectilinear or curved front faces, including mirrored/Infinity placement. */
export function planStairMicroSpots(
  access: ReturnType<typeof resolveAccessPlan>,
  comfort: ComfortPlan,
  topY: number,
  floor: FloorProfileModel,
): StairMicroSpot[] {
  const spots: StairMicroSpot[] = [];
  if (access.placement && access.steps && !access.ladderDepths.length && !access.reason) {
    const p = access.placement, c = Math.cos(p.rotation), s = Math.sin(p.rotation);
    const place = (x: number, z: number, y: number, nx: number, nz: number) => spots.push({
      x: p.x + c * x + s * z, z: p.z - s * x + c * z, y,
      dir: [c * nx + s * nz, -s * nx + c * nz],
    });
    for (let i = 0; i < access.steps; i++) {
      const y = topY - (i + 1.5) * access.rise;
      const radius = access.corner?.radii[i];
      if (radius !== undefined) {
        if (access.corner?.rectangular) {
          const inner = i ? access.corner.radii[i - 1]! : 0;
          const along = (inner + radius) / 2;
          place(radius, along, y, 1, 0);
          place(along, radius, y, 0, 1);
        } else {
          // One centred fitting on each curved riser, not a dotted arc of
          // paired lamps. The real radial normal survives every mirroring.
          const a = Math.PI / 4;
          place(radius * Math.sin(a), radius * Math.cos(a), y, Math.sin(a), Math.cos(a));
        }
      } else place(0, (i + 1) * access.tread, y, 0, 1);
    }
  }
  for (const element of comfort.elements) {
    const steps = element.steps;
    if (!steps?.length || !element.landing) continue;
    const center = (points: typeof element.footprint) => [
      points.reduce((v, p) => v + p[0], 0) / points.length,
      points.reduce((v, p) => v + p[1], 0) / points.length,
    ] as const;
    const first = center(steps[0]!.footprint), start = center(element.landing.footprint);
    const dx = first[0] - start[0], dz = first[1] - start[1];
    const dir: readonly [number, number] = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
    // Include landing -> first step, then every exposed tread -> next step/floor.
    [element.landing, ...steps].forEach((part, i, parts) => {
      const mid = center(part.footprint);
      const x = dir[0] ? (dir[0] > 0 ? Math.max : Math.min)(...part.footprint.map(p => p[0])) : mid[0];
      const z = dir[1] ? (dir[1] > 0 ? Math.max : Math.min)(...part.footprint.map(p => p[1])) : mid[1];
      const lower = parts[i + 1]?.topY ?? floor.floorYAt(x, z);
      if (part.topY - lower > 0.08) spots.push({ x, z, y: (part.topY + lower) / 2, dir });
    });
  }
  return spots;
}
