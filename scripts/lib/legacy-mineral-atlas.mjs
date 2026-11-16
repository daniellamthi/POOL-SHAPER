/** Offline-only source window layout. One source texel per atlas texel; no
 * per-pixel runtime work. All maps of one finish share these exact offsets. */
export const MINERAL_ATLAS = Object.freeze({ period: 2, cells: 8, span: .25, jitter: .44, blend: [.25, .75] });
const fract = value => value - Math.floor(value);
const wrap = value => (value % MINERAL_ATLAS.cells + MINERAL_ATLAS.cells) % MINERAL_ATLAS.cells;
const smooth = value => { const t = Math.max(0, Math.min(1, (value - .25) / .5)); return t * t * (3 - 2 * t); };
const seed = (x, y) => {
  const q = [fract(wrap(x) * .1031), fract(wrap(y) * .1031), fract(wrap(x) * .1031)];
  const d = q[0] * (q[1] + 33.33) + q[1] * (q[2] + 33.33) + q[2] * (q[0] + 33.33);
  q.forEach((v, i) => { q[i] = v + d; });
  return [fract((q[0] + q[1]) * q[2]), fract((q[0] + q[2]) * q[1])];
};
export function mineralAtlasPlan(width, height, u, v) {
  const p = [u / MINERAL_ATLAS.span, v / MINERAL_ATLAS.span], cell = p.map(Math.floor);
  const weights = p.map(value => smooth(fract(value)));
  const contributions = [(1 - weights[0]) * (1 - weights[1]), weights[0] * (1 - weights[1]),
    (1 - weights[0]) * weights[1], weights[0] * weights[1]];
  return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy], i) => {
    const anchor = [cell[0] + dx, cell[1] + dy], jitter = seed(...anchor);
    const offset = [width, height].map((size, axis) => Math.round((.5 - anchor[axis] * MINERAL_ATLAS.span + (jitter[axis] - .5) * MINERAL_ATLAS.jitter) * size));
    return { point: [u * width - .5 + offset[0], v * height - .5 + offset[1]], weight: contributions[i] };
  });
}
export const toLinear = value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; };
export const toSrgb = value => Math.round(255 * (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055));
