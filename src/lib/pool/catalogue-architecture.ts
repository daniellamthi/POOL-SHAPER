import type { Outline } from "./types";
export type CatalogueSetting =
  "garden" | "patio" | "spa-wall" | "spa-glass" | "residence" | "infinity-villa";
// Luminous flux per metre, calibrated to this scene exposure.
// Illustrative lighting, not a product photometric specification.
export const CATALOGUE_COVE_POWER = {
  wall: { day: 3, night: 5 },
  down: { day: 8, night: 6 },
} as const;
export const CATALOGUE_LOUNGER_RECLINE = 0.55;
export type ArchitecturalFinish =
  "stone" | "plaster" | "wood" | "teak" | "dark" | "glass" | "fabric" | "linen" | "light";
export interface ArchitecturalPart {
  finish: ArchitecturalFinish;
  p: [number, number, number];
  s: [number, number, number];
  tilt?: number;
  profile?: "lounger-frame";
}
export interface ArchitecturalPlan {
  parts: ArchitecturalPart[];
  trees: [number, number, number][];
  shrubs: [number, number, number][];
  groundOutline?: Outline | undefined;
  pavingOutline?: Outline | undefined;
  setting: CatalogueSetting;
  centre: [number, number];
  ground: number;
  angle: number;
  length: number;
  width: number;
  indoor: boolean;
  camera: { position: [number, number, number]; target: [number, number, number]; fov: number };
}
/** Metres throughout. Building bays and furniture stay human-sized as the pool grows. */
export function planCatalogueArchitecture(
  outline: Outline,
  setting: CatalogueSetting,
  rim: number,
  ground: number,
  infinityNormal?: readonly [number, number],
): ArchitecturalPlan | null {
  if (
    ["garden", "patio"].includes(setting) ||
    !Number.isFinite(rim) ||
    !Number.isFinite(ground) ||
    rim < 0 ||
    (infinityNormal !== undefined &&
      (!infinityNormal.every(Number.isFinite) || Math.hypot(...infinityNormal) < 0.001)) ||
    outline.length < 3 ||
    outline.some((p) => !p.every(Number.isFinite))
  )
    return null;
  const xs = outline.map((p) => p[0]),
    zs = outline.map((p) => p[1]);
  const centre: [number, number] = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2,
  ];
  const angle = infinityNormal
    ? Math.atan2(-infinityNormal[0], -infinityNormal[1])
    : Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs)
      ? 0
      : Math.PI / 2;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const pts = outline.map(([x, z]) => [
    (x - centre[0]) * c - (z - centre[1]) * s,
    (x - centre[0]) * s + (z - centre[1]) * c,
  ]);
  const length = Math.max(...pts.map((p) => p[0]!)) - Math.min(...pts.map((p) => p[0]!));
  const width = Math.max(...pts.map((p) => p[1]!)) - Math.min(...pts.map((p) => p[1]!));
  if (length < 1 || width < 1 || length > 100 || width > 100) return null;
  const indoor = setting.startsWith("spa");
  const parts: ArchitecturalPart[] = [];
  const box = (
    finish: ArchitecturalFinish,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    tilt = 0,
  ) => {
    if (w > 0 && h > 0 && d > 0) parts.push({ finish, p: [x, y + ground, z], s: [w, h, d], tilt });
  };
  const H = 3.3,
    near = -length / 2 - 2.4,
    far = length / 2 + 2.2;
  const left = -width / 2 - rim - 0.05,
    right = width / 2 + 3.5;
  const glazing = (axis: "x" | "z", at: number, start: number, end: number) => {
    const n = Math.ceil((end - start) / 2.5),
      pitch = (end - start) / n;
    for (let i = 0; i < n; i++) {
      const mid = start + (i + 0.5) * pitch;
      if (axis === "x") {
        box("glass", at, H / 2, mid, 0.025, H - 0.14, pitch - 0.06);
        box("dark", at, H / 2, start + i * pitch, 0.065, H, 0.045);
      } else {
        box("glass", mid, H / 2, at, pitch - 0.06, H - 0.14, 0.025);
        box("dark", start + i * pitch, H / 2, at, 0.045, H, 0.065);
      }
    }
    // Close the final jamb as well as the shared intermediate mullions.
    if (axis === "x") box("dark", at, H / 2, end, 0.065, H, 0.045);
    else box("dark", end, H / 2, at, 0.045, H, 0.065);
    for (const y of [0.045, H - 0.045])
      box(
        "dark",
        axis === "x" ? at : (start + end) / 2,
        y,
        axis === "x" ? (start + end) / 2 : at,
        axis === "x" ? 0.08 : end - start,
        0.09,
        axis === "x" ? end - start : 0.08,
      );
  };
  const chaise = (x: number, z: number) => {
    const firstPart = parts.length;
    // Same human-scale position and footprint; an open timber assembly replaces
    // the solid plinth. The complete frame remains one merged material part.
    parts.push({ finish: "teak", profile: "lounger-frame",
      p: [x, ground + 0.45, z + 0.04], s: [0.82, 0.9, 2.02] });
    const a = CATALOGUE_LOUNGER_RECLINE, c = Math.cos(a), s = Math.sin(a);
    const backY = 0.4 + 0.425 * s, backZ = 0.3 + 0.425 * c;
    box("linen", x, 0.4, z - 0.3, 0.77, 0.14, 1.25);
    box("linen", x, backY, z + backZ, 0.77, 0.14, 0.85, -a);
    box("linen", x, backY + 0.23 * s + 0.1 * c,
      z + backZ + 0.23 * c - 0.1 * s, 0.58, 0.08, 0.24, -a);
    for (const dx of [-0.399, 0.399])
      box("dark", x + dx, 0.3, z + 0.3, 0.016, 0.052, 0.055);
    if (setting === "spa-wall") {
      for (const part of parts.slice(firstPart)) {
        part.p = [x + (part.p[0] - x) * 0.9,
          ground + (part.p[1] - ground) * 0.9, z + (part.p[2] - z) * 0.9];
        part.s = part.s.map(value => value * 0.9) as [number, number, number];
      }
    }
  };
  const trees: [number, number, number][] = [];
  const shrubs: [number, number, number][] = [];
  if (indoor) {
    // The wall/glass meets the outside coping line; it never replaces the pool edge.
    if (setting === "spa-wall") {
      const n = Math.ceil((far - near) / 1.2);
      for (let i = 0; i < n; i++)
        box(
          "stone",
          near + ((i + 0.5) * (far - near)) / n,
          H / 2,
          left - 0.14,
          (far - near) / n - 0.008,
          H,
          0.28,
        );
    } else glazing("z", left, near, far);
    glazing("x", far, left, right);
    box("wood", (near + far) / 2, H / 2, right + 0.12, far - near, H, 0.24);
    box(
      "dark",
      (near + far) / 2,
      H + 0.08,
      (left + right) / 2,
      far - near + 0.4,
      0.16,
      right - left + 0.4,
    );
    const slats = Math.ceil((right - left) / 0.105);
    for (let i = 0; i < slats; i++)
      box(
        "wood",
        (near + far) / 2,
        H - 0.035,
        left + ((i + 0.5) * (right - left)) / slats,
        far - near,
        0.08,
        0.065,
      );
    box("light", (near + far) / 2, H - 0.11, left + 0.06, far - near, 0.025, 0.035);
    box("light", (near + far) / 2, H - 0.11, right - 0.08, far - near, 0.025, 0.035);
    const seats = Math.min(4, Math.max(1, Math.floor((length - 1) / 1.3)));
    for (let i = 0; i < seats; i++)
      chaise(-length / 2 + 0.8 + (i * (length - 1.6)) / Math.max(1, seats - 1), width / 2 + 2.35);
    for (let i = 0; i < 5; i++)
      trees.push([far + 2.5 + (i % 2) * 1.4, left + 1 + i * 1.7, 0.65 + (i % 3) * 0.12]);
    box("plaster", far + 5.7, 1.2, (left + right) / 2, 0.22, 2.4, right - left + 5);
    // Staggered groups of three make an irregular understory below the
    // existing trees. Reuse the small scanned shrub, clear of paths and glass.
    const farPlants = Math.min(22, Math.ceil((right - left + 2) / 0.7));
    for (let i = 0; i < farPlants; i++) {
      const cluster = Math.floor(i / 3), member = i % 3;
      shrubs.push([far + 4.45 + ((member + 1) % 3) * 0.16,
        left - 1 + ((cluster + 0.5) * (right - left + 2)) / Math.ceil(farPlants / 3)
          + (member - 1) * 0.24 + 0.1 * Math.sin(cluster * 2.4),
        0.95 + 0.75 * (0.5 + 0.5 * Math.sin(i * 1.7 + 0.3))]);
    }
    if (setting === "spa-glass") {
      for (let i = 0; i < 5; i++)
        trees.push([near + 1 + (i * (far - near)) / 5, left - 3, 0.7 + (i % 2) * 0.2]);
      box("plaster", (near + far) / 2, 0.65, left - 6, far - near + 6, 1.3, 0.22);
      const sidePlants = Math.min(38, Math.ceil((far - near + 3.5) / 0.75));
      for (let i = 0; i < sidePlants; i++) {
        const cluster = Math.floor(i / 3), member = i % 3;
        shrubs.push([near + 0.3 + ((cluster + 0.5) * (far - near + 3.5)) / Math.ceil(sidePlants / 3)
            + (member - 1) * 0.24 + 0.1 * Math.sin(cluster * 2.1),
          left - 4.95 + ((member + 1) % 3) * 0.16,
          0.95 + 0.75 * (0.5 + 0.5 * Math.cos(i * 1.9))]);
      }
    }
  } else {
    // Two habitable volumes, recessed glazing and a warm timber soffit.
    const buildingV = width / 2 + 5.1,
      rear = length / 2 + 4.6;
    box("plaster", rear + 4, 1.65, 1.3, 0.25, 3.3, width + 10);
    box("plaster", rear + 1.8, 3.45, 1.3, 5.2, 0.3, width + 10.6);
    box("wood", rear + 1.8, 3.26, 1.3, 5.2, 0.08, width + 10.6);
    box("wood", rear - 0.82, 3.29, 1.3, 0.065, 0.22, width + 10.6);
    if (setting !== "residence")
      box("stone", rear + 1.8, 0.05, 1.3, 5.2, 0.1, width + 10.6);
    box(setting === "residence" ? "dark" : "stone", rear, 1.65, 0, 0.25, 3.3, 3.5);
    if (setting === "residence") {
      // Fixed human-scale timber screen within the existing opaque façade bay.
      // Recessed backing gives real shadow gaps; glazing and room size stay put.
      const boards = 39, pitch = 3.5 / boards;
      for (let i = 0; i < boards; i++)
        box("wood", rear - 0.155, 1.65, -1.75 + (i + 0.5) * pitch,
          0.024, 3.24, pitch - 0.011);
    }
    if (setting === "residence") {
      // A compact dining bay gives the rear glazing occupied depth. Furniture
      // dimensions stay metric as the pool grows; the smallest bay retains
      // access around all four chairs. Reuse existing merged material batches.
      const diningX = rear + 1.9, diningZ = (1.75 + width / 2 + 4.7) / 2;
      box("wood", diningX, 0.7275, diningZ, 1.6, 0.045, 0.85);
      for (const dx of [-0.68, 0.68]) for (const dz of [-0.31, 0.31])
        box("dark", diningX + dx, 0.3525, diningZ + dz, 0.05, 0.705, 0.05);
      for (const dx of [-0.48, 0.48]) for (const side of [-1, 1]) {
        const chairX = diningX + dx, chairZ = diningZ + side * 0.78;
        box("linen", chairX, 0.43, chairZ, 0.48, 0.06, 0.44);
        box("wood", chairX, 0.73, chairZ + side * 0.205, 0.48, 0.29, 0.035);
        for (const legX of [-0.18, 0.18]) for (const legZ of [-0.16, 0.16]) {
          const rearLeg = legZ * side > 0, height = rearLeg ? 0.875 : 0.4;
          box("wood", chairX + legX, height / 2,
            chairZ + (rearLeg ? side * 0.205 : legZ), 0.035, height, 0.035);
        }
      }
    }
    // Ground-bearing plinths avoid floating façades on the coastal terrace.
    box("plaster", rear + 1.8, setting === "residence" ? -1.51 : -1.5, 1.3, 5.2, 3, width + 10.6);
    glazing("x", rear - 0.08, -width / 2 - 2, -1.75);
    glazing("x", rear - 0.08, 1.75, width / 2 + 4.7);
    box("plaster", rear + 2, 1.65, -width / 2 - 3.6, 4, 3.3, 0.25);
    box("plaster", (near + rear) / 2, 3.45, buildingV + 2.3, rear - near, 0.3, 6.1);
    box("wood", (near + rear) / 2, 3.265, buildingV + 1.9, rear - near, 0.07, 5.5);
    box("wood", (near + rear) / 2, 3.29, buildingV - 0.8, rear - near, 0.22, 0.065);
    box("plaster", (near + rear) / 2, 1.6, buildingV + 4.7, rear - near, 3.2, 0.25);
    glazing("z", buildingV, near + 0.5, rear);
    for (const u of [near + 0.3, rear - 0.3]) box("plaster", u, 1.6, buildingV, 0.22, 3.2, 0.26);
    if (setting !== "residence")
      box("stone", (near + rear) / 2, 0.08, buildingV + 1.8, rear - near, 0.16, 5.5);
    box("plaster", (near + rear) / 2, setting === "residence" ? -1.51 : -1.5, buildingV + 1.8, rear - near, 3, 5.5);
    box("light", (near + rear) / 2, 3.2, buildingV + 0.15, rear - near - 0.4, 0.025, 0.025);
    // Interior seating gives the glazing actual depth, not an opaque black rectangle.
    box("fabric", length * 0.18, 0.44, buildingV + 2.1, 2.8, 0.65, 0.9);
    box("fabric", length * 0.18, 0.86, buildingV + 2.5, 2.8, 0.38, 0.18);
    box("wood", length * 0.18, 0.35, buildingV + 1, 1.4, 0.12, 0.65);
    // Keep full-size furniture and a 0.6m gap even beside short pools.
    const chaiseOffset = Math.max(0.71, length * 0.15);
    chaise(-chaiseOffset, width / 2 + 2.4);
    chaise(chaiseOffset, width / 2 + 2.4);
    if (setting !== "infinity-villa") {
      // A human-scale planted boundary closes the local lawn before the
      // distant photographic landscape. Never enclose the Infinity sea side.
      const gardenLeft = -width / 2 - 8;
      box("plaster", (near + rear) / 2, 0.55, gardenLeft, rear - near + 8, 1.1, 0.22);
      box("stone", (near + rear) / 2, 0.1, gardenLeft + 0.75, rear - near + 8, 0.2, 1.25);
      for (let i = 0; i < 5; i++)
        shrubs.push([near + ((i + 0.5) * (rear - near)) / 5, gardenLeft + 0.75, 1]);
      trees.push(
        [length / 2 + 2, -width / 2 - 4.5, 1],
        [-length / 2 - 2, -width / 2 - 5, 0.85],
        [length / 2 + 6, -width / 2 - 4, 0.8],
      );
    }
    trees.push([rear - 1, buildingV + 6, 0.8]);
  }
  const world = (u: number, y: number, v: number): [number, number, number] => [
    centre[0] + c * u + s * v,
    ground + y,
    centre[1] - s * u + c * v,
  ];
  // Carry the selected paving below both villa wings and their wall bases.
  // Keep the support tops below that surface to avoid coplanar faces.
  const villaBase = setting === "residence"
    ? parts.filter(part => part.finish === "plaster" && part.s[1] >= 3 && part.p[1] < ground + 2)
    : [];
  const minU = Math.min(...villaBase.map(part => part.p[0] - part.s[0] / 2));
  const maxU = Math.max(...villaBase.map(part => part.p[0] + part.s[0] / 2));
  const minV = Math.min(...villaBase.map(part => part.p[2] - part.s[2] / 2));
  const maxV = Math.max(...villaBase.map(part => part.p[2] + part.s[2] / 2));
  const pavingLocal: Outline | undefined = indoor
    ? [[near - 0.12, left - 0.28], [far + 0.12, left - 0.28],
        [far + 0.12, right + 0.24], [near - 0.12, right + 0.24]]
    : setting === "residence"
      ? [[minU, minV], [maxU, minV], [maxU, maxV], [minU, maxV]] : undefined;
  return {
    parts,
    trees,
    shrubs,
    pavingOutline: pavingLocal?.map(([u, v]) => {
      const p = world(u, 0, v);
      return [p[0], p[2]];
    }),
    groundOutline:
      setting === "residence"
        ? [
            [near - 6, -width / 2 - 8],
            [length / 2 + 12, -width / 2 - 8],
            [length / 2 + 12, width / 2 + 14],
            [near - 6, width / 2 + 14],
          ].map(([u, v]) => {
            const p = world(u!, 0, v!);
            return [p[0], p[2]];
          })
        : undefined,
    setting,
    centre,
    ground,
    angle,
    length,
    width,
    indoor,
    camera: indoor
      ? {
          position: world(-length / 2 + 0.7, 1.65, width / 2 + 1),
          target: world(length / 2 - 0.5, 1.15, -width * 0.15),
          fov: 58,
        }
      : {
          position: world(-length / 2 - 3.6, 3.0, width * 0.15),
          target: world(length * 0.18, 0.35, width * 0.12),
          fov: 50,
        },
  };
}
