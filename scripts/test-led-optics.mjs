import assert from 'node:assert/strict';
import { calibratedLedColor, hueToLedHex, ledHexToHue, ledCandela, LED_OPTICS, isLedColor } from '../src/lib/pool/led-optics.ts';

for (let hue = 0; hue < 360; hue++) {
  const hex = hueToLedHex(hue);
  assert.ok(isLedColor(hex));
  const difference = Math.abs(ledHexToHue(hex) - hue);
  assert.ok(Math.min(difference, 360 - difference) < 0.13);
  const color = calibratedLedColor(hex);
  assert.ok([color.r, color.g, color.b].every(n => Number.isFinite(n) && n > 0 && n <= LED_OPTICS.maxChromaGain));
}
assert.equal(hueToLedHex(0), '#ff0000');
assert.equal(hueToLedHex(180), '#00ffff');
assert.equal(hueToLedHex(-80), hueToLedHex(280));
assert.deepEqual(calibratedLedColor('invalid'), calibratedLedColor('#ffffff'));
assert.equal(isLedColor('#fff'), false);
assert.equal(ledCandela(32, 0, 1500), 0);
assert.ok(ledCandela(32, 8, 1500) < ledCandela(32, 2, 1500));
const solidAngle = 2 * Math.PI * (1 - Math.cos(LED_OPTICS.angle));
for (const [area, count] of [[18, 2], [32, 2], [50, 3], [72, 4], [32, 8]]) {
  const total = ledCandela(area, count, 1500) * count * solidAngle / LED_OPTICS.presentations.day.output;
  assert.ok(total <= area * LED_OPTICS.maxLumensPerSquareMetre + 1e-8);
}
assert.ok(LED_OPTICS.absorption[0] > LED_OPTICS.absorption[1] && LED_OPTICS.absorption[1] > LED_OPTICS.absorption[2]);
console.log('PASS: 360 hue round trips, finite calibrated RGB, input validation, count-normalised light budget and spectral attenuation');
