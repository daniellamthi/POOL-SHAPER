import { Matrix4, Vector3, type BufferGeometry } from "three";
import type { Outline } from "@/lib/pool/types";

export type PlanPoint = [number, number, number];
export type PlanLineWeight = "primary" | "secondary";
export type PlanEdgeSet = { points: PlanPoint[]; weight: PlanLineWeight };
type Boundary = { a: Vector3; b: Vector3; normals: Vector3[] };
const PLAN_EPSILON = 0.00001;
const rounded = (value: number) => Math.round(value / PLAN_EPSILON);
const distinctCuts = (values: number[]) => [...new Map(values.map(value => [rounded(value), value])).values()].sort((a, b) => a - b);

/** Construction names are assigned by the actual configured meshes. Furniture,
 * water, reflections, grille bars and tessellation are never plan annotations. */
export function architecturalLineWeight(name: string, parentName = ""): PlanLineWeight | null {
  if (["plan-coping", "plan-basin-walls", "infinity-closed-grey-containment", "infinity-glass-wall"].includes(name))
    return "primary";
  if (name.startsWith("plan-") || name.startsWith("pool-comfort-") ||
    parentName.startsWith("pool-access-internalSteps-") ||
    ["overflow-kerb", "overflow-edge-without-grille", "external-stair-tread"].includes(name))
    return "secondary";
  return null;
}

/** Cancel coplanar edges even where one face meets two shorter faces. Merely
 * welding identical endpoints leaves T-junctions and patch subdivisions visible. */
function continuousBoundaries(boundaries: Boundary[]): PlanPoint[] {
  const lines = new Map<string, { origin: Vector3; direction: Vector3; spans: {
    start: number; end: number; winding: number; normals: Vector3[];
  }[] }>();
  for (const { a, b, normals } of boundaries) {
    const direction = b.clone().sub(a);
    if (direction.lengthSq() < PLAN_EPSILON ** 2) continue;
    direction.normalize();
    const first = [direction.x, direction.y, direction.z].find(n => Math.abs(n) > PLAN_EPSILON)!;
    const winding = first < 0 ? -1 : 1;
    if (winding < 0) direction.negate();
    const origin = a.clone().addScaledVector(direction, -a.dot(direction));
    const id = [...direction.toArray(), ...origin.toArray()].map(rounded).join(",");
    let line = lines.get(id);
    if (!line) {
      line = { origin, direction, spans: [] };
      lines.set(id, line);
    }
    const start = a.dot(line.direction), end = b.dot(line.direction);
    line.spans.push({ start: Math.min(start, end), end: Math.max(start, end), winding, normals });
  }
  const result: PlanPoint[] = [];
  for (const { origin, direction, spans } of lines.values()) {
    const cuts = distinctCuts(spans.flatMap(span => [span.start, span.end]));
    let runStart: number | null = null;
    const emit = (end: number) => {
      if (runStart === null) return;
      for (const t of [runStart, end]) {
        const point = origin.clone().addScaledVector(direction, t);
        result.push([point.x, point.y + 0.006, point.z]);
      }
      runStart = null;
    };
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i]!, end = cuts[i + 1]!, middle = (start + end) / 2;
      const active = spans.filter(span => span.start < middle && span.end > middle);
      const normals = active.flatMap(span => span.normals);
      const crease = normals.some(normal => normal.dot(normals[0]!) < 0.999);
      const visible = active.reduce((sum, span) => sum + span.winding, 0) !== 0 || crease;
      if (visible && runStart === null) runStart = start;
      if (!visible) emit(start);
    }
    emit(cuts.at(-1)!);
  }
  return result;
}

/** Upper-face boundaries, not a wireframe. Weld position seams (UVs/normals
 * split vertices), cancel coplanar triangulation and keep real level changes.
 * World Y is retained so opaque higher solids correctly occlude lower edges. */
export function architecturalEdges(geometry: BufferGeometry, matrix = new Matrix4()): PlanPoint[] {
  const positions = geometry.getAttribute("position");
  if (!positions) return [];
  const index = geometry.index;
  const edges = new Map<string, Boundary>();
  const key = (v: Vector3) => [v.x, v.y, v.z].map(n => Math.round(n * 100000)).join(",");
  const count = index?.count ?? positions.count;
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j).applyMatrix4(matrix));
    const [a, b, c] = vertices as [Vector3, Vector3, Vector3];
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    // Earcut's small ears along a curved tread are real surface triangles.
    // A metric endpoint tolerance is not an area tolerance: discarding them
    // leaves gaps and exposes the lower edge of the neighbouring riser.
    if (normal.lengthSq() < 1e-20) continue;
    normal.normalize();
    if (normal.y < 0.65) continue; // no undersides, vertical risers or tiny bevel facets
    vertices.forEach((start, j) => {
      const end = vertices[(j + 1) % 3]!;
      const id = [key(start), key(end)].sort().join("|");
      const edge = edges.get(id);
      if (edge) edge.normals.push(normal);
      else edges.set(id, { a: start, b: end, normals: [normal] });
    });
  }
  return continuousBoundaries([...edges.values()].filter(edge =>
    edge.normals.length === 1 || edge.normals.some(n => n.dot(edge.normals[0]!) < 0.999),
  ));
}

