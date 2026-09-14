import * as THREE from "three";
import { COPING_MATERIALS, type CopingMaterialId } from "@/lib/pool/coping-materials";
import {
  createBeigeGresMaps,
  createLimestoneMaps,
  createPrunMaps,
  createTravertineMaps,
} from "./three/stoneTextures";

const BUILDERS: Record<CopingMaterialId, (size?: number) => { colorMap: THREE.DataTexture }> = {
  travertine: createTravertineMaps,
  limestone: createLimestoneMaps,
  prun: createPrunMaps,
  "beige-gres": createBeigeGresMaps,
};

const PREVIEW_SIZE = 96;
const cache = new Map<CopingMaterialId, string>();

/**
 * Small 2D material sample rendered from the SAME procedural stone bake the
 * 3D coping uses (see stoneTextures.ts) -- not a flat colour chip. Applies
 * the material's own base-colour tint exactly the way the coping shader
 * does (`diffuseColor *= stoneColor`), then a restrained top-left highlight
 * / bottom-right vignette standing in for gentle studio lighting -- just
 * enough to read as a physical sample, never fake gloss. Computed once per
 * material id and cached as a data URL for the lifetime of the session.
 */
export function getCopingSwatchDataUrl(id: CopingMaterialId): string {
  const cached = cache.get(id);
  if (cached) return cached;

  const material = COPING_MATERIALS.find((item) => item.id === id);
  const build = BUILDERS[id];
  if (!material || !build) return "";

  const { colorMap } = build(PREVIEW_SIZE);
  const source = colorMap.image.data as Uint8ClampedArray;
  const tint = new THREE.Color(material.color);

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    colorMap.dispose();
    return "";
  }

  const image = ctx.createImageData(PREVIEW_SIZE, PREVIEW_SIZE);
  for (let i = 0; i < PREVIEW_SIZE * PREVIEW_SIZE; i++) {
    const o = i * 4;
    image.data[o] = Math.min(255, Math.round(source[o]! * tint.r));
    image.data[o + 1] = Math.min(255, Math.round(source[o + 1]! * tint.g));
    image.data[o + 2] = Math.min(255, Math.round(source[o + 2]! * tint.b));
    image.data[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  const gradient = ctx.createLinearGradient(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  gradient.addColorStop(0, "rgba(255,255,255,0.12)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

  colorMap.dispose();

  const dataUrl = canvas.toDataURL("image/png");
  cache.set(id, dataUrl);
  return dataUrl;
}
