import { Vector2, type Texture } from "three";
import { outlineBounds } from "@/lib/pool/geometry";
import type { Outline } from "@/lib/pool/types";
import type { SceneTimeOfDay } from "./PoolScene";

/** Drape the capture's ground photograph onto the real local grade. The
 * photographed illumination is already baked into the original panorama;
 * preserve it and apply only the scene's contact/cast shadows. */
export function CoastalGroundMaterial({
  map,
  rotation,
  outline,
  projectionHeight,
  timeOfDay = "day",
}: {
  map: Texture;
  rotation: number;
  outline: Outline;
  projectionHeight: number;
  timeOfDay?: SceneTimeOfDay;
}) {
  const bounds = outlineBounds(outline);
  return <meshStandardMaterial
    key={`${rotation}:${projectionHeight}:${bounds.minX}:${bounds.maxX}:${bounds.minZ}:${bounds.maxZ}`}
    map={map}
    color={timeOfDay === "night" ? "#526579" : "#ffffff"}
    roughness={1}
    metalness={0}
    toneMapped={false}
    transparent={false}
    depthWrite
    onBeforeCompile={shader => {
      shader.uniforms["coastRotation"] = { value: new Vector2(Math.cos(rotation), Math.sin(rotation)) };
      shader.uniforms["coastProjectionHeight"] = { value: projectionHeight };
      shader.uniforms["coastMin"] = { value: new Vector2(bounds.minX, bounds.minZ) };
      shader.uniforms["coastMax"] = { value: new Vector2(bounds.maxX, bounds.maxZ) };
      shader.vertexShader = "varying vec2 vCoastalPlan;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n vCoastalPlan = (modelMatrix * vec4(transformed, 1.0)).xz;");
      shader.fragmentShader = `varying vec2 vCoastalPlan;
        uniform vec2 coastRotation;
        uniform float coastProjectionHeight;
        uniform vec2 coastMin;
        uniform vec2 coastMax;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <shadowmap_pars_fragment>",
        "#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>");
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
        vec2 outsideCoast = max(max(coastMin - vCoastalPlan, vCoastalPlan - coastMax), vec2(0.0));
        if (length(outsideCoast) > 6.0) discard;
        vec2 coastPoint = vec2(
          coastRotation.x * vCoastalPlan.x - coastRotation.y * vCoastalPlan.y,
          coastRotation.y * vCoastalPlan.x + coastRotation.x * vCoastalPlan.y);
        vec3 coastDirection = normalize(vec3(coastPoint.x, -coastProjectionHeight, coastPoint.y));
        vec2 coastUv = vec2(0.5 + atan(coastDirection.z, coastDirection.x) / (2.0 * PI),
          0.5 + asin(coastDirection.y) / PI);
        diffuseColor *= texture2D(map, coastUv);
      `);
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
        outgoingLight = diffuseColor.rgb * mix(0.78, 1.0, getShadowMask());
        #include <opaque_fragment>
      `);
    }}
    customProgramCacheKey={() => `coastal-ground-projection-v1-${rotation}-${projectionHeight}`}
  />;
}
