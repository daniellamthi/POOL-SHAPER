import { useEffect, useState } from "react";
import { Environment } from "@react-three/drei";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EquirectangularReflectionMapping, type DataTexture } from "three";
import { SkyDome } from "./SkyDome";
import { ACTIVE_RENDERING_QUALITY, SCENE_VISUAL_PRESET } from "@/configurator/3d/scene/visual-preset";
import type { Theme } from "@/lib/theme";

/** The same local HDR sky drives diffuse light, glossy IBL and the planar
 * mirror. Only one PMREM bake, no additional per-frame environment capture. */
export function DaylightEnvironment({ theme, sunDirection }: {
  theme: Theme;
  sunDirection: [number, number, number];
}) {
  const [sky, setSky] = useState<DataTexture | null>(null);
  useEffect(() => {
    let active = true;
    let owned: DataTexture | null = null;
    new HDRLoader().load("/hdri/pool-daylight-1k.hdr", texture => {
      if (!active) { texture.dispose(); return; }
      texture.mapping = EquirectangularReflectionMapping;
      owned = texture;
      setSky(texture);
    }, undefined, () => console.warn("[Pool3D] Local daylight HDR unavailable; using procedural daylight."));
    return () => { active = false; owned?.dispose(); };
  }, []);
  const skyProps = { theme, sunDirection, sunColor: SCENE_VISUAL_PRESET.lighting.sun.color, sunVisibility: 1 };
  return <>
    {sky ? <Environment map={sky} environmentIntensity={SCENE_VISUAL_PRESET.environment[theme]} /> :
      <Environment resolution={ACTIVE_RENDERING_QUALITY.environmentResolution} environmentIntensity={SCENE_VISUAL_PRESET.environment[theme]}>
        <SkyDome {...skyProps} radius={50} />
      </Environment>}
    <SkyDome {...skyProps} />
    {sky ? <SkyDome {...skyProps} environmentMap={sky} reflectionOnly /> : null}
  </>;
}
