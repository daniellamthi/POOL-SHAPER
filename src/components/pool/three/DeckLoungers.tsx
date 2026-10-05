import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Outline } from "@/lib/pool/types";
import { offsetOutline, outlineBounds } from "@/lib/pool/geometry";
import { pointInBasin } from "@/lib/pool/boundary-placement";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";

/**
 * Two contemporary poolside loungers and a side table on the studio deck.
 *
 * Presentation only: nothing here enters the configuration, the quote or the
 * technical plan. The design is deliberately minimal -- a slim powder-coated
 * frame, one flat sling seat and a raked backrest -- rather than the classic
 * slatted-teak recliner, so it reads as architecture furniture and never
 * competes with the pool itself. Placement is derived from the outline: the
 * long side of the basin, on the paved band, facing the water, and on the
 * side furthest from any ladder/stair so the walkway in front of the access
 * stays clear. If no side fits (small deck, concave footprint) nothing is
 * drawn.
 */
const LOUNGER = {
  length: 2.0,
  width: 0.74,
  seatHeight: 0.33,
  seatLength: 1.38,
  backLength: 0.62,
  backAngle: 0.5,
  /** Centre-to-centre spacing of the two loungers (table in between). */
  pitch: 1.3,
  /** Clear walkway kept between the coping edge and the foot of the lounger. */
  walkway: 0.5,
} as const;

interface LoungerPlacement {
  x: number;
  z: number;
  rotation: number;
}

function planLoungers(
  outline: Outline,
  innerOffset: number,
  band: number,
  avoid: ReadonlyArray<{ x: number; z: number }>,
): LoungerPlacement | null {
  const bounds = outlineBounds(outline);
  const alongX = bounds.spanX >= bounds.spanZ;
  const inner = offsetOutline(outline, innerOffset);
  const outer = offsetOutline(inner, band);
  const standoff = innerOffset + LOUNGER.walkway + LOUNGER.length / 2;
  const halfAlong = LOUNGER.pitch / 2 + LOUNGER.width / 2 + 0.1;
  const halfAcross = LOUNGER.length / 2 + 0.1;
  const sides = alongX
    ? [
        { normal: [0, -1] as const, edge: bounds.minZ, centre: (bounds.minX + bounds.maxX) / 2 },
        { normal: [0, 1] as const, edge: bounds.maxZ, centre: (bounds.minX + bounds.maxX) / 2 },
      ]
    : [
        { normal: [-1, 0] as const, edge: bounds.minX, centre: (bounds.minZ + bounds.maxZ) / 2 },
        { normal: [1, 0] as const, edge: bounds.maxX, centre: (bounds.minZ + bounds.maxZ) / 2 },
      ];
  const candidates = sides.map((side) => {
    const [nx, nz] = side.normal;
    const x = alongX ? side.centre : side.edge + nx * standoff;
    const z = alongX ? side.edge + nz * standoff : side.centre;
    const tangent = [-nz, nx] as const;
    const corners = [
      [-halfAlong, -halfAcross],
      [halfAlong, -halfAcross],
      [halfAlong, halfAcross],
      [-halfAlong, halfAcross],
    ].map(([u, v]) => [x + tangent[0] * u! + nx * v!, z + tangent[1] * u! + nz * v!] as const);
    const fits = corners.every(
      ([cx, cz]) => pointInBasin(cx, cz, outer) && !pointInBasin(cx, cz, inner),
    );
    const clearance = avoid.reduce(
      (best, p) => Math.min(best, Math.hypot(p.x - x, p.z - z)),
      Number.POSITIVE_INFINITY,
    );
    // Local +Z of the furniture group points at the pool (feet to the water).
    return { x, z, rotation: Math.atan2(-nx, -nz), fits, clearance };
  });
  const fitting = candidates.filter((c) => c.fits);
  if (fitting.length === 0) return null;
  // Prefer the far (negative-axis) side, which sits behind the pool in the
  // default overview; fall back to whichever side keeps clear of the access.
  const clear = fitting.filter((c) => c.clearance > 2.2);
  const chosen = clear[0] ?? fitting.sort((a, b) => b.clearance - a.clearance)[0]!;
  return { x: chosen.x, z: chosen.z, rotation: chosen.rotation };
}

