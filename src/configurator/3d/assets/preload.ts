import { useGLTF } from "@react-three/drei";
import { isLocalAssetUrl } from "./registry";

export function preloadPremiumAsset(url: string) {
  if (isLocalAssetUrl(url)) useGLTF.preload(url);
}
