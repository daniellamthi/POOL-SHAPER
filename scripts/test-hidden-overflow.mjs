import assert from "node:assert/strict";
import { build } from "rolldown";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import * as THREE from "three";

const directory = resolve("node_modules/.cache/hidden-overflow-test");
await build({
  input: ["src/components/pool/three/poolConstruction.ts", "src/lib/pool/geometry.ts", "src/lib/pool/config.ts", "src/lib/pool/vertical-layout.ts"],
  output: { dir: directory, format: "esm" },
  platform: "node",
  resolve: { alias: { "@": resolve("src") } },
  external: ["three", "three/addons/utils/BufferGeometryUtils.js"],
});
const load = (name) => import(pathToFileURL(`${directory}/${name}.js`).href);
const { concealedOverflowSection, createCopingSlabGeometry, copingOuterOffset } = await load("poolConstruction");
const { buildOutline, buildWaterOutline, offsetOutline, outlineArea } = await load("geometry");
const { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS, OVERFLOW_GEOMETRY } = await load("config");
const { getPoolVerticalLayout } = await load("vertical-layout");
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const ray = new THREE.Raycaster();
let cases = 0;
let perimeterSamples = 0;

for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) {
  for (const shape of ["rectangle", "l-shape", "organic"]) {
    // L-shape's real minimum width is 4 m; do not test a silently clamped 6x3.
    if (shape === "l-shape" && width < 4) continue;
    const outline = buildOutline(shape, { ...DEFAULT_DIMENSIONS, length, width }, DEFAULT_CONTROL_POINTS);
    const lip = offsetOutline(outline, OVERFLOW_GEOMETRY.waterEdgeOffset);
    const water = buildWaterOutline(outline, "overflow", "hidden");
    for (const poolType of ["in-ground", "above-ground"]) {
      for (const copingThickness of [0.03, 0.06, 0.08]) {
        const vertical = getPoolVerticalLayout({ poolType, system: "overflow", overflowType: "hidden", depth: 1.5, copingThickness });
        const section = concealedOverflowSection(vertical.wallTopY, copingThickness);
        assert.equal(section.slotWidth, 0.015);
        assert(Math.abs(section.copingInnerOffset - OVERFLOW_GEOMETRY.waterEdgeOffset - section.slotWidth) < 1e-9);
        assert(section.copingInnerOffset < section.channelOuterOffset, "collector continues under stone");
        assert(section.copingTopY > vertical.waterY && section.copingTopY - vertical.waterY < 0.01, "water remains near the coping");
        assert(section.copingBottomY > section.channelFloorY, "open collector below the roof");
        const inner = offsetOutline(outline, section.copingInnerOffset);
        const collector = offsetOutline(outline, section.channelOuterOffset);
        assert(outlineArea(water) > outlineArea(inner), "water reaches the entire intake and continues under its roof");
        assert(outlineArea(water) < outlineArea(collector), "water does not escape the collector");
        const geometry = createCopingSlabGeometry(inner, offsetOutline(outline, copingOuterOffset("overflow", "hidden")), copingThickness);
        geometry.computeBoundingBox();
        assert(Math.abs(geometry.boundingBox.min.y + section.copingTopY - section.copingBottomY) < 1e-6, "outer collector wall meets the actual roof underside");
        assert(geometry.getAttribute("position").array.every(Number.isFinite));
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = section.copingTopY;
        mesh.updateMatrixWorld(true);
        for (let edge = 0; edge < outline.length; edge++) {
          const next = (edge + 1) % outline.length;
          const at = (ring) => ring[edge].map((value, axis) => THREE.MathUtils.lerp(value, ring[next][axis], 0.413));
          const a = at(lip), b = at(inner), c = at(collector);
          const sample = (from, to) => new THREE.Vector3((from[0] + to[0]) / 2, section.copingTopY + 0.2, (from[1] + to[1]) / 2);
          ray.set(sample(a, b), new THREE.Vector3(0, -1, 0));
          assert.equal(ray.intersectObject(mesh).length, 0, `${shape}: intake stays physically open on edge ${edge}`);
          ray.set(sample(b, c), new THREE.Vector3(0, -1, 0));
          assert(ray.intersectObject(mesh).length > 0, `${shape}: solid coping conceals the collector on edge ${edge}`);
          perimeterSamples++;
        }
        geometry.dispose();
        cases++;
      }
    }
  }
}
material.dispose();
const source = readFileSync("src/components/pool/three/PoolModel.tsx", "utf8");
assert(source.includes('if (system !== "skimmer") return [];'), "overflow never receives skimmer openings");
assert(source.includes('isVisibleOverflow\n        ? createGrateGeometry'), "grille is exclusive to visible overflow");
assert(source.includes("offsetOutline(outline, hiddenSection.copingInnerOffset)"));
assert(source.includes("isVisibleOverflow ? waterLevel - 0.001 : hiddenSection.copingTopY"));
assert(source.includes("overflowSlotEdge,\n        hiddenSection.copingBottomY,"));
console.log(`PASS: ${cases} hidden-overflow cases; ${perimeterSamples} open-intake/solid-roof perimeter samples; water, roof connection and skimmer/grille guards.`);
