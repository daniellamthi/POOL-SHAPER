import { useEffect, useState } from "react";
import { Environment } from "@react-three/drei";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader, type Texture, type DataTexture } from "three";
import { SkyDome } from "./SkyDome";
import {CoastalPhotoBackdrop} from "./CoastalPhotoBackdrop";
import {
  ACTIVE_RENDERING_QUALITY,
  SCENE_VISUAL_PRESET,
} from "@/configurator/3d/scene/visual-preset";
import type { Theme } from "@/lib/theme";
import type { SceneTimeOfDay } from "./PoolScene";

// Coastal capture: let the broad sky illuminate metal and shadowed stone;
// the studio's low IBL / strong key-light ratio crushed steel reflections.
export const COASTAL_DAYLIGHT = { environment: 0.85, sun: 1.8, sky: 0.12 } as const;

/** Infinity daylight pairs the photographic panorama with the HDR lighting
 * from the same CC0 capture, both oriented to the selected edge.
 * Studio/night retain their established procedural presentation. */
export function DaylightEnvironment({
  theme,
  timeOfDay = "day",
  sunDirection,
  outdoor = false,
  coastalRotation = 0,
}: {
  theme: Theme;
  timeOfDay?: SceneTimeOfDay;
  sunDirection: [number, number, number];
  outdoor?: boolean;
  coastalRotation?: number;
}) {
  const [sky, setSky] = useState<DataTexture | null>(null);
  const [panorama,setPanorama] = useState<Texture|null>(null);
  // Separate background detail from IBL resolution without mixing locations.
  // Studio/night retain their existing resources.
  const photographicSky = outdoor;
  const assetUrl = photographicSky ? "/hdri/simons-town-rocks-1k.hdr" : "/hdri/pool-daylight-1k.hdr";
  useEffect(()=>{
    if(!photographicSky)return;
    let active=true,owned:Texture|null=null;
    new TextureLoader().load("/hdri/simons-town-rocks-background.jpg",texture=>{
      if(!active){texture.dispose();return;}
      texture.colorSpace=SRGBColorSpace;
      owned=texture;setPanorama(texture);
    },undefined,()=>console.warn("[Pool3D] Coastal panorama unavailable; using procedural sky."));
    return()=>{active=false;owned?.dispose();setPanorama(null);};
  },[photographicSky]);
  useEffect(() => {
    let active = true;
    let owned: DataTexture | null = null;
    setSky(null);
    new HDRLoader().load(
      assetUrl,
      (texture) => {
        if (!active) {
          texture.dispose();
          return;
        }
        texture.mapping = EquirectangularReflectionMapping;
        owned = texture;
        setSky(texture);
      },
      undefined,
      () => console.warn("[Pool3D] Local daylight HDR unavailable; using procedural daylight."),
    );
    return () => {
      active = false;
      owned?.dispose();
    };
  }, [assetUrl]);
  const skyProps = {
    theme,
    sunDirection,
    sunColor: SCENE_VISUAL_PRESET.lighting.sun.color,
    sunVisibility: 1,
    outdoor,
  };
  return (
    <>
      {sky ? (
        <Environment map={sky} environmentRotation={[0,photographicSky ? coastalRotation : 0,0]} environmentIntensity={photographicSky ? COASTAL_DAYLIGHT.environment : SCENE_VISUAL_PRESET.environment[theme]} />
      ) : (
        <Environment
          resolution={ACTIVE_RENDERING_QUALITY.environmentResolution}
          environmentIntensity={SCENE_VISUAL_PRESET.environment[theme]}
        >
          <SkyDome {...skyProps} radius={50} />
        </Environment>
      )}
      {photographicSky && panorama
        ? <CoastalPhotoBackdrop map={panorama} rotation={coastalRotation} timeOfDay={timeOfDay}/>
        : <SkyDome {...skyProps}/>}
    </>
  );
}
