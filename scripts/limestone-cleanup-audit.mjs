import assert from "node:assert/strict";
import { build } from "rolldown";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SRGBColorSpace, NoColorSpace, RepeatWrapping } from "three";

await build({
  input: ["src/lib/pool/coping-materials.ts", "src/components/pool/three/stoneTextures.ts"],
  output: { dir: resolve("node_modules/.cache/limestone-cleanup-audit"), format: "esm" },
  platform: "node", external: ["three"],
});
const { COPING_MATERIALS } = await import(pathToFileURL(resolve("node_modules/.cache/limestone-cleanup-audit/coping-materials.js")));
const { createLimestoneMaps } = await import(pathToFileURL(resolve("node_modules/.cache/limestone-cleanup-audit/stoneTextures.js")));
const material = COPING_MATERIALS.find(m => m.id === "limestone");
assert.equal(material.moduleSize, 1.2, "physical texture coverage, not slab dimensions");
assert.equal(material.normalStrength, .22);
assert(material.roughness >= .8, "honed limestone must not become plastic");
const start = performance.now();
const maps = createLimestoneMaps(512);
const coldMs = performance.now() - start;
const warmStart = performance.now();
const second = createLimestoneMaps(512);
const cachedMs = performance.now() - warmStart;
assert.notEqual(maps.colorMap, second.colorMap, "consumers own independent sampler/disposal state");
assert.equal(maps.colorMap.image.data, second.colorMap.image.data, "no duplicate baked pixel buffer");
let min = 255, max = 0;
for (const [name, map] of Object.entries(maps)) {
  assert.equal(map.image.width, 512);
  assert.equal(map.wrapS, RepeatWrapping);
  assert.equal(map.wrapT, RepeatWrapping);
  assert.equal(map.colorSpace, name === "colorMap" ? SRGBColorSpace : NoColorSpace);
  const data = map.image.data;
  for (let i = 0; i < data.length; i += 4) {
    assert.equal(data[i + 3], 255);
    if (name === "colorMap") { min = Math.min(min, data[i]); max = Math.max(max, data[i]); }
    if (name === "roughnessMap") assert(data[i] >= 210 && data[i] <= 249);
    if (name === "normalMap") assert(data[i + 2] >= 250, "restrained, non-exaggerated relief");
  }
}
assert(min > 190 && max < 250 && max - min < 50, "subtle non-clipped natural variation");
for (const group of [maps, second]) Object.values(group).forEach(map => map.dispose());
console.log(JSON.stringify({ status: "PASS", textureSize: 512, rgbaBytes: 3 * 512 * 512 * 4, coldCpuBakeMs: +coldMs.toFixed(2), cachedCloneMs: +cachedMs.toFixed(2), min, max, note: "CPU texture generation only, not browser FPS or GPU memory" }));
