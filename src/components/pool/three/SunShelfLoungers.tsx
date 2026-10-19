import { useEffect, useMemo } from "react";
import type {} from "@react-three/fiber";
import { MeshPhysicalMaterial } from "three";
import { type SunShelfLoungerPlan } from "@/lib/pool/sun-shelf-loungers";
import { createLymphaShellGeometry } from "./LymphaChaiseGeometry";

/** Original schematic in-pool resin chaise. Published outer dimensions are
 * fixed; the ergonomic profile is illustrative, not manufacturer CAD. */
export const createSunShelfChaiseGeometry = createLymphaShellGeometry;

function useChaiseResources() {
  const geometry = useMemo(createSunShelfChaiseGeometry, []);
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: "#a9cfca",
        roughness: 0.48,
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
