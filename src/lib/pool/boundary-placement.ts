import type { Outline } from "./types";
import type { InfinityExclusion } from "./walls";

export type WallRun = { points: Outline; edges: number[]; length: number; winding: number };

export function signedWaterArea(outline: Outline): number {
  return (
    outline.reduce((sum, a, i) => {
      const b = outline[(i + 1) % outline.length]!;
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2
  );
}

/** Runs retain the TRUE polyline: no fitting is ever mounted on an interior chord. */
export function boundaryRuns(
  outline: Outline,
  excluded: InfinityExclusion | null = null,
): WallRun[] {
  const winding = Math.sign(signedWaterArea(outline)) || 1;
  const runs: WallRun[] = [];
  let run: WallRun | undefined;
  let firstTangent = [0, 0],
    previousTangent = [0, 0];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-7) continue;
    const axis = excluded?.axis === "x" ? 0 : 1;
    const blocked =
      excluded?.edgeIndices?.includes(i) ||
      (excluded &&
        !excluded.edgeIndices &&
        Math.abs(a[axis] - excluded.coordinate) < 1e-5 &&
        Math.abs(b[axis] - excluded.coordinate) < 1e-5);
    if (blocked) {
      run = undefined;
      continue;
    }
    const t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    if (
      !run ||
      t[0]! * previousTangent[0]! + t[1]! * previousTangent[1]! < 0.94 ||
      t[0]! * firstTangent[0]! + t[1]! * firstTangent[1]! < 0.65
    ) {
      run = { points: [a, b], edges: [i], length, winding };
      runs.push(run);
      firstTangent = t;
    } else {
      run.points = [...run.points, b];
      run.edges.push(i);
      run.length += length;
    }
    previousTangent = t;
  }
  return runs;
}

export function sampleWall(run: WallRun, distance: number) {
  let remaining = Math.max(0, Math.min(run.length, distance));
  for (let i = 0; i < run.points.length - 1; i++) {
    const a = run.points[i]!,
      b = run.points[i + 1]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (remaining <= length || i === run.points.length - 2) {
      const tx = (b[0] - a[0]) / length,
        tz = (b[1] - a[1]) / length;
      return {
        x: a[0] + tx * remaining,
        z: a[1] + tz * remaining,
        tx,
        tz,
        nx: -tz * run.winding,
        nz: tx * run.winding,
      };
    }
    remaining -= length;
  }
  throw new Error("Empty mounting wall");
}

export function pointInBasin(x: number, z: number, outline: Outline): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!,
      b = outline[j]!;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}
