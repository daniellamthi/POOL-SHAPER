import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { build } from "rolldown";
import { Texture, TextureLoader, RepeatWrapping, SRGBColorSpace } from "three";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

await build({
  input: ["src/lib/pool/coping-materials.ts", "src/components/pool/three/stoneTextures.ts"],
  output: { dir: resolve("node_modules/.cache/prun-audit"), format: "esm" },
  platform: "node",
  external: ["three"],
});
const { COPING_MATERIALS } = await import(pathToFileURL(resolve("node_modules/.cache/prun-audit/coping-materials.js")));
const { loadCopingTextureMaps, legacyMineralTextureScale, legacyMineralTextureUrl } = await import(pathToFileURL(resolve("node_modules/.cache/prun-audit/stoneTextures.js")));
const prun = COPING_MATERIALS.find(m => m.id === "prun");
assert.equal(prun.color, "#ffffff", "Real photo must not receive the old grey tint");
assert.equal(prun.asset.normalMap, false);
assert.equal(prun.asset.roughnessMap, false);
const png = readFileSync("public/textures/coping/prun/basecolor.png");
assert.equal(createHash("sha256").update(png).digest("hex"), "2de4ca932f1d015e09e764849a5d4533278b4eb265f83ab3bdffce23a0e8367f", "Original owner photograph remains unchanged");
assert.equal(png.readUInt32BE(16), 365);
assert.equal(png.readUInt32BE(20), 547);
assert.equal(prun.asset.aspect, 365 / 547);
assert.equal(prun.moduleSize, 0.4, "Preserve existing metric U repeat");
const atlas = readFileSync(`public${legacyMineralTextureUrl(prun.asset.dir, "basecolor")}`);
assert.equal(atlas.readUInt32BE(16), 730);
assert.equal(atlas.readUInt32BE(20), 1094);
assert.equal(legacyMineralTextureScale(prun.id), .5, "Twice the texture dimensions/coverage retain original grain density at half UV repeat");
const requests = [];
const original = TextureLoader.prototype.load;
TextureLoader.prototype.load = function(url) { requests.push(url); return new Texture(); };
try {
  const maps = loadCopingTextureMaps(prun.asset.dir, false, false, true);
  assert.deepEqual(requests, ["/textures/coping/derived-mineral-v3/prun-basecolor.png"]);
  assert.equal(maps.colorMap.colorSpace, SRGBColorSpace);
  assert.equal(maps.colorMap.wrapS, RepeatWrapping);
  assert.equal(maps.colorMap.wrapT, RepeatWrapping);
  assert.equal(maps.roughnessMap, null);
  assert.deepEqual([...maps.normalMap.image.data], [128, 128, 255, 255]);
  Object.values(maps).forEach(map => map?.dispose());
} finally {
  TextureLoader.prototype.load = original;
}
console.log("PASS: original Prun SHA/dimensions, neutral tint, aspect, periodic source-derived atlas at unchanged grain density, non-mirrored wrapping and absent-map handling");
