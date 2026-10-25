import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import * as THREE from "three";
const cache = resolve("node_modules/.cache/brown-cover-audit");
await build({ input: ["src/components/pool/three/poolConstruction.ts", "src/components/pool/three/AutomaticCover.tsx", "src/components/pool/three/deckCopingGrain.ts"], output: { dir: cache, format: "esm" }, platform: "node", resolve: { alias: { "@": resolve("src") } }, external: ["react", "react/jsx-runtime", "three", "three/addons/utils/BufferGeometryUtils.js", "@react-three/fiber"] });
const { createCopingSlabGeometry } = await import(pathToFileURL(`${cache}/poolConstruction.js`));
const { automaticCoverRimTop } = await import(pathToFileURL(`${cache}/AutomaticCover.js`));
const { deckGrainUV, DECK_GRAIN_ORIGIN, DECK_GRAIN_EXTENT, configureDeckCopingGrain } = await import(pathToFileURL(`${cache}/deckCopingGrain.js`));
// Updated for the requested 24 October photographic rounded nose. The independent
// coping-soft-edges audit checks bounds, datums and slab counts numerically.
const baseline = ["9a6dd94ce81bb2d34f91324f12d6eb90a3c499e7d4dcb9d862c24ec1afee15c6", "834937f3f4598d7729638ba802e04a6acc1602a309a353782b458e88cb3c747c", "bc14234b0d8785c553166d3df33832b7809286a9734dd7310aa1e0334ef08028"];
let cases = 0, rays = 0;
for (const [index, [length, width]] of [[6, 3], [8, 4], [12, 5]].entries()) {
  const inner = [[-length / 2, -width / 2], [length / 2, -width / 2], [length / 2, width / 2], [-length / 2, width / 2]];
  const outer = [[-length / 2 - .33, -width / 2 - .33], [length / 2 + .33, -width / 2 - .33], [length / 2 + .33, width / 2 + .33], [-length / 2 - .33, width / 2 + .33]];
  const originalMode = createCopingSlabGeometry(inner, outer, .055);
  const hash = createHash("sha256");
  for (const name of ["position", "normal", "uv", "color", "slabFrame"]) { const a = originalMode.getAttribute(name).array; hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
  assert.equal(hash.digest("hex"), baseline[index], "other coping finishes changed");
  originalMode.computeBoundingBox();
  for (const excluded of [null, 1]) {
    const geometry = createCopingSlabGeometry(inner, outer, .055, excluded, true);
    geometry.computeBoundingBox();
    const frames = geometry.getAttribute("slabFrame"), parts = new Set();
    for (let i = 0; i < frames.count; i++) parts.add([frames.getX(i), frames.getY(i), frames.getZ(i), frames.getW(i)].join(","));
    assert.equal(parts.size, excluded === null ? 4 : 3, "not one element per built side");
    if (excluded === null) for (const axis of ["x", "y", "z"]) {
      assert.ok(Math.abs(geometry.boundingBox.min[axis] - originalMode.boundingBox.min[axis]) < 1e-6, `min ${axis}: ${geometry.boundingBox.min[axis]} vs ${originalMode.boundingBox.min[axis]}`);
      assert.ok(Math.abs(geometry.boundingBox.max[axis] - originalMode.boundingBox.max[axis]) < 1e-6, `max ${axis}: ${geometry.boundingBox.max[axis]} vs ${originalMode.boundingBox.max[axis]}`);
    }
    const rim = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); rim.name = "plan-coping";
    const scene = new THREE.Scene(); scene.add(rim); rim.position.y = .055; scene.updateMatrixWorld(true);
    const top = automaticCoverRimTop(scene); assert.ok(Math.abs(top - .055) < 1e-6);
    for (let side = 0; side < 4; side++) {
      if (side === excluded) continue;
      const a = inner[side], b = inner[(side + 1) % 4], dx = b[0] - a[0], dz = b[1] - a[1], span = Math.hypot(dx, dz);
      for (let t = .113; t < .99; t += .097) {
        const ray = new THREE.Raycaster(new THREE.Vector3(a[0] + dx * t + dz / span * .15, 1, a[1] + dz * t - dx / span * .15), new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObject(rim); assert.ok(hits.length >= 2, "open coping solid or unwanted straight-side gap");
        assert.ok(Math.abs(hits[0].point.y - top) < 1e-6); rays++;
      }
    }
    // Different world elevations and the actual grille fallback share the same datum.
    for (const y of [.008, .018, 1.455]) { rim.position.y = y; scene.updateMatrixWorld(true); assert.ok(Math.abs(automaticCoverRimTop(scene) - y) < 1e-6); }
    rim.name = "overflow-grille"; assert.ok(automaticCoverRimTop(scene) !== null);
    scene.remove(rim); assert.equal(automaticCoverRimTop(scene), null);
    geometry.dispose(); rim.material.dispose(); cases++;
  }
  originalMode.dispose();
}
for (let i = -5000; i <= 5000; i++) {
  const uv = [i * .001013, i * .002107], mapped = deckGrainUV(uv);
  for (let axis = 0; axis < 2; axis++) {
    assert.ok(mapped[axis] >= DECK_GRAIN_ORIGIN[axis] - 1e-12 && mapped[axis] <= DECK_GRAIN_ORIGIN[axis] + DECK_GRAIN_EXTENT[axis] + 1e-12);
    const shifted = [...uv]; shifted[axis] += 1e-8;
    assert.ok(Math.abs(Math.abs((deckGrainUV(shifted)[axis] - mapped[axis]) / 1e-8) - 1) < .001, "grain texture stretched");
  }
}
const shader = { fragmentShader: "#include <common>\n" + ["stoneColorMap", "normalMap", "roughnessMap"].flatMap(map => ["zy", "xz", "xy"].map(axes => `texture2D(${map}, vTriWorldPosition.${axes} * TRI_UV_SCALE);`)).join("\n") + "\ntriTangentX.xy *= normalScale;" };
configureDeckCopingGrain(shader);
assert.equal((shader.fragmentShader.match(/deckGrainUV\(/g) ?? []).length, 10, "PBR maps not sampling identical grain window");
assert.ok(shader.fragmentShader.includes("triTangentY.xy *= deckGrainSigns"));
console.log(`PASS ${cases} continuous/excluded-side solids, ${rays} thickness/closure rays, 3 byte-identical other-finish baselines, 10001 metric PBR samples and real rim/grille world elevations.`);
