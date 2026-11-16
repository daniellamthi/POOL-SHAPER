import { useCallback, useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, NoColorSpace, RepeatWrapping, ShaderChunk, SRGBColorSpace, TextureLoader, type WebGLProgramParametersWithUniforms } from "three";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";

const GRASS_METRES_PER_TILE = 1;
const GRASS_TEXTURE_URLS = [
  "/textures/grass/mowed-lawn-v1/basecolor.jpg",
  "/textures/grass/mowed-lawn-v1/normal-rg-roughness-b.png",
];

// Three offset samples on a triangular grid. No rotated/mirrored blades,
// extra meshes, parallax, animation or texture reads driven by React frames.
// Explicit gradients keep mip selection continuous across patch boundaries.
const grassSampling = /* glsl */ `
vec2 grassOffset(vec2 cell) {
  return fract(sin(vec2(dot(cell, vec2(127.1, 311.7)), dot(cell, vec2(269.5, 183.3)))) * 43758.5453);
}
vec4 sampleNaturalGrass(sampler2D sourceMap, vec2 uv) {
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec2 p = vec2(uv.x - uv.y * 0.577350269, uv.y * 1.154700538);
  vec2 cell = floor(p), f = fract(p);
  vec2 a, b, c;
  vec3 weight;
  if (f.x + f.y < 1.0) {
    a = cell; b = cell + vec2(1.0, 0.0); c = cell + vec2(0.0, 1.0);
    weight = vec3(1.0 - f.x - f.y, f.x, f.y);
  } else {
    a = cell + vec2(1.0); b = cell + vec2(0.0, 1.0); c = cell + vec2(1.0, 0.0);
    weight = vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y);
  }
  weight = weight * weight * weight;
  weight /= dot(weight, vec3(1.0));
  return weight.x * textureGrad(sourceMap, uv + grassOffset(a), dx, dy)
       + weight.y * textureGrad(sourceMap, uv + grassOffset(b), dx, dy)
       + weight.z * textureGrad(sourceMap, uv + grassOffset(c), dx, dy);
}`;

function configureNaturalGrass(shader: WebGLProgramParametersWithUniforms, waterY: number) {
  excludeSubmergedDirectLights(shader, waterY);
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${grassSampling}`)
    .replace("#include <map_fragment>", `
      vec4 grassPhotograph = sampleNaturalGrass(map, vMapUv);
      float grassLuminance = dot(grassPhotograph.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor *= vec4(mix(grassPhotograph.rgb, vec3(grassLuminance), 0.08), grassPhotograph.a);
    `)
    .replace("#include <roughnessmap_fragment>", `
      vec4 grassDetail = sampleNaturalGrass(normalMap, vNormalMapUv);
      float roughnessFactor = roughness * grassDetail.b;
    `)
    .replace("#include <normal_fragment_maps>", ShaderChunk.normal_fragment_maps.replace(
      "vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;",
      `vec2 grassNormalXY = grassDetail.rg * 2.0 - 1.0;
       vec3 mapN = vec3(grassNormalXY, sqrt(max(0.0, 1.0 - dot(grassNormalXY, grassNormalXY))));`,
    ));
}

/** Kept mounted after the garden's first reveal. Phase navigation changes only
 * the attached material, not the photographic samplers or compiled lawn owner.
 * URL-cached originals are never changed or disposed by this consumer. */
export function NaturalGrassMaterial({ active, waterY }: { active: boolean; waterY: number }) {
  const anisotropy = useThree(s => Math.min(8, s.gl.capabilities.getMaxAnisotropy()));
  const sources = useLoader(TextureLoader, GRASS_TEXTURE_URLS);
  const maps = useMemo(() => sources.map((source, index) => {
    const texture = source.clone();
    texture.colorSpace = index === 0 ? SRGBColorSpace : NoColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(1 / GRASS_METRES_PER_TILE, 1 / GRASS_METRES_PER_TILE);
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return texture;
  }), [sources, anisotropy]);
  const material = useMemo(() => new MeshStandardMaterial({ name: `natural-grass-${waterY}` }), [waterY]);
  useEffect(() => () => maps.forEach(texture => texture.dispose()), [maps]);
  useEffect(() => () => material.dispose(), [material]);
  const configure = useCallback((shader: WebGLProgramParametersWithUniforms) => configureNaturalGrass(shader, waterY), [waterY]);
  return active ? <primitive object={material} attach="material" color="#ffffff" map={maps[0]} normalMap={maps[1]}
    normalScale={[0.28, 0.28]} roughness={1} metalness={0} envMapIntensity={0.6}
    onBeforeCompile={configure} customProgramCacheKey={() => `natural-grass-photo-v1-${waterY}`} />
    : <meshStandardMaterial color="#ddd9d2" roughness={0.95}
      onBeforeCompile={shader => excludeSubmergedDirectLights(shader, waterY)}
      customProgramCacheKey={() => `studio-ground-dry-${waterY}`} />;
}
