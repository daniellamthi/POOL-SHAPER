import { Color } from "three";

/** Display calibration for the existing luminaires; does not alter their layout. */
export const LED_OPTICS = {
  angle: Math.PI * 0.43,
  penumbra: 1,
  decay: 2,
  rangeMultiplier: 2.8,
  targetFloorFraction: 0.22,
  targetThrowFraction: 0.9,
  // Coincident with the lens glass (see the 0.017 circleGeometry in
  // PoolLights) rather than floating ahead of it -- the beam must visibly
  // originate at the fixture, not a point suspended in the water in front
  // of it.
  sourceOffset: 0.019,
  // Soft core glow rendered on top of the lens glass itself, at the same
  // origin as the spotlight above -- not a detached halo. Slightly smaller
  // than the lens radius (0.1) so it reads as the glass lighting up, not a
  // floating sprite.
  glowRadius: 0.082,
  // Diffuser near-field regularisation prevents point-source singularities.
  nearField: 1.4,
  absorption: [0.18, 0.045, 0.023] as const,
  maxLumensPerSquareMetre: 90,
  neutralMix: 0.055,
  maxChromaGain: 1.45,
  shadowSize: 512,
  diffuserSize: 64,
  upperCutoff: 0.5,
  upperFeather: 0.025,
  presentations: {
    day: { output: 0.24, emission: 0.045, glow: 0.32 },
    evening: { output: 0.5, emission: 0.12, glow: 0.5 },
    night: { output: 0.8, emission: 0.22, glow: 0.68 },
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
