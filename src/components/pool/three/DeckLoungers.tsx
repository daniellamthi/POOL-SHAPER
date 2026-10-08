import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Outline } from "@/lib/pool/types";
import { offsetOutline, outlineBounds } from "@/lib/pool/geometry";
import { pointInBasin } from "@/lib/pool/boundary-placement";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import { SolarShower } from "./SolarShower";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Poolside furniture on the studio deck: the optional four contemporary
 * loungers (two pairs with a side table between them) and the optional
 * solar shower. Both are equipment options, off by default.
 *
 * Presentation only: nothing here enters the configuration geometry, the
 * quote or the technical plan (the shower is an equipment option, but its
 * position is derived here, never stored). The design is deliberately
 * minimal -- a slim powder-coated frame, one flat sling seat and a raked
 * backrest -- so it reads as architecture furniture and never competes with
 * the pool. Every position is derived from the outline on each render, so
 * resizing the pool simply re-plans the deck. Preference order:
 *   1. one row of four on a long side facing the water, clear of the access;
 *   2. two pairs, one on each long side, when a row of four does not fit;
 *   3. nothing, when the paved band cannot hold even a pair.
 */
const LOUNGER = {
  length: 2.0,
  width: 0.74,
  seatHeight: 0.33,
  seatLength: 1.38,
  backLength: 0.62,
  backAngle: 0.5,
  /** Clear walkway kept between the coping edge and the foot of the lounger. */
  walkway: 0.5,
} as const;

/** Lounger centres along the row (metres from the row centre). Two pairs,
 * 0.21 m apart within a pair, a side table in the 0.86 m gap between pairs. */
const ROW_OF_FOUR = [-1.75, -0.8, 0.8, 1.75] as const;
const PAIR = [-0.48, 0.48] as const;

/** Clearance of any lounger row or shower from an access point (ladder,
 * stair landing): the exit from the water must stay a free walkway. */
const ACCESS_CLEARANCE = 1.9;

const SHOWER = {
  /** Square footprint of the drained base plate. */
  base: 0.6,
  /** Distance from the water edge to the plate centre: the coping, then a
   * free 0.5 m walkway, then the plate. */
  standoff: 0.8,
  /** Clearance from loungers / cover roller, metres. */
  clearance: 0.45,
} as const;

type Point = { x: number; z: number };

interface RowPlacement {
  x: number;
  z: number;
  rotation: number;
  offsets: readonly number[];
  table: boolean;
}

interface DeckFurniturePlan {
  rows: RowPlacement[];
  shower: { x: number; z: number; rotation: number } | null;
}

interface Side {
  /** Outward normal of the long/short side. */
  normal: readonly [number, number];
  edge: number;
  centre: number;
  /** Half length of the side along its tangent. */
  half: number;
}

function sidesOf(outline: Outline) {
  const b = outlineBounds(outline);
  const xSides: Side[] = [
    { normal: [0, -1], edge: b.minZ, centre: (b.minX + b.maxX) / 2, half: b.spanX / 2 },
    { normal: [0, 1], edge: b.maxZ, centre: (b.minX + b.maxX) / 2, half: b.spanX / 2 },
  ];
  const zSides: Side[] = [
    { normal: [-1, 0], edge: b.minX, centre: (b.minZ + b.maxZ) / 2, half: b.spanZ / 2 },
    { normal: [1, 0], edge: b.maxX, centre: (b.minZ + b.maxZ) / 2, half: b.spanZ / 2 },
  ];
  return b.spanX >= b.spanZ ? { long: xSides, short: zSides } : { long: zSides, short: xSides };
}

/** World point at tangent offset `u` and distance `d` from the side's edge. */
function onSide(side: Side, u: number, d: number): Point {
  const [nx, nz] = side.normal;
  return nx === 0
    ? { x: side.centre + u, z: side.edge + nz * d }
    : { x: side.edge + nx * d, z: side.centre + u };
}

/** Local frame helper: +Z of the furniture points at the pool. */
const facing = (side: Side) => Math.atan2(-side.normal[0], -side.normal[1]);

function toLocal(p: Point, origin: Point, rotation: number) {
  const dx = p.x - origin.x,
    dz = p.z - origin.z;
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}

