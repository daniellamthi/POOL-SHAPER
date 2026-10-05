import type { Outline } from "@/lib/pool/types";
import { boundaryRuns, sampleWall, pointInBasin } from "@/lib/pool/boundary-placement";
import type { InfinityExclusion } from "@/lib/pool/walls";

export interface ExternalStaircaseProps {
  outline: Outline;
  groundY: number;
  topY: number;
  copingOffset: number;
  infinityExcluded?: InfinityExclusion | null;
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
}: ExternalStaircaseProps) {
  const height = topY - groundY;
  const stepCount = clamp(Math.ceil(height / 0.2), 1, 14);
  const rise = height / stepCount;
  const treadDepth = clamp(height * 0.19, 0.27, 0.34);
  const width = 0.96;
  const runs = boundaryRuns(outline, infinityExcluded)
    .filter((r) => r.length >= width + 0.4)
    .sort((a, b) => b.length - a.length);
  for (const wall of runs)
    for (const fraction of [0.5, 0.25, 0.75]) {
      const p = sampleWall(
        wall,
        Math.max(width / 2 + 0.2, Math.min(wall.length - width / 2 - 0.2, wall.length * fraction)),
      );
      const outward = [-p.nx, -p.nz] as const;
      const x = p.x + outward[0] * copingOffset,
        z = p.z + outward[1] * copingOffset;
      let clear = true;
      for (let d = 0.02; d <= stepCount * treadDepth + 0.1; d += 0.15)
        for (const w of [-width / 2, 0, width / 2]) {
          if (pointInBasin(x + outward[0] * d + p.tx * w, z + outward[1] * d + p.tz * w, outline))
            clear = false;
        }
      if (clear)
        return {
          height,
          stepCount,
          rise,
          treadDepth,
          width,
          x,
          z,
          rotation: Math.atan2(outward[0], outward[1]),
        };
    }
  return null;
}
