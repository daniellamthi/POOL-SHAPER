import { Color } from "three";

/** Display calibration for the existing luminaires; does not alter their layout. */
export const LED_OPTICS = {
  // 144 degree flood (was 155): a tighter cone keeps the light in the
  // basin and gives the beam a readable centre instead of a uniform wash.
  angle: Math.PI * 0.4,
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
  targetFloorFraction: 0.22,
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
  /** Soft knee on each submerged lamp's direct irradiance, applied per
   * fragment before shading (ledTransmission.ts). The liner right in front
   * of a lamp receives tens of times the dusk scene's exposure; left alone
   * the tone mapper clips that patch to white and the chosen colour is lost
   * -- an orange lamp on a sand liner read as pale yellow. Luminance-based,
   * so hue is preserved exactly; the far field (small values) is barely
   * touched, which keeps the beam's reach. */
  irradianceKnee: 0.06,
  // Red is absorbed first in clear water; kept a little below the textbook
  // value so a warm lamp still reads warm on the far side of a 4 m basin.
  absorption: [0.14, 0.045, 0.023] as const,
  maxLumensPerSquareMetre: 110,
  /**
   * A real underwater LED is never spectrally pure: its phosphor and its
   * diffuser both wash the primary. A small neutral mix lets a deep blue or
   * red reach the same luminance as green without a grotesque gain, and is
   * why the lens core reads as a bright lamp rather than as a saturated gel.
   * Kept low (5%): at 12% an orange lamp drifted to amber and vanished
   * against a sand liner.
   */
  neutralMix: 0.05,
  /**
   * Every hue is normalised to one luminance, so the colour wheel changes the
   * colour of the pool and not its brightness. Without it green landed twice
   * as bright as red, because the eye weights green 10x more -- the same
   * reason a naive RGB lamp looks like a nightclub.
   */
  targetLuminance: 0.62,
  maxChromaGain: 4,
  /**
   * Saturation pushed around the luminance axis before normalising. A lit
   * liner multiplies the lamp by its own albedo and then mixes with the
   * dusk ambient: on a sand liner a textbook orange came out as amber. The
   * boost keeps every hue legible on every finish; neutral white is a fixed
   * point and is untouched.
   */
  chromaBoost: 1.5,
  /**
   * Perceptual curve on the intensity control. Straight linear scaling makes
   * the bottom half of the slider do almost nothing visible, because both the
   * tone mapping and the eye are already compressive; this restores an even
   * feel across 25 / 50 / 75 / 100.
   */
  intensityGamma: 1.75,
  /** Even at the bottom of the slider the lens is a lamp that is switched on. */
  minEmissionFraction: 0.2,
  /** Default output: an evening setting, not the maximum. */
  defaultIntensity: 0.6,
  shadowSize: 512,
  diffuserSize: 128,
  /** Amplitude of the caustic banding baked into the projector map. Subtle on
   * purpose: a pool lit by one LED ripples, it does not strobe. */
  causticDepth: 0.16,
  // Shielding of the lamp's upper lobe. A submerged luminaire should not
  // throw light onto the dry deck, but the old values (0.5 / 0.025) sliced the
  // cone in half with a hard edge at exactly the fixture's own height: the
  // surviving lower lobe lit the floor and nothing else, which read as a beam
  // that starts on the floor. Now only the topmost part of the cone is
  // attenuated, and it fades over a wide feather, so the wall, the water
  // volume and the floor are lit continuously outward from the lens.
  upperCutoff: 0.72,
  upperFeather: 0.26,
  presentations: {
    // `emission` lights the glass itself, `glow` its bright core, `scatter`
    // the water volume in front of it. All three scale together so the lens
    // always reads as the source of whatever the beam is doing.
    //
    // `emission` is deliberately far above 1: a real luminaire's lens is
    // orders of magnitude brighter than the surfaces around it and clips to
    // white in any photograph of it. Anything at or below 1 renders as pale
    // grey glass and never reads as switched on.
    // `output` is kept moderate on purpose: a hotter lamp only clips the
    // lit liner to white under the tone mapper and the colour is lost. The
    // visible intensity comes from the tighter cone and the brighter beam.
    // Daylight: the lamp is visibly ON at the lens (the customer must see
    // the fixtures they chose) but throws no beam, no lit water and no
    // patch on the liner (2 % residual output, below what the sun leaves
    // visible). Against sunlight a pool LED is invisible in a
    // real photograph; a coloured daytime beam was a CG tell.
    day: { output: 0.02, emission: 1.6, glow: 0.35, scatter: 0 },
    evening: { output: 0.5, emission: 9, glow: 0.9, scatter: 0.75 },
    night: { output: 0.7, emission: 16, glow: 1, scatter: 1 },
  },
} as const;

