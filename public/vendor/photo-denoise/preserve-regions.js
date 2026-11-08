/** Pixel-centre scan conversion in bottom-up HDR coordinates. Optional regions
 * borrow the worker's original input; no extra HDR image/copy or GPU pass. */
export function createPreservationMask(width, height, polygons) {
  if (!Array.isArray(polygons) || polygons.length > 32 || polygons.some(p =>
    !Array.isArray(p) || p.length < 3 || p.length > 512 || p.some(v =>
      !Array.isArray(v) || v.length !== 2 || v.some(n => !Number.isFinite(n) || n < 0 || n > 1)))) {
    throw new Error("Invalid HDR preservation regions");
  }
  if (!polygons.length) return null;
  const mask = new Uint8Array(width * height);
  for (const polygon of polygons) {
    const first = Math.max(0, Math.ceil(Math.min(...polygon.map(p => p[1])) * height - .5));
    const last = Math.min(height - 1, Math.floor(Math.max(...polygon.map(p => p[1])) * height - .5));
    const crossings = [];
    for (let y = first; y <= last; y++) {
      const py = (y + .5) / height;
      crossings.length = 0;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a[1] > py) !== (b[1] > py)) crossings.push(a[0] + (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const start = Math.max(0, Math.ceil(crossings[i] * width - .5));
        const end = Math.min(width, Math.ceil(crossings[i + 1] * width - .5));
        mask.fill(1, y * width + start, y * width + end);
      }
    }
  }
  return mask;
}
