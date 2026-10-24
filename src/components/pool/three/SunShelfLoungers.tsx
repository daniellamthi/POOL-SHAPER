import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { Mesh, MeshPhysicalMaterial } from "three";
import { type SunShelfLoungerPlan } from "@/lib/pool/sun-shelf-loungers";
const ESSE_ASSET = "/models/esse-sun-shelf.glb";

function useChaiseResources() {
  // Cached once, requested only when a chaise is actually rendered. The asset
  // is already metric/grounded: no per-placement scaling or geometry changes.
  const { scene } = useGLTF(ESSE_ASSET, false, true);
  const geometry = (scene.getObjectByName("esse-owner-cad") as Mesh).geometry;
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
      // useGLTF owns the shared geometry cache; disposing it here would break
      // subsequent OFF/ON and multiple instances. Only our material is owned.
      material.dispose();
    },
    [geometry, material],
  );
  return { geometry, material };
}

/** A single fixed-size product for honest product previews. Base sits at Y=0. */
export function SunShelfChaise() {
  return (
    <Suspense fallback={null}>
      <SunShelfChaiseMesh />
    </Suspense>
  );
}

function SunShelfChaiseMesh() {
  const resources = useChaiseResources();
  return (
    <mesh name="sun-shelf-immersed-chaise" {...resources} dispose={null} castShadow receiveShadow />
  );
}

/** Independent from exterior DeckLoungers. No scale, lights or animation. */
export function SunShelfLoungers({ plan }: { plan: SunShelfLoungerPlan }) {
  return plan.enabled ? (
    <Suspense fallback={null}>
      <SunShelfLoungerMeshes plan={plan} />
    </Suspense>
  ) : null;
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
          dispose={null}
          position={[placement.x, placement.y, placement.z]}
          rotation={[0, placement.rotation, 0]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
