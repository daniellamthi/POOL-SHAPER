import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Outline } from "@/lib/pool/types";
import { offsetOutline } from "@/lib/pool/geometry";
import { CLADDING, planCladding, type ExteriorPanelFinishId } from "@/lib/pool/above-ground";
import { loadCopingTextureMaps } from "./stoneTextures";
import { createWallGeometry } from "./poolGeometry";

/**
 * Above-ground exterior: vertical cladding boards on a recessed backing,
 * closed on all four sides. Independent of the basin (liner / stainless)
 * and of the coping: changing either never touches these boards.
 */
export function AboveGroundCladding({
  outline,
  faceOffset,
  groundY,
  topY,
  finish,
}: {
  outline: Outline;
  /** Panel face, metres outward from the water edge (see claddingFaceOffset). */
  faceOffset: number;
  groundY: number;
  /** Underside of the coping. */
  topY: number;
  finish: ExteriorPanelFinishId;
}) {
  const face = useMemo(() => offsetOutline(outline, faceOffset), [outline, faceOffset]);
  const boards = useMemo(() => {
    const height = Math.max(0.05, topY - groundY - CLADDING.plinth);
    const parts: THREE.BufferGeometry[] = [];
    for (const side of planCladding(face)) {
      const tx = (side.b[0] - side.a[0]) / side.length,
        tz = (side.b[1] - side.a[1]) / side.length;
      const angle = Math.atan2(-tz, tx);
      for (const panel of side.panels) {
        const width = panel.to - panel.from - CLADDING.joint;
        if (width <= 0) continue;
        const centre = (panel.from + panel.to) / 2;
        const box = new THREE.BoxGeometry(width, height, CLADDING.thickness);
        // Box depth axis is local Z; turn it so +Z faces outward.
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(
            side.a[0] + tx * centre - side.normal[0] * (CLADDING.thickness / 2),
            groundY + CLADDING.plinth + height / 2,
            side.a[1] + tz * centre - side.normal[1] * (CLADDING.thickness / 2),
          ),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
          new THREE.Vector3(1, 1, 1),
        );
        box.applyMatrix4(matrix);
        parts.push(box);
      }
    }
    const merged = mergeGeometries(parts)!;
    parts.forEach((part) => part.dispose());
    return merged;
  }, [face, groundY, topY]);
  // The joints show the sub-frame behind the boards: a shade of the board's
  // own tone a few centimetres back, never a black line.
  const backing = useMemo(
    () =>
      createWallGeometry(
        offsetOutline(outline, faceOffset - CLADDING.thickness - 0.006),
        topY,
        groundY,
      ),
    [outline, faceOffset, topY, groundY],
  );
  useEffect(
    () => () => {
      boards.dispose();
      backing.dispose();
    },
    [boards, backing],
  );
  const backingColor =
    finish === "steel-satin" ? "#5d6063" : finish === "gres" ? "#6e665c" : "#8f8d88";
  return (
    <group name="above-ground-cladding">
      <mesh name="cladding-backing" geometry={backing} receiveShadow>
        <meshStandardMaterial color={backingColor} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh name={`cladding-boards-${finish}`} geometry={boards} castShadow receiveShadow>
        <CladdingMaterial finish={finish} />
      </mesh>
    </group>
  );
}

const GRES_NORMAL = new THREE.Vector2(0.45, 0.45);

/** The board finish, shared by the cladding and the external staircase so
 * the stair's sides always match the pool's panels. */
export function CladdingMaterial({ finish }: { finish: ExteriorPanelFinishId }) {
  const gres = useMemo(
    () => (finish === "gres" ? loadCopingTextureMaps("/textures/coping/gres") : null),
    [finish],
  );
  useEffect(
    () => () => {
      if (gres) Object.values(gres).forEach((map) => map?.dispose());
    },
    [gres],
  );
  if (finish === "steel-satin")
    // Brushed stainless boards: a mid satin grey with soft, controlled
    // reflections (the reference installations), not the pale basin tone.
    return (
      <meshStandardMaterial
        key="steel"
        color="#a2a5a9"
        roughness={0.4}
        metalness={0.55}
        envMapIntensity={1}
      />
    );
  if (finish === "gres" && gres)
    // Porcelain boards: the catalogue's warm greige as a calm, even colour,
    // with the gres scan's fine surface relief and roughness only (its
    // colour map is a weathered concrete pattern that read as streaks).
    return (
      <meshStandardMaterial
        key="gres"
        color="#b9afa2"
        normalMap={gres.normalMap}
        normalScale={GRES_NORMAL}
        roughnessMap={gres.roughnessMap}
        roughness={1}
        metalness={0}
      />
    );
  return <meshStandardMaterial key="composite" color="#e2e0da" roughness={0.72} metalness={0} />;
}
