import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "rolldown";
import { Texture, TextureLoader, MirroredRepeatWrapping, SRGBColorSpace } from "three";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

await build({
  input: ["src/lib/pool/coping-materials.ts", "src/components/pool/three/stoneTextures.ts"],
  output: { dir: resolve("node_modules/.cache/prun-audit"), format: "esm" },
  platform: "node",
  external: ["three"],
});
const { COPING_MATERIALS } = await import(pathToFileURL(resolve("node_modules/.cache/prun-audit/coping-materials.js")));
const { loadCopingTextureMaps } = await import(pathToFileURL(resolve("node_modules/.cache/prun-audit/stoneTextures.js")));
const prun = COPING_MATERIALS.find(m => m.id === "prun");
assert.equal(prun.color, "#ffffff", "Real photo must not receive the old grey tint");
assert.equal(prun.asset.normalMap, false);
assert.equal(prun.asset.roughnessMap, false);
const png = readFileSync("public/textures/coping/prun/basecolor.png");
assert.equal(png.readUInt32BE(16), 365);
assert.equal(png.readUInt32BE(20), 547);
assert.equal(prun.asset.aspect, 365 / 547);
assert.equal(prun.moduleSize, 0.4, "Preserve existing metric U repeat");
const requests = [];
const original = TextureLoader.prototype.load;
TextureLoader.prototype.load = function(url) { requests.push(url); return new Texture(); };
try {
  const maps = loadCopingTextureMaps(prun.asset.dir, false, false, true);
  assert.deepEqual(requests, ["/textures/coping/prun/basecolor.png"]);
  assert.equal(maps.colorMap.colorSpace, SRGBColorSpace);
  assert.equal(maps.colorMap.wrapS, MirroredRepeatWrapping);
  assert.equal(maps.colorMap.wrapT, MirroredRepeatWrapping);
  assert.equal(maps.roughnessMap, null);
  assert.deepEqual([...maps.normalMap.image.data], [128, 128, 255, 255]);
  Object.values(maps).forEach(map => map?.dispose());
} finally {
  TextureLoader.prototype.load = original;
}
console.log("PASS: Prun photo identity, neutral tint, aspect, metric repeat, seamless wrapping and absent-map handling");
