import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "rolldown";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

await build({
  input: ["src/configurator/materials/interior-textures.ts", "src/lib/pool/materials.ts"],
  output: { dir: resolve("node_modules/.cache/mosaic-audit"), format: "esm" },
  platform: "node",
  resolve: { alias: { "@": resolve("src") } },
});
const { MOSAIC_FINISHES } = await import(pathToFileURL(resolve("node_modules/.cache/mosaic-audit/interior-textures.js")));
const { resolveMaterials } = await import(pathToFileURL(resolve("node_modules/.cache/mosaic-audit/materials.js")));
assert.equal(MOSAIC_FINISHES.length, 9);
for (const finish of MOSAIC_FINISHES) {
  const cells = finish.id.includes("dd99152f") ? 9 : 8;
  assert.equal(finish.tileSize / cells, 0.025, "consistent nominal tessera pitch");
  assert.equal(finish.textureMetadata.physicalWidth, finish.tileSize);
  assert.equal(finish.textureMetadata.physicalHeight, finish.tileSize);
  assert.equal(finish.texture, finish.maps.baseColorMap, "original catalog image retained");
  const png = readFileSync(`public${decodeURIComponent(finish.texture)}`);
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), "square photograph, no aspect stretch");
  const materials = resolveMaterials({ finish: "mosaic", mosaicFinish: finish.id,
    linerColor: "motionArcticWhite180", copingMaterial: "limestone", skimmerType: "standard", skimmerFinish: "white" });
  assert.equal(materials.surface.tileSize, finish.tileSize);
  assert.equal(materials.surface.maps.baseColorMap, finish.texture);
  assert.equal(materials.floor.color, "#ffffff");
  assert.equal(materials.liner.color, "#ffffff", "no tint over the source photo");
  assert.equal(materials.floor.roughness, materials.liner.roughness);
  assert.equal(materials.surface.wallClearcoat, materials.surface.floorClearcoat);
  assert(materials.floor.roughness >= 0.25 && materials.floor.roughness <= 0.4);
  assert.equal(materials.liner.metalness, 0);
  for (const dimension of [0.2, 0.45, 1.5, 3, 4, 5, 6, 8, 12]) {
    const tesserae = dimension / materials.surface.tileSize * cells;
    assert(Math.abs(tesserae - dimension / 0.025) < 1e-9, "resize does not rescale tesserae");
  }
}
// Wiring guard: photo detail shares the colour repeat; all four basin
// materials receive the same mosaic response, without changing PVC props.
const source = readFileSync("src/components/pool/three/PoolModel.tsx", "utf8");
assert.match(source, /const moduleSize = derivedSurfaceDetail\s*\? materials.surface.tileSize/);
assert.equal((source.match(/\.\.\.mosaicResponse/g) ?? []).length, 4);
assert.match(source, /const mosaicResponse = materials.surface.kind === "mosaic" \?/);
assert(!source.includes('materials.surface.kind === "liner" ? interiorMicroMaps.floorRoughness : null'));
assert(!source.includes('materials.surface.kind === "liner" ? interiorMicroMaps.floorAo : null'));
console.log("PASS: all 9 original mosaics, 8/9-cell calibration, 81 metric resize cases, neutral albedo, uniform PBR and photo-map wiring");
