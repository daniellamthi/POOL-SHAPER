import type { FinishMaterial, LinerColor } from "@/lib/pool/types";

const linerBase = "/textures/pool/pvc-liner-base.png";
const mosaicBase = "/textures/pool/mosaic-base.png";

/**
 * Central replacement map for production textures. Replace an imported file
 * or point an individual colour to a new asset without touching the 3D scene.
 */
export const INTERIOR_TEXTURES: Readonly<
  Record<FinishMaterial, Readonly<Record<LinerColor, string>>>
> = {
  liner: {
    white: linerBase,
    sand: linerBase,
    lightGrey: linerBase,
    darkGrey: linerBase,
    blue: linerBase,
    green: linerBase,
  },
  mosaic: {
    white: mosaicBase,
    sand: mosaicBase,
    lightGrey: mosaicBase,
    darkGrey: mosaicBase,
    blue: mosaicBase,
    green: mosaicBase,
  },
};

export const getInteriorTexture = (finish: FinishMaterial, color: LinerColor) =>
  INTERIOR_TEXTURES[finish][color];

/** Preloaded once so switching finish never pauses or replaces the 3D scene. */
export const INTERIOR_TEXTURE_URLS = Array.from(
  new Set(Object.values(INTERIOR_TEXTURES).flatMap((collection) => Object.values(collection))),
);
