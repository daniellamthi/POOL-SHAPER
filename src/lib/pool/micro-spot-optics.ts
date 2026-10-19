import { calibratedLedColor, LED_OPTICS, ledIntensityScale } from "./led-optics";
import { pointInBasin } from "./boundary-placement";
import type { ComfortElementPlan } from "./comfort-plan";
import type { FloorProfileModel } from "./floor-profile";

/** Generic miniature fitting used for visualisation, not a certified product.
 * Metres: the body is recessed; only the rolled trim projects from the riser. */
export const MICRO_SPOT_OPTICS = {
  bodyDepth: 0.012,
  bodyCenter: -0.006,
  trimCenter: 0.001,
  trimTube: 0.0012,
  lensCenter: 0.0014,
  emitterEpsilon: 0.0002,
  lensRadiusRatio: 0.35,
  /** A miniature aperture's near field, not the main PAR flood's1.4m. */
  nearField: 0.06,
  // A local accent, not a miniature floodlight. Visualisation budget only;
  // the shared perceptual dimmer and RGB calibration remain unchanged.
  outputCandela: 2,
  range: 0.9,
  angle: Math.PI * 0.3,
  target: [0, -0.18, 0.42] as const,
} as const;

export interface MicroSpotBeam {
  target: readonly [number, number, number];
  range: number;
}

/** Bench beams aim at the real footwell, not a staircase-sized fixed drop.
 * Trace the seat normal through the actual tier boundaries to keep the aim
 * inside the free legroom; the receiver is the raised tub floor, or the
 * actual sloped/flat basin floor when there is no raised tier. */
export function benchMicroSpotBeam(
  spot: NonNullable<ComfortElementPlan["spots"]>[number],
  element: ComfortElementPlan,
  floor: FloorProfileModel,
): MicroSpotBeam {
  const [nx, nz] = spot.dir;
  const intersections = [
    element.footprint,
    ...(element.tiers ?? [])
      .filter((tier) => tier.role !== "tubFloor")
      .map((tier) => tier.footprint),
  ].flatMap((outline) =>
    outline.flatMap((a, i) => {
      const b = outline[(i + 1) % outline.length]!;
      const sx = b[0] - a[0],
        sz = b[1] - a[1];
      const cross = nx * sz - nz * sx;
      if (Math.abs(cross) < 1e-9) return [];
      const ax = a[0] - spot.x,
        az = a[1] - spot.z;
      const along = (ax * sz - az * sx) / cross;
      const edge = (ax * nz - az * nx) / cross;
      return along > 1e-5 && edge >= -1e-8 && edge <= 1 + 1e-8 ? [along] : [];
    }),
  );
  const forward = Math.min(0.5, Math.min(...intersections, 1) / 2);
  const x = spot.x + nx * forward,
    z = spot.z + nz * forward;
  const receiverY = Math.max(
    floor.floorYAt(x, z),
    ...(element.tiers ?? [])
      .filter((tier) => tier.topY < spot.y && pointInBasin(x, z, tier.footprint))
      .map((tier) => tier.topY),
  );
  const target = [0, receiverY - spot.y, forward] as const;
  // Keep the receiver well inside the analytic light's smooth cutoff. A
  // cutoff at the floor itself yields zero light, even when the cone aims
  // correctly. This adjusts reach, never the RGB/dimmer/intensity budget.
  const distance = Math.hypot(target[1], target[2] - MICRO_SPOT_OPTICS.lensCenter);
  return { target, range: Math.max(MICRO_SPOT_OPTICS.range, distance * 2.4) };
}

/** Exactly the main RGB calibration and dimmer curve, at a miniature output.
 * Independent optional switches do not invent an independent colour setting. */
export function microSpotPresentation(night: boolean, ledColor = "#ffffff", ledIntensity?: number) {
  const dimmer = ledIntensityScale(ledIntensity);
  return {
    colour: calibratedLedColor(ledColor),
    emission: night ? LED_OPTICS.presentations.night.emission * 0.28 * dimmer.emission : 0,
    output: night
      ? MICRO_SPOT_OPTICS.outputCandela * LED_OPTICS.presentations.night.output * dimmer.output
      : 0,
  };
}