/** A plan sees the highest real edge at each projected position. Union shared
 * segments before drawing so adjacent meshes and stair risers cannot produce
 * darker double strokes. Distinct parallel construction edges remain distinct. */
export function mergeArchitecturalEdges(sets: PlanEdgeSet[]): Record<PlanLineWeight, PlanPoint[]> {
  type Span = { start: number; end: number; a: PlanPoint; b: PlanPoint; weight: PlanLineWeight };
  const lines = new Map<string, { x: number; z: number; dx: number; dz: number; spans: Span[] }>();
  for (const { points, weight } of sets) for (let i = 0; i < points.length; i += 2) {
    const a = points[i]!, b = points[i + 1]!;
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (length < PLAN_EPSILON) continue;
    let dx = (b[0] - a[0]) / length, dz = (b[2] - a[2]) / length;
    if (dx < -PLAN_EPSILON || Math.abs(dx) <= PLAN_EPSILON && dz < 0) { dx = -dx; dz = -dz; }
    const distance = a[0] * -dz + a[2] * dx;
    const id = [dx, dz, distance].map(rounded).join(",");
    let line = lines.get(id);
    if (!line) {
      line = { x: -dz * distance, z: dx * distance, dx, dz, spans: [] };
      lines.set(id, line);
    }
    const ta = a[0] * line.dx + a[2] * line.dz, tb = b[0] * line.dx + b[2] * line.dz;
    line.spans.push({ start: Math.min(ta, tb), end: Math.max(ta, tb), a: ta < tb ? a : b, b: ta < tb ? b : a, weight });
  }
  const result: Record<PlanLineWeight, PlanPoint[]> = { primary: [], secondary: [] };
  for (const { x, z, dx, dz, spans } of lines.values()) {
    const cuts = distinctCuts(spans.flatMap(span => [span.start, span.end]));
    const yAt = (span: Span, t: number) => span.a[1] + (span.b[1] - span.a[1]) * (t - span.start) / (span.end - span.start);
    let run: { start: number; end: number; y0: number; y1: number; weight: PlanLineWeight } | null = null;
    const emit = () => {
      if (run) result[run.weight].push([x + dx * run.start, run.y0, z + dz * run.start],
        [x + dx * run.end, run.y1, z + dz * run.end]);
      run = null;
    };
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i]!, end = cuts[i + 1]!, middle = (start + end) / 2;
      const active = spans.filter(span => span.start < middle && span.end > middle);
      const selected = active.sort((a, b) => yAt(b, middle) - yAt(a, middle) ||
        (a.weight === b.weight ? 0 : a.weight === "primary" ? -1 : 1))[0];
      if (!selected) { emit(); continue; }
      const y0 = yAt(selected, start), y1 = yAt(selected, end);
      const slope = (y1 - y0) / (end - start);
      if (run && run.weight === selected.weight && Math.abs(run.end - start) < PLAN_EPSILON &&
        Math.abs(run.y1 - y0) < PLAN_EPSILON && Math.abs((run.y1 - run.y0) / (run.end - run.start) - slope) < PLAN_EPSILON) {
        run.end = end; run.y1 = y1;
      } else { emit(); run = { start, end, y0, y1, weight: selected.weight }; }
    }
    emit();
  }
  return result;
}

/** Keep a top editing view centred without placing it beneath real UI. */
export function centeredArchitecturalFrame(frame: { left: number; top: number; width: number; height: number }, canvasWidth: number) {
  const inset = Math.max(frame.left, canvasWidth - frame.left - frame.width);
  // Use a symmetric subset of the genuinely free rectangle. Peripheral HUD
  // badges must not pull the editing plan towards one side of the canvas.
  // A real sidebar covering the centre cannot be recentered without overlap.
  return inset < canvasWidth / 2
    ? { ...frame, left: inset, width: canvasWidth - 2 * inset }
    : frame;
}

/** Fit actual construction bounds into the unobscured viewport, in metres.
 * A minimum pixel margin keeps small/mobile pools legible without clipping. */
export function architecturalFrustum(outline: Outline, width: number, height: number,
  frame: { left: number; top: number; width: number; height: number }, compact = false, preciseBounds = false) {
  const xs = outline.map(p => p[0]), zs = outline.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  // Real construction bounds already include their physical extent. Without
  // annotations, reserve pixels rather than another half metre of scenery.
  const margin = compact ? Math.min(preciseBounds ? 8 : 12, Math.max(6, Math.min(frame.width, frame.height) * 0.06))
    : Math.min(36, Math.max(18, frame.width * 0.06));
  const padding = compact || preciseBounds ? 0 : 0.5;
  const marginX = preciseBounds && !compact ? 34 : margin;
  const marginY = preciseBounds && !compact ? 16 : margin;
  const scale = Math.max((maxX - minX + padding) / Math.max(1, frame.width - 2 * marginX),
    (maxZ - minZ + padding) / Math.max(1, frame.height - 2 * marginY));
  return { width: width * scale, height: height * scale,
    centre: [(minX + maxX) / 2 - (frame.left + frame.width / 2 - width / 2) * scale,
      (minZ + maxZ) / 2 - (frame.top + frame.height / 2 - height / 2) * scale] as const };
}
