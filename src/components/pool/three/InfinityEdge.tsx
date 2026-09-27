import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { createInfinityCascadeGeometry, createInfinityWaterFilmGeometry } from "./infinityEdgeGeometry";
import { createInfinityContainmentGeometry, infinityContainmentLevels, insetInfinityWaterZone } from "./infinityContainment";
import { WaterSurfaceMaterial } from "./WaterSurfaceMaterial";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import { clampInfinityEdgeDimensions, computeInfinityEdgeGeometry, infinityZonesForOutline } from "@/lib/pool/infinity-edge";
import type { InfinityEdgeParams } from "@/lib/pool/infinity-edge";
import type { Outline, PoolShapeId } from "@/lib/pool/types";
import type { ResolvedMaterials } from "@/lib/pool/materials";
import type { StoneMaps } from "./stoneTextures";

interface InfinityEdgeProps {
  outline: Outline;
  shape: PoolShapeId;
  infinityEdge: InfinityEdgeParams | undefined;
  waterLevel: number;
  copingSurfaceY: number;
  copingOuterOffsetDistance: number;
  materials: ResolvedMaterials;
  copingDetail: StoneMaps;
  configureCopingTriplanar: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
}

export function InfinityEdge({ outline, shape, infinityEdge, waterLevel, copingSurfaceY, copingOuterOffsetDistance, copingDetail }: InfinityEdgeProps) {
  const assembly = useMemo(() => {
    const geometry = infinityEdge ? computeInfinityEdgeGeometry(outline, infinityEdge, shape) : null;
    const zone = geometry ? infinityZonesForOutline(outline, shape).find(z => z.side === geometry.side) : null;
    if (!zone) return null;
    const dims = clampInfinityEdgeDimensions(undefined);
    const levels = infinityContainmentLevels(dims, waterLevel);
    const flowZone = insetInfinityWaterZone(zone, 0.012);
    // Millimetric stand-off prevents coplanar film/wall flicker. Receiver
    // water stops inside the end walls and below every containing rim.
    const filmOffset = dims.lipWidth + 0.003;
    return {
      dims, levels,
      structure: createInfinityContainmentGeometry(zone, dims, waterLevel, copingOuterOffsetDistance, copingSurfaceY, outline),
      film: createInfinityWaterFilmGeometry(flowZone, filmOffset, waterLevel),
      cascade: createInfinityCascadeGeometry(flowZone, { ...dims, lipWidth: filmOffset }, waterLevel),
      receiver: createInfinityWaterFilmGeometry(flowZone, dims.lipWidth + dims.catchBasinWidth - 0.004, levels.receiverY, filmOffset),
    };
  }, [outline, shape, infinityEdge, waterLevel, copingSurfaceY, copingOuterOffsetDistance]);
  useEffect(() => () => {
    if (assembly) for (const g of [assembly.structure, assembly.film, assembly.cascade, assembly.receiver]) g.dispose();
  }, [assembly]);
  if (!assembly) return null;
  return <group name="infinity-edge">
    <mesh name="infinity-closed-grey-containment" geometry={assembly.structure} receiveShadow castShadow>
      <meshPhysicalMaterial color="#a6a6a6" map={copingDetail.colorMap} normalMap={copingDetail.normalMap} normalScale={[0.22, 0.22]}
        roughnessMap={copingDetail.roughnessMap} roughness={0.68} metalness={0} side={THREE.DoubleSide}
        onBeforeCompile={(shader) => {
          excludeSubmergedDirectLights(shader, waterLevel);
          shader.uniforms["receiverY"] = { value: assembly.levels.receiverY };
          shader.vertexShader = "attribute float wetRole; varying float vWetRole; varying float vStructureY;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vWetRole = wetRole; vStructureY = position.y;");
          shader.fragmentShader = "varying float vWetRole; varying float vStructureY; uniform float receiverY;\n" + shader.fragmentShader;
          // Reuse the stone scan's mineral detail, but never inherit a beige
          // or liner tint on the independent gray containment structure.
          shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));");
          shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
            #include <color_fragment>
            float wetted = vWetRole > 1.5 ? 1.0 - smoothstep(receiverY - 0.01, receiverY + 0.01, vStructureY) : vWetRole;
            diffuseColor.rgb *= mix(1.0, 0.62, wetted);
          `).replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, max(0.14, roughnessFactor * 0.32), wetted);");
        }} customProgramCacheKey={() => `infinity-grey-wet-containment-v5-${assembly.levels.receiverY}`} />
    </mesh>
    <mesh name="infinity-crest-water" geometry={assembly.film} renderOrder={2}>
      <WaterSurfaceMaterial waterLevel={waterLevel} reflections={false} depth={0.006} flowing />
    </mesh>
    <mesh name="infinity-attached-film" geometry={assembly.cascade} renderOrder={2}>
      <WaterSurfaceMaterial waterLevel={waterLevel - assembly.dims.dropHeight / 2} reflections={false} depth={0.003} fallingFilm />
    </mesh>
    <mesh name="infinity-contained-receiver-water" geometry={assembly.receiver} renderOrder={2}>
      <WaterSurfaceMaterial waterLevel={assembly.levels.receiverY} reflections={false} depth={assembly.dims.catchBasinDepth} flowing />
    </mesh>
  </group>;
}
