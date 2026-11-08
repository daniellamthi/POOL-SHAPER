import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const root = new URL("../", import.meta.url);
function load(path, require = () => ({})) {
  return runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText + ";exports;",
    { exports: {}, require },
  );
}
const { planCatalogueArchitecture: plan } = load("src/lib/pool/catalogue-architecture.ts");
const { createCataloguePlantBatches: batch } = load(
  "src/components/pool/three/cataloguePlantGeometry.ts",
  (id) => (id === "three" ? THREE : { mergeGeometries }),
);
const bytes = readFileSync(new URL("public/models/catalogue/evergreen.glb", root));
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  "9767942d1213b1304d3e2f74026126b61b446f214b2bbfe88ac289940204c447",
);
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
for (const [name, md5] of Object.entries({
  "alpha.png": "dd64ebe2b0c5cabf6b8eb2e11df1c4a0",
  "searsia_lucida_diff_1k.jpg": "d41a7089a41122ddc4edc96288105ecd",
  "searsia_lucida_nor_gl_1k.jpg": "a1e95f7d4cb702b8c6ddfedaafbadcc5",
  "searsia_lucida_arm_1k.jpg": "979fb34427cc5b5580ce89feaff65ef9",
}))
  assert.equal(
    createHash("md5")
      .update(readFileSync(new URL("public/textures/catalogue/evergreen/" + name, root)))
      .digest("hex"),
    md5,
    "original scan bytes",
  );

assert.deepEqual(
  json.nodes.map((n) => n.name),
  ["tree", "shrub"],
);
assert.equal(json.materials.length, 3);
assert.equal(
  json.accessors.filter((a) => a.type === "SCALAR").reduce((sum, a) => sum + a.count / 3, 0),
  94931,
);
for (const im of json.images) {
  const path = new URL(im.uri, new URL("public/models/catalogue/", root));
  assert(readFileSync(path).length > 0, "all glTF images resolve relative to model");
}
// Decode actual embedded geometry with GLTFLoader; only image decoding is stubbed.
// GPU/browser checks separately verify pixels, alpha, lighting and shadows.
globalThis.self = globalThis;
const manager = new THREE.LoadingManager();
manager.addHandler(/\.(jpg|png)$/, {
  load(url, onLoad) {
    const texture = new THREE.Texture();
    texture.userData.uri = url;
    queueMicrotask(() => onLoad(texture));
    return texture;
  },
});
const asset = await new GLTFLoader(manager).parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
let cases = 0,
  maxTriangles = 0;
const sourceCounts = [];
asset.scene.traverse((o) => {
  if (o.isMesh) sourceCounts.push(o.geometry.attributes.position.array.slice());
});
for (const setting of ["spa-wall", "spa-glass", "residence", "infinity-villa"])
  for (const ground of [0, 1.2]) {
    const p = plan(
      [
        [-5, -2.25],
        [5, -2.25],
        [5, 2.25],
        [-5, 2.25],
      ],
      setting,
      0.35,
      ground,
    );
    const start = performance.now(),
      batches = batch(asset.scene, p);
    assert.equal(batches.length, 3);
    let triangles = 0,
      bounds = new THREE.Box3();
    for (const b of batches) {
      assert(b.geometry.index);
      triangles += b.geometry.index.count / 3;
      bounds.union(b.geometry.boundingBox);
      for (const name of ["position", "normal", "uv"])
        assert(b.geometry.attributes[name].array.every(Number.isFinite));
      assert(b.material.map && b.material.normalMap && b.material.roughnessMap);
      if (b.material.transparent) assert(/leaves|twigs/.test(b.material.name));
    }
    assert(Math.abs(bounds.min.y - ground) < 0.0001, "plant bases rest on the scene ground");
    const top = ground + 4 * Math.max(...p.trees.map((t) => t[2]));
    assert(
      Math.abs(bounds.max.y - top) < 0.0001,
      "human sized canopy independent of pool dimensions",
    );
    assert.equal(triangles, p.trees.length * 88629 + p.shrubs.length * 6302);
    maxTriangles = Math.max(maxTriangles, triangles);
    console.log(
      JSON.stringify({
        setting,
        ground,
        triangles,
        batches: batches.length,
        prepareMs: +(performance.now() - start).toFixed(1),
      }),
    );
    batches.forEach((b) => b.geometry.dispose());
    cases++;
  }
let i = 0;
asset.scene.traverse((o) => {
  if (o.isMesh) {
    assert.deepEqual(o.geometry.attributes.position.array, sourceCounts[i++]);
  }
});
const component = readFileSync(
  new URL("src/components/pool/three/CataloguePlants.tsx", root),
  "utf8",
);
assert.match(component, /alpha\.flipY = false/);
assert.match(component, /material\.alphaTest = 0\.5/);
assert.match(component, /material\.transparent = false/);
assert.match(component, /geometry\.dispose\(\)/);
assert.match(component, /resources\.alphas\.forEach\(\(alpha\) => alpha\.dispose\(\)\)/);
assert.doesNotMatch(component, /\.map\?\.dispose|sourceAlpha\.dispose|asset\.scene\.dispose/);
console.log(
  `PASS: ${cases} catalogue placements, max ${maxTriangles} triangles, three material batches, metric ground/height, finite geometry, source resources preserved; image decode/GPU/performance acceptance separate`,
);
