import { Color } from "three";

/** Display calibration for the existing luminaires; does not alter their layout. */
export const LED_OPTICS = {
  angle: Math.PI * 0.43,
  penumbra: 1,
  decay: 2,
  rangeMultiplier: 2.8,
  // ---- Authoritative fixture transform -------------------------------
  // Every emissive element derives from these two numbers: the lens glass,
  // its core glow, the spotlight origin and the near-field scattering
  // volume all sit at `lensCenter`, and the beam runs along the fixture's
  // own +Z (the wall normal). Nothing is allowed to invent its own offset.
  lensCenter: 0.017,
  /** Microscopic forward nudge so the emitter does not z-fight the glass it
   * sits on. Two tenths of a millimetre -- not a visible gap. */
  emitterEpsilon: 0.0002,
  /** Beam axis follows the wall normal, with only a slight downward bias:
   * a real recessed luminaire is aimed very marginally down, not raked at
   * the floor. */
  targetFloorFraction: 0.05,
  targetThrowFraction: 1,
  // Soft core glow rendered on the lens glass itself. Slightly smaller than
  // the lens radius (0.1) so it reads as the glass lighting up.
  glowRadius: 0.082,
  /** Near-field scattering volume: the water immediately in front of the
   * lens, lit by the beam passing through it. Without this there is nothing
   * rendered between the lens and the far wall, and the illuminated patch
   * reads as though it came from somewhere else entirely. Radius in metres.
   * Deliberately short -- single scattering is brightest close to the
   * source, where irradiance is highest, and falls away quickly. */
  /** The lit water is a BEAM, not a halo. It is a frustum whose first slice
   * is the lens glass itself and which opens along the lens normal, so the
   * illuminated volume begins hard against the glass and stays continuous
   * out to the surfaces it lights. A sphere centred on the fixture was the
   * wrong shape: it reads as a glow around the lamp, never as light leaving
   * it. Metres. */
  beamLength: 2.6,
  /** Start radius = the lens aperture, so the beam cannot begin anywhere
   * other than on the glass. */
  beamStartRadius: 0.1,
  /** End radius after `beamLength` -- a wide flood, matching a real
   * underwater luminaire rather than a torch. */
  beamEndRadius: 1.45,
  /** Exponential extinction along the beam: water absorbs, and irradiance
   * dilutes as the cone opens. */
  beamExtinction: 1.9,
  /** Radiance gain applied to the integrated single-scattering term. */
  beamGain: 9,
  /** Padding on the bounding hull so the Gaussian cross-section is not
   * clipped by the shell the shader is integrated on. */
  beamHullPad: 1.25,
  /** Both emissive volumes sit in the opaque render list (so the water's
   * transmission pass, which renders opaque objects only, can see them) but
   * must be drawn after the geometry they sit in front of, because neither
   * writes depth. */
  glowRenderOrder: 9,
  beamRenderOrder: 10,
  // Diffuser near-field regularisation prevents point-source singularities.
  nearField: 1.4,
  absorption: [0.18, 0.045, 0.023] as const,
  maxLumensPerSquareMetre: 90,
  neutralMix: 0.055,
  maxChromaGain: 1.45,
  shadowSize: 512,
  diffuserSize: 64,
  // Shielding of the lamp's upper lobe. A submerged luminaire should not
  // throw light onto the dry deck, but the old values (0.5 / 0.025) sliced the
  // cone in half with a hard edge at exactly the fixture's own height: the
  // surviving lower lobe lit the floor and nothing else, which read as a beam
  // that starts on the floor. Now only the topmost part of the cone is
  // attenuated, and it fades over a wide feather, so the wall, the water
  // volume and the floor are lit continuously outward from the lens.
  upperCutoff: 0.78,
  upperFeather: 0.3,
  presentations: {
    // `emission` lights the glass itself, `glow` its bright core, `scatter`
    // the water volume in front of it. All three scale together so the lens
    // always reads as the source of whatever the beam is doing.
    //
    // `emission` is deliberately far above 1: a real luminaire's lens is
    // orders of magnitude brighter than the surfaces around it and clips to
    // white in any photograph of it. Anything at or below 1 renders as pale
    // grey glass and never reads as switched on.
    day: { output: 0.24, emission: 3, glow: 0.6, scatter: 0.3 },
    evening: { output: 0.5, emission: 9, glow: 0.85, scatter: 0.55 },
    night: { output: 0.85, emission: 16, glow: 1, scatter: 0.8 },
  },
} as const;

export const isLedColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export function calibratedLedColor(value = "#ffffff") {
  // CSS colours enter as sRGB; Color converts once to the linear lighting space.
  const color = new Color(isLedColor(value) ? value : "#ffffff");
  const neutral = new Color().setRGB(0.96, 0.98, 1);
  color.lerp(neutral, LED_OPTICS.neutralMix);
  const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  return color.multiplyScalar(Math.min(LED_OPTICS.maxChromaGain, 0.8 / Math.max(luminance, 0.01)));
}

export function ledCandela(area: number, count: number, lumens: number, presentation: keyof typeof LED_OPTICS.presentations = "day") {
  if (count <= 0 || area <= 0 || lumens <= 0) return 0;
  const perFixtureLumens = Math.min(lumens, area * LED_OPTICS.maxLumensPerSquareMetre / count);
  const solidAngle = 2 * Math.PI * (1 - Math.cos(LED_OPTICS.angle));
  return perFixtureLumens * LED_OPTICS.presentations[presentation].output / solidAngle;
}

export function hueToLedHex(hue: number) {
  const h = ((hue % 360) + 360) % 360 / 60;
  const x = 1 - Math.abs(h % 2 - 1);
  const rgb = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  return `#${rgb.map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function ledHexToHue(value: string) {
  if (!isLedColor(value)) return 0;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
  const max = Math.max(r!, g!, b!), delta = max - Math.min(r!, g!, b!);
  if (!delta) return 0;
  const h = max === r ? (g! - b!) / delta : max === g ? (b! - r!) / delta + 2 : (r! - g!) / delta + 4;
  return (h * 60 + 360) % 360;
}