function Lounger({
  materials,
}: {
  materials: { frame: THREE.Material; sling: THREE.Material; cushion: THREE.Material };
}) {
  const { width, seatHeight, seatLength, backLength, backAngle } = LOUNGER;
  const pivotZ = -0.38;
  const seatCentreZ = pivotZ + seatLength / 2;
  const backCentre: [number, number, number] = [
    0,
    seatHeight + Math.sin(backAngle) * (backLength / 2),
    pivotZ - Math.cos(backAngle) * (backLength / 2),
  ];
  const cushionCentre: [number, number, number] = [
    0,
    seatHeight + Math.sin(backAngle) * (backLength - 0.14) + 0.055,
    pivotZ - Math.cos(backAngle) * (backLength - 0.14),
  ];
  const legHeight = seatHeight - 0.07;
  return (
    <group name="deck-lounger">
      <mesh
        position={[0, seatHeight, seatCentreZ]}
        material={materials.sling}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, 0.05, seatLength]} />
      </mesh>
      <mesh
        position={backCentre}
        rotation={[backAngle, 0, 0]}
        material={materials.sling}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, 0.05, backLength]} />
      </mesh>
      <mesh
        position={cushionCentre}
        rotation={[backAngle, 0, 0]}
        material={materials.cushion}
        castShadow
      >
        <boxGeometry args={[0.38, 0.07, 0.22]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (width / 2 + 0.012), 0, 0]}>
          <mesh
            position={[0, seatHeight - 0.045, seatCentreZ]}
            material={materials.frame}
            castShadow
          >
            <boxGeometry args={[0.03, 0.04, seatLength + 0.02]} />
          </mesh>
          <mesh
            position={[0, backCentre[1] - 0.045, backCentre[2]]}
            rotation={[backAngle, 0, 0]}
            material={materials.frame}
            castShadow
          >
            <boxGeometry args={[0.03, 0.04, backLength]} />
          </mesh>
          {[seatCentreZ - 0.55, seatCentreZ + 0.55].map((z) => (
            <mesh key={z} position={[0, legHeight / 2, z]} material={materials.frame} castShadow>
              <boxGeometry args={[0.03, legHeight, 0.03]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function DeckLoungers({
  outline,
  innerOffset,
  band,
  waterY,
  avoid = [],
}: {
  outline: Outline;
  /** Distance from the water edge to the first paving slab. */
  innerOffset: number;
  /** Width of the paved band the furniture must stay on. */
  band: number;
  waterY: number;
  /** Deck positions to keep clear of (ladder, staircase landing). */
  avoid?: ReadonlyArray<{ x: number; z: number }>;
}) {
  const placement = useMemo(
    () => planLoungers(outline, innerOffset, band, avoid),
    [outline, innerOffset, band, avoid],
  );
  // Four shared materials for the whole set: the deck is dry, so submerged
  // LEDs are linked out exactly as they are for the paving itself.
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
  if (!placement) return null;
  return (
    <group
      name="deck-furniture"
      position={[placement.x, 0, placement.z]}
      rotation={[0, placement.rotation, 0]}
    >
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (LOUNGER.pitch / 2), 0, 0]}>
          <Lounger materials={materials} />
        </group>
      ))}
      <group name="deck-side-table" position={[0, 0, -0.1]}>
        <mesh position={[0, 0.42, 0]} material={materials.table} castShadow receiveShadow>
          <cylinderGeometry args={[0.21, 0.21, 0.025, 32]} />
        </mesh>
        <mesh position={[0, 0.21, 0]} material={materials.frame} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.4, 16]} />
        </mesh>
        <mesh position={[0, 0.006, 0]} material={materials.frame} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.012, 32]} />
        </mesh>
      </group>
    </group>
  );
}
