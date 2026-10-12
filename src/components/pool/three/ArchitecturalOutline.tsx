import { useLayoutEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Group, Mesh } from "three";
import { architecturalEdges, type PlanPoint } from "./architecturalPlan";
import { heroCaptureState } from "@/lib/project-delivery/heroCapture";

export const ARCHITECTURAL_OUTLINE_NAME = "pool-architectural-outlines";

/** Only semantic construction meshes; never water, scenery, jets or LED halos. */
export function isArchitecturalMesh(mesh: Mesh) {
  return mesh.name.startsWith("plan-") ||
    mesh.name.startsWith("pool-comfort-") ||
    mesh.parent?.name.startsWith("pool-access-internalSteps-") ||
    // Grille slats are already real geometry. Outlining every 14 mm bar
    // collapses into a black band at mobile scale; trace their seats instead.
    ["overflow-kerb", "overflow-edge-without-grille",
      "infinity-closed-grey-containment", "external-stair-tread"].includes(mesh.name);
}

export function ArchitecturalOutline({ revision }: { revision: string }) {
  const scene = useThree(s => s.scene);
  const group = useRef<Group>(null);
  const [points, setPoints] = useState<PlanPoint[]>([]);
  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);
    const next: PlanPoint[] = [];
    scene.traverseVisible(object => {
      if (object instanceof Mesh && isArchitecturalMesh(object))
        next.push(...architecturalEdges(object.geometry, object.matrixWorld));
    });
    setPoints(next);
  }, [scene, revision]);
  useFrame(() => {
    if (group.current) group.current.visible = !heroCaptureState.pending;
  });
  if (!points.length) return null;
  return <group ref={group} name={ARCHITECTURAL_OUTLINE_NAME}>
    {/* Pale halo separates dark stone; graphite hairline stays readable on PVC.
        Depth testing hides lower edges under real opaque coping/benches. */}
    <Line points={points} segments color="#eeeae2" lineWidth={1.8} transparent opacity={0.55}
      depthTest depthWrite={false} toneMapped={false} renderOrder={90} />
    <Line points={points} segments color="#39494b" lineWidth={0.85} transparent opacity={0.8}
      depthTest depthWrite={false} toneMapped={false} renderOrder={91} />
  </group>;
}
