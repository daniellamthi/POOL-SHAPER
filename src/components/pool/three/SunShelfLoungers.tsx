import { useEffect, useMemo } from "react";
import type {} from "@react-three/fiber";
import { ExtrudeGeometry, MeshPhysicalMaterial, Shape } from "three";
import { SUN_SHELF_LOUNGER_MODEL, type SunShelfLoungerPlan } from "@/lib/pool/sun-shelf-loungers";

/** Original schematic in-pool resin chaise. Published outer dimensions are
 * fixed; the ergonomic profile is illustrative, not manufacturer CAD. */
export function createSunShelfChaiseGeometry(): ExtrudeGeometry {
  const { length, width, height, seatHeight, kneeHeight } = SUN_SHELF_LOUNGER_MODEL;
  const bevel = 0.009;
  const head = -length / 2 + bevel,
    foot = length / 2 - bevel;
  const profile = new Shape();
  profile.moveTo(head, height - bevel - 0.018);
  profile.bezierCurveTo(
    head,
    height - bevel,
    head + 0.045,
    height - bevel,
    head + 0.09,
    height - bevel - 0.025,
  );
  profile.bezierCurveTo(head + 0.31, 0.43, -0.31, seatHeight - bevel, -0.06, seatHeight - bevel);
  profile.bezierCurveTo(
    0.09,
    seatHeight - bevel,
    0.12,
    kneeHeight - bevel,
    0.31,
    kneeHeight - bevel,
  );
  profile.bezierCurveTo(0.5, kneeHeight - bevel, 0.62, 0.058, foot - 0.03, 0.042);
  profile.quadraticCurveTo(foot, 0.04, foot, 0.018);
  profile.quadraticCurveTo(foot, bevel, foot - 0.035, bevel);
  profile.lineTo(-0.13, bevel);
  profile.bezierCurveTo(-0.34, bevel, -0.42, 0.22, head + 0.075, height - 0.09);
  profile.quadraticCurveTo(head, height - 0.05, head, height - bevel - 0.018);
  const geometry = new ExtrudeGeometry(profile, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 24,
    steps: 1,
  });
  // Shape XY -> vertical ZY profile; extrusion becomes the transverse X axis.
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index++) {
    const longitudinal = position.getX(index),
      transverse = position.getZ(index) - width / 2 + bevel;
    position.setXYZ(index, transverse, position.getY(index), longitudinal);
  }
  // Axis permutation changes handedness: reverse triangle winding as well.
  for (let index = 0; index < position.count; index += 3) {
    for (const attributeName of ["position", "uv"] as const) {
      const attribute = geometry.getAttribute(attributeName);
      for (let component = 0; component < attribute.itemSize; component++) {
        const value = attribute.getComponent(index + 1, component);
        attribute.setComponent(index + 1, component, attribute.getComponent(index + 2, component));
        attribute.setComponent(index + 2, component, value);
      }
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  // Author the original silhouette to the fixed published envelope once. This
  // never depends on the shelf, pool dimensions or requested furniture count.
  const box = geometry.boundingBox!;
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  geometry.scale(
    width / (box.max.x - box.min.x),
    height / (box.max.y - box.min.y),
    length / (box.max.z - box.min.z),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function useChaiseResources() {
  const geometry = useMemo(createSunShelfChaiseGeometry, []);
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: "#f0eee5",
        roughness: 0.34,
        metalness: 0,
        clearcoat: 0.18,
        clearcoatRoughness: 0.38,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return { geometry, material };
}

/** A single fixed-size product for honest product previews. Base sits at Y=0. */
export function SunShelfChaise() {
  const resources = useChaiseResources();
  return <mesh name="sun-shelf-immersed-chaise" {...resources} castShadow receiveShadow />;
}

/** Independent from exterior DeckLoungers. No scale, lights, animation or assets. */
export function SunShelfLoungers({ plan }: { plan: SunShelfLoungerPlan }) {
  return plan.enabled ? <SunShelfLoungerMeshes plan={plan} /> : null;
}

function SunShelfLoungerMeshes({ plan }: { plan: SunShelfLoungerPlan }) {
  const resources = useChaiseResources();
  return (
    <group name="sun-shelf-loungers">
      {plan.placements.map((placement, index) => (
        <mesh
          key={index}
          name={`sun-shelf-immersed-chaise-${index + 1}`}
          {...resources}
          position={[placement.x, placement.y, placement.z]}
          rotation={[0, placement.rotation, 0]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
