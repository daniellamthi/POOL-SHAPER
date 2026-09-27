import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LINER_COLORS, SKIMMER_FINISHES, SKIMMER_TYPES } from "../src/lib/pool/config";
import { resolveMaterials } from "../src/lib/pool/materials";
import { MOSAIC_FINISHES } from "../src/configurator/materials/interior-textures";

for (const liner of LINER_COLORS) {
  const material = resolveMaterials({
    finish: "liner", linerColor: liner.id,
    mosaicFinish: MOSAIC_FINISHES[0]!.id,
    skimmerFinish: SKIMMER_FINISHES[0]!.id,
    skimmerType: SKIMMER_TYPES[0]!.id, copingMaterial: "travertine",
  });
  assert.equal(material.surface.kind, "liner");
  assert.equal(material.surface.textureUrl, liner.texture);
  assert.equal(material.surface.tileSize, material.surface.textureMetadata.physicalWidth);
  assert.equal(material.surface.tileSize, material.surface.textureMetadata.physicalHeight);
  assert.equal(material.floor.roughness, material.liner.roughness);
  assert.deepEqual(material.surface.underwaterAbsorption, liner.underwater.absorption);
  assert.equal(material.surface.calibrateSample, liner.id === "motionSandBeach179");
  if (material.surface.calibrateSample) {
    assert.equal(material.liner.metalness, 0);
    assert.equal(material.liner.roughness, 0.5);
  }
}
const pool = readFileSync("src/components/pool/three/PoolModel.tsx", "utf8");
assert.match(pool, /derivedSurfaceDetail && materials\.surface\.kind === "liner"\s*\? materials\.surface\.tileSize/,
  "PVC colour and derived relief must share the same metric module");
assert.match(pool, /materials\.surface\.kind === "liner" \? depth \/ materials\.surface\.tileSize/,
  "a shallow wall must not stretch one full colour tile while its relief uses a partial tile");
assert.match(pool, /calibratedSurfaceMap !== sourceSurfaceMap\) calibratedSurfaceMap\.dispose\(\)/,
  "owned calibrated sample must be disposed without disposing the source twice");
assert.match(pool, /roughnessMap=\{materials\.surface\.kind === "liner" \? interiorMicroMaps\.floorRoughness : null\}/,
  "PVC stairs must share the floor roughness map");
console.log("PASS: 6 liner material contracts + 4 mapping/lifecycle source checks");
