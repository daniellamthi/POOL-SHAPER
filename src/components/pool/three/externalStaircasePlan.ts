import type { Outline } from "@/lib/pool/types";
import { boundaryRuns, sampleWall, pointInBasin } from "@/lib/pool/boundary-placement";
import type { InfinityExclusion } from "@/lib/pool/walls";
import type { ExternalStairSide } from "@/lib/pool/above-ground";

export interface ExternalStaircaseProps {
  outline: Outline;
  groundY: number;
  topY: number;
  copingOffset: number;
  infinityExcluded?: InfinityExclusion | null;
  side?: ExternalStairSide;
  platformExtended?: boolean;
  /** The actual internal access, not a fixed pool corner. */
  accessAnchor?: { x: number; z: number } | null;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** Where the staircase stands (pure; also used to keep deck furniture off it). */
export function planExternalStaircase({
  outline,
  groundY,
  topY,
  copingOffset,
  infinityExcluded = null,
  side = "short",
  accessAnchor = null,
}: ExternalStaircaseProps) {
  const height = topY - groundY;
  if (height <= 0) return null;
  const stepCount = clamp(Math.ceil(height / 0.19), 2, 14);
  const rise = height / stepCount;
  const treadDepth = 0.3;
  const width = 1.1;
  const run = (stepCount-1)*treadDepth;
  const runs = boundaryRuns(outline, infinityExcluded)
    .filter((r) => r.length >= width + 0.4)
    ;
  if (!runs.length) return null;
  const selectedLength = side === "long" ? Math.max(...runs.map(r => r.length)) : Math.min(...runs.map(r => r.length));
  const candidates = runs.filter(r => Math.abs(r.length - selectedLength) < 0.05).flatMap(wall => {
    const availableLanding = wall.length + 2 * copingOffset - run;
    if (availableLanding < 1.05 - 1e-6) return [];
    const landingDepth = availableLanding;
    const start = sampleWall(wall,0);
    const desired = accessAnchor
      ? (accessAnchor.x-start.x)*start.tx + (accessAnchor.z-start.z)*start.tz
      : wall.length / 2;
    const low = -copingOffset+landingDepth/2, high = wall.length+copingOffset-landingDepth/2;
    const choices = [{direction:1,minimum:low,maximum:high-run},{direction:-1,minimum:low+run,maximum:high}]
      .filter(choice => choice.minimum<=choice.maximum+1e-6)
      .map(choice => ({...choice,centre:clamp(desired,choice.minimum,choice.maximum)}))
      .sort((a,b) => Math.abs(a.centre-desired)-Math.abs(b.centre-desired));
    if (!choices.length) return [];
    const centre = choices[0]!.centre;
    const direction = choices[0]!.direction;
    const p = sampleWall(wall,centre);
    return [{wall,p,direction,landingDepth,score:accessAnchor ? Math.hypot(p.x-accessAnchor.x,p.z-accessAnchor.z) : 0}];
  }).sort((a,b) => a.score-b.score);
  for (const {p,direction,landingDepth} of candidates) {
      const outward = [-p.nx, -p.nz] as const;
      const walk = [p.tx*direction,p.tz*direction] as const;
      const rotation = Math.atan2(walk[0],walk[1]);
      const right = [Math.cos(rotation),-Math.sin(rotation)] as const;
      const x = p.x + outward[0] * (copingOffset+width/2),
        z = p.z + outward[1] * (copingOffset+width/2);
      const world = (across:number,along:number) => [x+right[0]*across+walk[0]*along,z+right[1]*across+walk[1]*along] as const;
      let clear = true;
      for (let d = -landingDepth/2; d <= landingDepth/2+run; d += 0.15)
        for (const w of [-width / 2, 0, width / 2]) {
          if (pointInBasin(...world(w,d),outline))
            clear = false;
        }
      if (clear)
        return {
          height,
          stepCount,
          rise,
          treadDepth,
          width,
          landingDepth,
          run,
          side,
          outward,
          walk,
          poolSide: (outward[0]*right[0]+outward[1]*right[1] > 0 ? -1 : 1) as -1|1,
          footprint: [world(-width/2,-landingDepth/2),world(width/2,-landingDepth/2),world(width/2,landingDepth/2+run),world(-width/2,landingDepth/2+run)],
          x,
          z,
          rotation,
        };
  }
  return null;
}