export const isLedColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

/**
 * One calibrated colour, shared by every part of the luminaire.
 *
 * The lens glass, its core, the spotlight and the scattering volume are all
 * driven by this single value, so the hue the customer picks is the hue of the
 * lens, of the beam, of the lit water and of the pattern thrown on the liner.
 * Nothing downstream is allowed to re-tint: that is how a blue lens ends up
 * with a cyan beam.
 */
export function calibratedLedColor(value = "#ffffff") {
  // CSS colours enter as sRGB; Color converts once to the linear lighting space.
  const color = new Color(isLedColor(value) ? value : "#ffffff");
  const neutral = new Color().setRGB(0.96, 0.98, 1);
  color.lerp(neutral, LED_OPTICS.neutralMix);
  const grey = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  // Never fully black in a channel: a real phosphor LED always leaks a little.
  const floor = grey * 0.02;
  color.setRGB(
    Math.max(floor, grey + (color.r - grey) * LED_OPTICS.chromaBoost),
    Math.max(floor, grey + (color.g - grey) * LED_OPTICS.chromaBoost),
    Math.max(floor, grey + (color.b - grey) * LED_OPTICS.chromaBoost),
  );
  const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  color.multiplyScalar(
    Math.min(LED_OPTICS.maxChromaGain, LED_OPTICS.targetLuminance / Math.max(luminance, 0.01)),
  );
  // `maxChromaGain` is also the ceiling of any single channel, so a deep
  // blue cannot run away past what the tone mapper can still show as blue.
  return color.setRGB(
    Math.min(LED_OPTICS.maxChromaGain, color.r),
    Math.min(LED_OPTICS.maxChromaGain, color.g),
    Math.min(LED_OPTICS.maxChromaGain, color.b),
  );
}

/** Clamp whatever a stored project hands us to a usable 0..1 dimmer setting. */
export function normalisedLedIntensity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : LED_OPTICS.defaultIntensity;
}

/**
 * The dimmer, as one factor applied to every emissive term at once -- lamp
 * output, lens emission, core glow and the scattering volume -- so the beam
 * cannot brighten without the lens that is supposed to be producing it.
 */
export function ledIntensityScale(value: unknown) {
  const setting = normalisedLedIntensity(value);
  const scale = Math.pow(setting, LED_OPTICS.intensityGamma);
  return {
    setting,
    /** Lamp output, beam and lit water scale straight off the curve. */
    output: scale,
    /** The lens keeps a floor: a dimmed lamp is dim, not off. */
    emission: LED_OPTICS.minEmissionFraction + (1 - LED_OPTICS.minEmissionFraction) * scale,
  };
}

export function ledCandela(area: number, count: number, lumens: number, presentation: keyof typeof LED_OPTICS.presentations = "day", intensity = 1) {
  if (count <= 0 || area <= 0 || lumens <= 0) return 0;
  const perFixtureLumens = Math.min(lumens, area * LED_OPTICS.maxLumensPerSquareMetre / count);
  const solidAngle = 2 * Math.PI * (1 - Math.cos(LED_OPTICS.angle));
  const lampOutput = LED_OPTICS.presentations[presentation].output * intensity;
  return perFixtureLumens * lampOutput / solidAngle;
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
