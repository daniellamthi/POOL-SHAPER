import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import type { Texture } from "three";
import { referenceFinish, type ReferenceFinishId } from "@/lib/pool/reference-finishes";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import { cloneReferenceFinishColorMap, configureReferencePaving, configureReferenceTexture, subscribeReferenceFinishReady, REFERENCE_SAMPLER_REVISION } from "./referenceFinishTexture";

const reportedDevelopmentSources = new Set<string>();

/** Scoped to newly selected in-ground photographic finishes. Original
 * finishes, liner and above-ground materials never enter this component. */
export function ReferencePavingMaterial({ id, waterY, vertexColors = true }: {
  id: ReferenceFinishId;
  waterY: number;
  vertexColors?: boolean;
}) {
  const finish = referenceFinish(id)!;
  const anisotropy = useThree(state => state.gl.capabilities.getMaxAnisotropy());
  const [display, setDisplay] = useState<{ id: ReferenceFinishId; texture: Texture } | null>(null);
  const ownedTextures = useRef(new Set<Texture>());
  useEffect(() => subscribeReferenceFinishReady(id, () => {
    const texture = cloneReferenceFinishColorMap(id);
    configureReferenceTexture(texture, anisotropy);
    ownedTextures.current.add(texture);
    // Texture and shader identity commit together. Until ready, the current
    // visible finish remains usable; initial load has a solid matte fallback.
    setDisplay({ id, texture });
  }), [id, anisotropy]);
  useEffect(() => {
    if (!display) return;
    // Also collects a ready clone superseded before React committed it,
    // which can happen during rapid selections or StrictMode replay.
    for (const texture of ownedTextures.current) if (texture !== display.texture) {
      texture.dispose();
      ownedTextures.current.delete(texture);
    }
  }, [display]);
  useEffect(() => () => {
    for (const texture of ownedTextures.current) texture.dispose();
    ownedTextures.current.clear();
  }, []);
  const visibleFinish = display ? referenceFinish(display.id)! : finish;
  const Material = visibleFinish.boards ? "meshPhysicalMaterial" : "meshStandardMaterial";
  return <Material key={`${display?.id ?? "pending"}-${REFERENCE_SAMPLER_REVISION}`} color="#ffffff" map={display?.texture ?? null}
    vertexColors={vertexColors} roughness={visibleFinish.roughness} metalness={0}
    {...(visibleFinish.boards ? { specularIntensity: 0.35 } : {})}
    onBeforeCompile={shader => {
      excludeSubmergedDirectLights(shader, waterY);
      if (display) {
        configureReferencePaving(shader, display.id);
        if (import.meta.env?.DEV && display.id === "reference-ipe" && !reportedDevelopmentSources.has(display.id)) {
          reportedDevelopmentSources.add(display.id);
          const source = display.texture.image as { currentSrc?: string; src?: string; width?: number; height?: number } | undefined;
          console.debug("[pool-reference-material]", JSON.stringify({ id: display.id, role: "paving",
            source: source?.currentSrc || source?.src,
            width: source?.width, height: source?.height,
            colourSpace: display.texture.colorSpace,
            projection: shader.uniforms["referenceSourceProjection"]?.value.elements,
            photographicExposure: shader.uniforms["referenceExposure"]?.value,
          }));
        }
      }
    }}
    customProgramCacheKey={() => `reference-paving-v10-${REFERENCE_SAMPLER_REVISION}-${display?.id ?? "pending"}-${waterY}`} />;
}