function planDeckFurniture(
  outline: Outline,
  innerOffset: number,
  band: number,
  avoid: ReadonlyArray<Point>,
  options: {
    loungers: boolean;
    shower: boolean;
    coverHousing?: { x: number; halfSpan: number; z: number } | null;
  },
): DeckFurniturePlan {
  const inner = offsetOutline(outline, innerOffset);
  const outer = offsetOutline(inner, band);
  const onDeck = (p: Point) => pointInBasin(p.x, p.z, outer) && !pointInBasin(p.x, p.z, inner);
  const { long, short } = sidesOf(outline);
  const rowDistance = innerOffset + LOUNGER.walkway + LOUNGER.length / 2;
  const halfAcross = LOUNGER.length / 2 + 0.1;

  const rowFits = (side: Side, offsets: readonly number[]) => {
    const half = Math.max(...offsets.map(Math.abs)) + LOUNGER.width / 2 + 0.1;
    const centre = onSide(side, 0, rowDistance);
    const rotation = facing(side);
    const c = Math.cos(rotation),
      s = Math.sin(rotation);
    const corners = [
      [-half, -halfAcross],
      [half, -halfAcross],
      [half, halfAcross],
      [-half, halfAcross],
    ].map(([u, v]) => ({ x: centre.x + u! * c + v! * s, z: centre.z - u! * s + v! * c }));
    // Distance from each access point to the row's long axis segment.
    const clear = avoid.every((p) => {
      const local = toLocal(p, centre, rotation);
      const du = Math.max(0, Math.abs(local.u) - half);
      return Math.hypot(du, local.v) > ACCESS_CLEARANCE;
    });
    return corners.every(onDeck) && clear
      ? { x: centre.x, z: centre.z, rotation, offsets, table: offsets.length === 4, half }
      : null;
  };

  let rows: (RowPlacement & { half: number })[] = [];
  // Chaise longues are an optional, off by default: no row unless chosen.
  for (const side of options.loungers ? long : []) {
    const row = rowFits(side, ROW_OF_FOUR);
    if (row) {
      rows = [row];
      break;
    }
  }
  if (rows.length === 0 && options.loungers) {
    const pairs = long.map((side) => rowFits(side, PAIR));
    if (pairs.every(Boolean)) rows = pairs as (RowPlacement & { half: number })[];
    else if (pairs.some(Boolean)) rows = [pairs.find(Boolean)!];
  }

  let shower: DeckFurniturePlan["shower"] = null;
  if (options.shower) {
    const distance = innerOffset + SHOWER.standoff;
    // Beside the sunbathing area first (rinse, then swim), then the corners
    // of the other long side, then the short ends.
    const rowSide = rows[0]
      ? long.find((side) => Math.abs(facing(side) - rows[0]!.rotation) < 1e-6)
      : undefined;
    const ordered = rowSide ? [rowSide, ...long.filter((side) => side !== rowSide)] : long;
    const candidates: { side: Side; u: number }[] = [];
    for (const side of ordered) {
      const end = side.half - 0.35;
      candidates.push({ side, u: end }, { side, u: -end });
    }
    for (const side of short) candidates.push({ side, u: 0 });
    const r = SHOWER.base / 2;
    for (const { side, u } of candidates) {
      const p = onSide(side, u, distance);
      const rotation = facing(side);
      const footprint = [
        [-r, -r],
        [r, -r],
        [r, r],
        [-r, r],
      ].map(([a, b]) => ({ x: p.x + a!, z: p.z + b! }));
      if (!footprint.every(onDeck)) continue;
      if (avoid.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < ACCESS_CLEARANCE + 0.4)) continue;
      const hitsRow = rows.some((row) => {
        const local = toLocal(p, row, row.rotation);
        return (
          Math.abs(local.u) < row.half + r + SHOWER.clearance &&
          Math.abs(local.v) < halfAcross + r + SHOWER.clearance
        );
      });
      if (hitsRow) continue;
      const housing = options.coverHousing;
      if (
        housing &&
        Math.abs(p.x - housing.x) < 0.2 + r + SHOWER.clearance &&
        Math.abs(p.z - housing.z) < housing.halfSpan + r + SHOWER.clearance
      )
        continue;
      shower = { x: p.x, z: p.z, rotation };
      break;
    }
  }
  return { rows: rows.map(({ half: _half, ...row }) => row), shower };
}

type FurniturePart = "frame" | "sling" | "cushion" | "table";

/**
 * All loungers and tables merged into one geometry per material: four draw
 * calls for the whole set instead of ~50 (every lounger is 11 primitives).
 * Rebuilt only when the plan changes (pool resize, access change).
 */
