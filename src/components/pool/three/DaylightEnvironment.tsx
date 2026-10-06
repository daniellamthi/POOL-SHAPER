import { useEffect, useState } from "react";
import { Environment } from "@react-three/drei";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import {
  DataUtils,
  EquirectangularReflectionMapping,
  FloatType,
  HalfFloatType,
  MathUtils,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type DataTexture,
} from "three";
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

/**
 * The studio IBL (`pool-daylight-1k.hdr`) was captured beside hedges and a
 * turquoise pool: its lower hemisphere averages linear RGB 0.49/0.95/0.71, so
 * every reflective or shadowed surface picked up a green cast (steel read
 * teal, raw concrete and shadows green). The sky half is a clean daylight
 * sky and is kept. Below `fadeEnd` the colour is pulled to a warm-neutral
 * grey of the SAME luminance, so the calibrated exposure, liner and water
 * balance are unchanged -- only the contamination goes. Runs once per load
 * on the CPU; no shader, sampler or per-frame cost.
 */
const STUDIO_GROUND_NEUTRAL = {
  /** Elevation (degrees) where neutralisation starts / is complete. */
  fadeStart: 18,
  fadeEnd: 4,
  /** Fraction of the original chroma kept in the ground. */
  keepChroma: 0.08,
  /** Warm stone tint of the neutral ground, multiplied into the grey. */
  tint: [1.03, 1.0, 0.95] as const,
} as const;

function neutraliseStudioGround(texture: DataTexture) {
  const { data, width, height } = texture.image as {
    data: Uint16Array | Float32Array;
    width: number;
    height: number;
  };
  const half = texture.type === HalfFloatType;
  if (!half && texture.type !== FloatType) return;
  const read = (i: number) => (half ? DataUtils.fromHalfFloat(data[i]!) : data[i]!);
  const write = (i: number, v: number) => {
    data[i] = half ? DataUtils.toHalfFloat(v) : v;
  };
  const { fadeStart, fadeEnd, keepChroma, tint } = STUDIO_GROUND_NEUTRAL;
  for (let y = 0; y < height; y++) {
    // Radiance files store the top scanline first: row 0 is +90 degrees.
    const elevation = 90 - ((y + 0.5) / height) * 180;
    const neutral = 1 - MathUtils.smoothstep(elevation, fadeEnd, fadeStart);
    if (neutral <= 0) continue;
    const keep = MathUtils.lerp(1, keepChroma, neutral);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = read(i), g = read(i + 1), b = read(i + 2);
      const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const tr = lum * MathUtils.lerp(1, tint[0], neutral);
      const tg = lum * MathUtils.lerp(1, tint[1], neutral);
      const tb = lum * MathUtils.lerp(1, tint[2], neutral);
      write(i, tr + (r - lum) * keep);
      write(i + 1, tg + (g - lum) * keep);
      write(i + 2, tb + (b - lum) * keep);
    }
  }
  texture.needsUpdate = true;
}

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
  // Night must never light or reflect the daytime capture (its clouds and
  // sun showed up in the night water): it uses the procedural night sky.
  const night = timeOfDay === "night";
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
    if (night) return;
    new HDRLoader().load(
      assetUrl,
      (texture) => {
        if (!active) {
          texture.dispose();
          return;
        }
        texture.mapping = EquirectangularReflectionMapping;
        if (!photographicSky) neutraliseStudioGround(texture);
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
  }, [assetUrl, photographicSky, night]);
  const skyProps = {
    theme,
    sunDirection,
    sunColor: SCENE_VISUAL_PRESET.lighting.sun.color,
    sunVisibility: night ? 0 : 1,
    outdoor,
  };
  return (
    <>
      {sky && !night ? (
        <Environment map={sky} environmentRotation={[0,photographicSky ? coastalRotation : 0,0]} environmentIntensity={photographicSky ? COASTAL_DAYLIGHT.environment : SCENE_VISUAL_PRESET.environment[theme]} />
      ) : (
        <Environment
          resolution={ACTIVE_RENDERING_QUALITY.environmentResolution}
          environmentIntensity={
            night ? SCENE_VISUAL_PRESET.environment.night : SCENE_VISUAL_PRESET.environment[theme]
          }
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
