import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";
const load = (path, require) =>
  runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText + ";exports;",
    { exports: {}, require },
  );
const { skipInactiveSpotLighting } = load(
  "src/components/pool/three/spotLightWork.ts",
  () => THREE,
);
const mask = load("src/components/pool/three/exteriorLightMask.ts", (id) =>
  id === "three" ? THREE : { skipInactiveSpotLighting },
);
const { createCatalogueGlassMaterial: create } = load(
  "src/components/pool/three/catalogueGlassMaterial.ts",
  (id) => (id === "three" ? THREE : mask),
);
const { createCatalogueRoomProxy: proxy } = load(
  "src/components/pool/three/catalogueRoomProxy.ts",
  () => THREE,
);
for (const waterY of [-1.2, 0, 1.2]) {
  const m = create(waterY);
  assert(m instanceof THREE.MeshPhysicalMaterial);
  assert.equal(m.transmission, 1);
  assert.equal(m.opacity, 1);
  assert.equal(m.transparent, false);
  assert.equal(m.depthWrite, true);
  assert.equal(m.thickness, 0);
  assert.equal(m.ior, 1.5);
  assert.equal(m.blending, THREE.NormalBlending);
  // The renderer modes share clear glazing; the previous IOR/transmission/tint remain.
  assert.equal(m.color.getHexString(), "edf3ee");
  assert.equal(m.roughness, 0.02);
  assert.equal(m.side, THREE.DoubleSide);
  const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  m.onBeforeCompile(shader);
  assert.equal(shader.uniforms.exteriorWaterY.value, waterY);
  assert.match(shader.fragmentShader, /rectAreaLight.position/);
  assert.doesNotMatch(
    shader.fragmentShader,
    /catalogueGlassCosine|diffuseColor.rgb = vec3\(0.0\)/,
    "no custom alpha or gamma-space reflection approximation",
  );
  const root = new THREE.Group(),
    geometry = new THREE.BoxGeometry(1, 2, 0.024);
  root.add(new THREE.Mesh(geometry, m));
  const capture = proxy(root, 0),
    cloned = capture.scene.children[0].children[0].material;
  assert.equal(cloned.transmission, 0);
  assert.equal(cloned.opacity, 0.18);
  assert.equal(cloned.transparent, true);
  assert.equal(cloned.depthWrite, false);
  capture.dispose();
  assert.equal(m.transmission, 1, "room capture never mutates live/traced material");
  assert.equal(m.opacity, 1);
  geometry.dispose();
  m.dispose();
}
// Physical sheen does not make opaque catalogue upholstery into glazing.
const textile = new THREE.MeshPhysicalMaterial({ color: "#f5efe3", sheen: 0.6, roughness: 0.94 });
const textileGeometry = new THREE.BoxGeometry(0.77, 0.14, 1.25), textileRoom = new THREE.Group();
textileRoom.add(new THREE.Mesh(textileGeometry, textile));
const textileProxy = proxy(textileRoom, 0), textileClone = textileProxy.scene.children[0].children[0].material;
assert.equal(textileClone.transmission, 0);
assert.equal(textileClone.opacity, 1);
assert.equal(textileClone.transparent, false);
assert.equal(textileClone.depthWrite, true);
assert.equal(textileClone.sheen, 0.6);
textileProxy.dispose();
assert.equal(textile.opacity, 1);assert.equal(textile.transparent, false);
textileGeometry.dispose();textile.dispose();
const architecture = readFileSync("src/components/pool/three/CatalogueArchitecture.tsx", "utf8");
assert.match(architecture, /glass: createCatalogueGlassMaterial\(waterY\)/);

console.log(
  JSON.stringify({
    status: "PASS",
    waterElevations: 3,
    physicalTransmission: 1,
    sharedOpticalModel: true,
    roomCapturePolicyPreserved: true,
    opaqueTextileCapturePreserved: true,
    customAlphaShader: false,
    limits:
      "Material/integration regression; actual transmission rendering and cost verified separately in the browser.",
  }),
);
