import { BufferGeometry, Float32BufferAttribute } from "three";
import type { Outline } from "@/lib/pool/types";
import { createSurfaceGeometry } from "./poolGeometry";
import { offsetOutline } from "@/lib/pool/geometry";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Point = [number, number];
export type PavingOptions = { gap?: number; thickness?: number; boards?: boolean; edgeRadius?: number };
function clip(poly: Point[], axis: 0 | 1, limit: number, greater: boolean): Point[] {
  // Most cells lie wholly inside/outside a clipping half-plane. Keep their
  // existing point order and avoid allocating another polygon in those cases.
  let inside = 0;
  for (const point of poly) if (greater ? point[axis] >= limit : point[axis] <= limit) inside++;
  if (inside === poly.length) return poly;
  if (inside === 0) return [];
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const ia = greater ? a[axis] >= limit : a[axis] <= limit;
    const ib = greater ? b[axis] >= limit : b[axis] <= limit;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/** Choose a bond origin that maximizes the smallest perimeter cut.
 * Full modules never scale. Rectangular edge cuts are balanced; oblique
 * custom outlines still receive the exact architectural cut. */
export function pavingGridOrigin(bounds: number[], pitch: number, stagger = false) {
  // Only numerical equality counts as an aligned edge; accepting a few
  // millimetres here would deliberately create thin perimeter slivers.
  const tolerance = 1e-6;
  const score = (origin: number) => {
    let minimum = Infinity;
    for (const value of bounds) for (let course = 0; course < (stagger ? 2 : 1); course++) {
      const offset = course * pitch / 2;
      const d = ((value - origin - offset) % pitch + pitch) % pitch;
      const cut = Math.min(d, pitch - d);
      minimum = Math.min(minimum, cut < tolerance ? pitch : cut);
    }
    return minimum;
  };
  let best = 0, bestScore = score(0);
  for (let i = 1; i < 256; i++) {
    const candidate = pitch * i / 256, candidateScore = score(candidate);
    if (candidateScore > bestScore) { best = candidate; bestScore = candidateScore; }
  }
  return best;
}

/** One merged mesh, including recessed module edges. Only horizontal top
 * triangles participate, so the same metric bond fits the existing Infinity
 * terrace without adding paving across its channel or changing its outline. */
export function createPavingOnSurface(surface: BufferGeometry, module: readonly [number, number], options: PavingOptions = {}, edgeOutline?: Outline, gridOutline?: Outline) {
  const { gap = 0.003, thickness = 0.02, boards = false } = options;
  const ring = surface.index ? surface.toNonIndexed() : surface.clone();
  const p = ring.getAttribute("position"), [sx, sz] = module;
  if (!(sx > gap && sz > gap && thickness > 0)) throw new Error("Invalid metric paving module");
  const triangles: Point[][] = [];
  for (let i = 0; i < p.count; i += 3) {
    if ([0, 1, 2].some(j => Math.abs(p.getY(i + j)) > 1e-6)) continue;
    triangles.push([0, 1, 2].map(j => [p.getX(i + j), p.getZ(i + j)]));
  }
  const xs = [...new Set(gridOutline ? gridOutline.map(v => Math.fround(v[0])) : triangles.flatMap(t => t.map(v => v[0])))];
  const zs = [...new Set(gridOutline ? gridOutline.map(v => Math.fround(v[1])) : triangles.flatMap(t => t.map(v => v[1])))];
  const ox = pavingGridOrigin(xs, sx, boards), oz = pavingGridOrigin(zs, sz);
  const pos: number[] = [], uv: number[] = [], colors: number[] = [];
  const cells = new Map<string, { x: number; z: number; minX: number; minZ: number; polygons: Point[][] }>();
  for (const tri of triangles) {
    const tx = tri.map(v => v[0]), tz = tri.map(v => v[1]);
    for (let z = Math.floor((Math.min(...tz) - oz) / sz); z <= Math.floor((Math.max(...tz) - oz) / sz); z++) {
      const stagger = boards ? (z & 1) * sx / 2 : 0;
      for (let x = Math.floor((Math.min(...tx) - ox - stagger) / sx); x <= Math.floor((Math.max(...tx) - ox - stagger) / sx); x++) {
        const minX = ox + x * sx + stagger, minZ = oz + z * sz;
        let polygon = clip(tri, 0, minX + gap / 2, true);
        polygon = clip(polygon, 0, minX + sx - gap / 2, false);
        polygon = clip(polygon, 1, minZ + gap / 2, true);
        polygon = clip(polygon, 1, minZ + sz - gap / 2, false);
        polygon = polygon.map(v => [Math.fround(v[0]), Math.fround(v[1])] as Point)
          .filter((v, i, all) => {
            const next = all[(i + 1) % all.length]!;
            return Math.hypot(v[0] - next[0], v[1] - next[1]) > 1e-7;
          });
        if (polygon.length < 3) continue;
        const key = x + ":" + z;
        if (!cells.has(key)) cells.set(key, { x, z, minX, minZ, polygons: [] });
        cells.get(key)!.polygons.push(polygon);
      }
    }
  }
  for (const cell of cells.values()) {
    const seed = Math.sin(cell.x * 127.1 + cell.z * 311.7) * 43758.5453;
    const rnd = seed - Math.floor(seed), tone = 0.965 + rnd * 0.035;
    const offU = Math.floor(rnd * 997) * 0.37, offV = Math.floor(((rnd * 7919) % 1) * 991) * 0.41;
    const vertex = (v: Point, y: number) => {
      if (y === 0 && edgeOutline && options.edgeRadius) {
        const r = options.edgeRadius;
        let distance = Infinity;
        for (let i = 0; i < edgeOutline.length; i++) {
          const a = edgeOutline[i]!, b = edgeOutline[(i + 1) % edgeOutline.length]!;
          const dx = b[0] - a[0], dz = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / (dx * dx + dz * dz)));
          distance = Math.min(distance, Math.hypot(v[0] - a[0] - t * dx, v[1] - a[1] - t * dz));
        }
        if (distance < r) y = -r + Math.sqrt(Math.max(0, r * r - (r - distance) ** 2));
      }
      pos.push(v[0], y, v[1]);
      // Board-local crosswise coordinate aligns the grain with every course;
      // stone UVs remain metric and independent from the selected slab size.
      uv.push(boards ? v[0] - cell.minX + offU : v[0] + offU,
        boards ? (cell.minZ + sz - v[1]) : -v[1] + offV);
      colors.push(tone, tone, tone);
    };
    const edges = new Map<string, [Point, Point]>();
    const pointKey = (v: Point) => v.map(n => Math.round(n * 1e6)).join(",");
    for (const polygon of cell.polygons) {
      for (let k = 1; k + 1 < polygon.length; k++) {
        const a = polygon[0]!, b = polygon[k]!, c = polygon[k + 1]!;
        if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-9) continue;
        for (const v of [a, b, c]) vertex(v, 0);
      }
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k]!, b = polygon[(k + 1) % polygon.length]!;
        const key = pointKey(a) + "/" + pointKey(b), reverse = pointKey(b) + "/" + pointKey(a);
        if (edges.has(reverse)) edges.delete(reverse); else edges.set(key, [a, b]);
      }
    }
    for (const [a, b] of edges.values()) {
      vertex(a, 0); vertex(a, -thickness); vertex(b, -thickness);
      vertex(a, 0); vertex(b, -thickness); vertex(b, 0);
    }
  }
  ring.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.userData["paving"] = { module: [...module], gap, thickness, origin: [ox, oz], modules: cells.size, boards };
  return geometry;
}

export function createPavingModules(inner: Outline, outer: Outline, module: readonly [number, number], options: PavingOptions = {}) {
  // Only the real water-facing upper strip is subdivided. All pieces still
  // share the original metric module grid, UV window, material and draw call.
  const radius = Math.min(options.edgeRadius ?? 0, (options.thickness ?? .02) * .4);
  const rings = radius > 0 ? Array.from({length: 7}, (_, i) =>
    offsetOutline(inner, radius * (1 - Math.cos(i / 6 * Math.PI / 2)))) : [inner];
  const parts = [createSurfaceGeometry(outer, rings[rings.length - 1]!)];
  for (let i = 1; i < rings.length; i++) parts.push(createSurfaceGeometry(rings[i]!, rings[i - 1]!));
  const surface = parts.length === 1 ? parts[0]! : mergeGeometries(parts)!;
  if (parts.length > 1) parts.forEach(part => part.dispose());
  const result = createPavingOnSurface(surface, module, {...options, edgeRadius: radius}, radius > 0 ? inner : undefined, radius > 0 ? [...inner, ...outer] : undefined);
  surface.dispose();
  return result;
}
