/** Joint-free grain inside one board of the original Planks012 scan.
 * All PBR maps sample the same window. Mirrored wrapping joins identical
 * endpoint texels; its derivative preserves the original metric texel density. */
// TextureLoader flips bitmap Y. This window is inside the second photographed
// board, clear of its bevel, end joints and fasteners in every scanned PBR map.
export const DECK_GRAIN_ORIGIN = [0.205, 0.883] as const;
export const DECK_GRAIN_EXTENT = [0.23, 0.018] as const;

export function deckGrainUV(uv: readonly [number, number]): [number, number] {
  return uv.map((value, axis) => {
    const phase = value / DECK_GRAIN_EXTENT[axis]! * .5;
    const wrapped = 1 - Math.abs((phase - Math.floor(phase)) * 2 - 1);
    return DECK_GRAIN_ORIGIN[axis]! + DECK_GRAIN_EXTENT[axis]! * wrapped;
  }) as [number, number];
}

export function configureDeckCopingGrain(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
const vec2 deckGrainExtent = vec2(${DECK_GRAIN_EXTENT.join(",")});
vec2 deckGrainUV(vec2 uv) {
  vec2 wrapped = 1.0 - abs(fract(uv / deckGrainExtent * 0.5) * 2.0 - 1.0);
  return vec2(${DECK_GRAIN_ORIGIN.join(",")}) + deckGrainExtent * wrapped;
}
vec2 deckGrainSigns(vec2 uv) {
  vec2 phase = fract(uv / deckGrainExtent * 0.5);
  vec2 edgeDistance = min(min(phase, 1.0 - phase), abs(phase - 0.5));
  // Mirrored height profiles have zero slope at their turning points: avoid
  // a sharp lighting seam from abruptly reversing the scanned tangent normal.
  return mix(vec2(1.0), vec2(-1.0), step(vec2(0.5), phase))
    * smoothstep(vec2(0.0), vec2(0.025), edgeDistance);
}`);
  for (const axes of ["zy", "xz", "xy"]) {
    const uv = `vTriWorldPosition.${axes} * TRI_UV_SCALE`;
    shader.fragmentShader = shader.fragmentShader.replaceAll(`, ${uv})`, `, deckGrainUV(${uv}))`);
  }
  shader.fragmentShader = shader.fragmentShader.replace("triTangentX.xy *= normalScale;", `
triTangentX.xy *= deckGrainSigns(vTriWorldPosition.zy * TRI_UV_SCALE);
triTangentY.xy *= deckGrainSigns(vTriWorldPosition.xz * TRI_UV_SCALE);
triTangentZ.xy *= deckGrainSigns(vTriWorldPosition.xy * TRI_UV_SCALE);
triTangentX.xy *= normalScale;`);
}
