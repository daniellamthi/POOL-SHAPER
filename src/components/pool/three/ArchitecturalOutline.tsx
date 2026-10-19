import { useLayoutEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Group, Mesh } from "three";
import { architecturalEdges, architecturalLineWeight, mergeArchitecturalEdges, type PlanEdgeSet, type PlanLineWeight, type PlanPoint } from "./architecturalPlan";
import { heroCaptureState } from "@/lib/project-delivery/heroCapture";

export const ARCHITECTURAL_OUTLINE_NAME = "pool-architectural-outlines";

/** Only semantic construction meshes; never water, scenery, jets or LED halos. */
export function isArchitecturalMesh(mesh: Mesh) {
  return architecturalLineWeight(mesh.name, mesh.parent?.name) !== null;
}

export function ArchitecturalOutline({ revision, premium = false }: { revision: string; premium?: boolean }) {
  const scene = useThree(s => s.scene);
  const group = useRef<Group>(null);
  const [lines, setLines] = useState<Record<PlanLineWeight, PlanPoint[]>>({ primary: [], secondary: [] });
  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);
    const next: PlanEdgeSet[] = [];
    scene.traverseVisible(object => {
      if (!(object instanceof Mesh)) return;
      const weight = architecturalLineWeight(object.name, object.parent?.name);
      if (weight) next.push({ points: architecturalEdges(object.geometry, object.matrixWorld), weight });
    });
    setLines(mergeArchitecturalEdges(next));
  }, [scene, revision]);
  useFrame(() => {
    if (group.current) group.current.visible = !heroCaptureState.pending;
  });
  if (!lines.primary.length && !lines.secondary.length) return null;
  return <group ref={group} name={ARCHITECTURAL_OUTLINE_NAME}>
    {/* Pale halo separates dark stone; graphite hairline stays readable on PVC.
        Depth testing hides lower edges under real opaque coping/benches.
        A full pixel core stays readable at DPR 1; secondary hierarchy comes
        from the lighter tone rather than a fragile subpixel stroke. */}
    {(["secondary", "primary"] as const).map(weight => lines[weight].length ?
      <group key={weight}>
        <Line points={lines[weight]} segments color="#eeeae2" lineWidth={weight === "primary" ? premium ? 2.2 : 1.9 : 1.8}
          transparent opacity={0.5} alphaToCoverage={premium || weight === "primary"} depthTest depthWrite={false} toneMapped={false} renderOrder={90} />
        <Line points={lines[weight]} segments color={weight === "primary" ? "#304548" : "#44595c"}
          lineWidth={premium && weight === "primary" ? 1.3 : 1} transparent opacity={weight === "primary" ? 0.84 : 0.9}
          alphaToCoverage={premium || weight === "primary"} depthTest depthWrite={false} toneMapped={false} renderOrder={91} />
      </group> : null)}
  </group>;
}
