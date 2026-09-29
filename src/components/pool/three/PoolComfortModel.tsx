import { useEffect, useMemo, type ReactNode } from "react";
import type { FloorProfileModel } from "@/lib/pool/floor-profile";
import type { ComfortPlan } from "@/lib/pool/comfort-plan";
import { stairSolid } from "./PoolAccessModel";

/** Closed, floor-following comfort solids. The supplied material is the same
 * liner/mosaic + caustics material used by the integrated stairs. */
export function PoolComfortModel({
  plan,
  floorProfile,
  children,
}: {
  plan: ComfortPlan;
  floorProfile: FloorProfileModel;
  children: ReactNode;
}) {
  const geometries = useMemo(
    () =>
      plan.elements.map((element) => ({
        element,
        geometry: stairSolid(
          element.footprint,
          element.topY,
          { x: 0, z: 0, rotation: 0 },
          floorProfile,
        ),
      })),
    [plan.elements, floorProfile],
  );
  useEffect(() => () => geometries.forEach(({ geometry }) => geometry.dispose()), [geometries]);

  return (
    <group name="pool-comfort">
      {geometries.map(({ element, geometry }) => (
        <mesh
          key={element.kind}
          name={`pool-comfort-${element.kind}`}
          geometry={geometry}
          castShadow
          receiveShadow
        >
          {children}
        </mesh>
      ))}
    </group>
  );
}