function buildFurnitureGeometry(rows: RowPlacement[]) {
  const parts: Record<FurniturePart, THREE.BufferGeometry[]> = {
    frame: [],
    sling: [],
    cushion: [],
    table: [],
  };
  const { width, seatHeight, seatLength, backLength, backAngle } = LOUNGER;
  const pivotZ = -0.38;
  const seatCentreZ = pivotZ + seatLength / 2;
  const backY = seatHeight + Math.sin(backAngle) * (backLength / 2);
  const backZ = pivotZ - Math.cos(backAngle) * (backLength / 2);
  const cushionY = seatHeight + Math.sin(backAngle) * (backLength - 0.14) + 0.055;
  const cushionZ = pivotZ - Math.cos(backAngle) * (backLength - 0.14);
  const legHeight = seatHeight - 0.07;
  const matrix = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const tilt = new THREE.Matrix4().makeRotationX(backAngle);
  const add = (
    part: FurniturePart,
    geometry: THREE.BufferGeometry,
    base: THREE.Matrix4,
    x: number,
    y: number,
    z: number,
    tilted = false,
  ) => {
    local.makeTranslation(x, y, z);
    if (tilted) local.multiply(tilt);
    geometry.applyMatrix4(matrix.copy(base).multiply(local));
    parts[part].push(geometry);
  };
  for (const row of rows) {
    const rowMatrix = new THREE.Matrix4()
      .makeTranslation(row.x, 0, row.z)
      .multiply(new THREE.Matrix4().makeRotationY(row.rotation));
    for (const offset of row.offsets) {
      const base = rowMatrix.clone().multiply(new THREE.Matrix4().makeTranslation(offset, 0, 0));
      add(
        "sling",
        new THREE.BoxGeometry(width, 0.05, seatLength),
        base,
        0,
        seatHeight,
        seatCentreZ,
      );
      add("sling", new THREE.BoxGeometry(width, 0.05, backLength), base, 0, backY, backZ, true);
      add("cushion", new THREE.BoxGeometry(0.38, 0.07, 0.22), base, 0, cushionY, cushionZ, true);
      for (const side of [-1, 1]) {
        const x = side * (width / 2 + 0.012);
        add(
          "frame",
          new THREE.BoxGeometry(0.03, 0.04, seatLength + 0.02),
          base,
          x,
          seatHeight - 0.045,
          seatCentreZ,
        );
        add(
          "frame",
          new THREE.BoxGeometry(0.03, 0.04, backLength),
          base,
          x,
          backY - 0.045,
          backZ,
          true,
        );
        for (const z of [seatCentreZ - 0.55, seatCentreZ + 0.55])
          add("frame", new THREE.BoxGeometry(0.03, legHeight, 0.03), base, x, legHeight / 2, z);
      }
    }
    if (row.table) {
      add("table", new THREE.CylinderGeometry(0.21, 0.21, 0.025, 32), rowMatrix, 0, 0.42, -0.1);
      add("frame", new THREE.CylinderGeometry(0.022, 0.022, 0.4, 16), rowMatrix, 0, 0.21, -0.1);
      add("frame", new THREE.CylinderGeometry(0.15, 0.15, 0.012, 32), rowMatrix, 0, 0.006, -0.1);
    }
  }
  const merged = {} as Record<FurniturePart, THREE.BufferGeometry | null>;
  for (const part of Object.keys(parts) as FurniturePart[]) {
    merged[part] = parts[part].length ? mergeGeometries(parts[part]) : null;
    parts[part].forEach((geometry) => geometry.dispose());
  }
  return merged;
}

export function DeckLoungers({
  outline,
  innerOffset,
  band,
  waterY,
  avoid = [],
  shower = false,
  loungers = false,
  coverHousing = null,
}: {
  outline: Outline;
  /** Distance from the water edge to the first paving slab. */
  innerOffset: number;
  /** Width of the paved band the furniture must stay on. */
  band: number;
  waterY: number;
  /** Deck positions to keep clear of (ladder, staircase landing). */
  avoid?: ReadonlyArray<Point>;
  /** Optional solar shower (equipment option, default off). */
  shower?: boolean;
  /** Optional row of four chaise longues (equipment option, default off). */
  loungers?: boolean;
  /** Automatic-cover roller housing on the deck, when present. */
  coverHousing?: { x: number; halfSpan: number; z: number } | null;
}) {
  const plan = useMemo(
    () => planDeckFurniture(outline, innerOffset, band, avoid, { loungers, shower, coverHousing }),
    [outline, innerOffset, band, avoid, loungers, shower, coverHousing],
  );
  const geometry = useMemo(() => buildFurnitureGeometry(plan.rows), [plan.rows]);
  useEffect(() => () => Object.values(geometry).forEach((part) => part?.dispose()), [geometry]);
  // Shared materials for the whole set: the deck is dry, so submerged LEDs
  // are linked out exactly as they are for the paving itself.
  const materials = useMemo(() => {
    const dry = (material: THREE.MeshStandardMaterial) => {
      material.onBeforeCompile = (shader) => excludeSubmergedDirectLights(shader, waterY);
      material.customProgramCacheKey = () => `deck-furniture-dry-${waterY}`;
      return material;
    };
    return {
      frame: dry(
        new THREE.MeshStandardMaterial({ color: "#2f3335", roughness: 0.55, metalness: 0.35 }),
      ),
      sling: dry(new THREE.MeshStandardMaterial({ color: "#d9d2c5", roughness: 0.92 })),
      cushion: dry(new THREE.MeshStandardMaterial({ color: "#f1ede4", roughness: 0.95 })),
      table: dry(new THREE.MeshStandardMaterial({ color: "#bfb9ad", roughness: 0.7 })),
    };
  }, [waterY]);
  useEffect(
    () => () => Object.values(materials).forEach((material) => material.dispose()),
    [materials],
  );
  return (
    <group name="deck-furniture">
      {(Object.keys(geometry) as FurniturePart[]).map((part) =>
        geometry[part] ? (
          <mesh
            key={part}
            name={`deck-lounger-${part}`}
            geometry={geometry[part]!}
            material={materials[part]}
            castShadow
            receiveShadow
          />
        ) : null,
      )}
      {plan.shower ? (
        <SolarShower
          position={[plan.shower.x, 0, plan.shower.z]}
          rotation={plan.shower.rotation}
          waterY={waterY}
        />
      ) : null}
    </group>
  );
}
