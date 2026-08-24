import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { isLocalAssetUrl } from "../assets/registry";
import type { MaterialOverride, PremiumAssetDescriptor } from "../assets/types";

interface PremiumAssetProps {
  descriptor: PremiumAssetDescriptor;
  url: string;
  materialOverrides?: MaterialOverride;
  variant?: string;
}

/**
 * Cached GLTF instance with isolated materials and shared geometry. It supports
 * static and skinned assets without mutating useGLTF's global cache.
 */
export function PremiumAsset({
  descriptor,
  url,
  materialOverrides = {},
  variant,
}: PremiumAssetProps) {
  if (!isLocalAssetUrl(url)) {
    throw new Error(`Premium assets must use a local URL: ${url}`);
  }

  return (
    <PremiumAssetModel
      descriptor={descriptor}
      url={url}
      materialOverrides={materialOverrides}
      {...(variant !== undefined ? { variant } : {})}
    />
  );
}

function PremiumAssetModel({
  descriptor,
  url,
  materialOverrides = {},
  variant,
}: PremiumAssetProps) {
  const gltf = useGLTF(url) as unknown as { scene: THREE.Group };
  const { scene, ownedMaterials } = useMemo(() => {
    const instance = cloneSkeleton(gltf.scene) as THREE.Group;
    const materials: THREE.Material[] = [];

    instance.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const sources = Array.isArray(object.material) ? object.material : [object.material];
      const replacements = sources.map((source) => {
        const override = materialOverrides[source.name];
        if (override) return override;
        const material = source.clone();
        materials.push(material);
        return material;
      });
      object.material = Array.isArray(object.material) ? replacements : replacements[0]!;
    });

    return { scene: instance, ownedMaterials: materials };
  }, [gltf.scene, materialOverrides]);

  useEffect(() => () => ownedMaterials.forEach((material) => material.dispose()), [ownedMaterials]);

  const activeVariant = variant && descriptor.variantNames.includes(variant) ? variant : undefined;
  useEffect(() => {
    if (!activeVariant) return;
    scene.traverse((object) => {
      const taggedVariant = object.userData["variant"] as string | undefined;
      if (taggedVariant) object.visible = taggedVariant === activeVariant;
    });
  }, [activeVariant, scene]);

  return (
    <primitive
      object={scene}
      position={descriptor.transform.position}
      rotation={descriptor.transform.rotation}
      scale={descriptor.transform.scale}
      dispose={null}
    />
  );
}
