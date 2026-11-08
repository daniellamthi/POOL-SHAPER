import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";
const source = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
const ast = ts.createSourceFile(
  "PoolScene.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let expression;
function visit(n) {
  if (ts.isVariableDeclaration(n) && n.name.getText(ast) === "shadowFar")
    expression = n.initializer.getText(ast);
  ts.forEachChild(n, visit);
}
visit(ast);
assert(expression);
const far = runInNewContext(
  `(photographicGarden,radius,sunPosition,shadowExtent)=>(${expression})`,
);
assert.match(source, /shadow-camera-far=\{shadowFar\}/);
const effect = source.match(
  /useLayoutEffect\(\(\) => \{\s*if \(!sunLight.current\) return;[\s\S]*?\}, \[shadowRevision, assetsLoading, shadowFar, shadowExtent\]\);/,
)?.[0];
assert(effect);
assert(
  effect.indexOf("camera.updateProjectionMatrix()") < effect.indexOf("shadow.needsUpdate = true"),
);
assert.doesNotMatch(
  effect,
  /sceneTime|dusk|photoMode/,
  "no Day/Night/Photo Mode depth-map rebuild dependency",
);
const load = (path) =>
  runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText + ";exports;",
    { exports: {} },
  );
const { planCatalogueArchitecture: plan } = load("src/lib/pool/catalogue-architecture.ts");
const { CATALOGUE_GARDEN: garden } = load("src/lib/pool/catalogue-garden.ts");
function lightAt(position, extent, depth) {
  const light = new THREE.DirectionalLight();
  light.position.set(...position);
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  Object.assign(light.shadow.camera, {
    left: -extent,
    right: extent,
    top: extent,
    bottom: -extent,
    near: 0.5,
    far: depth,
  });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.updateMatrices(light);
  return light;
}
let cases = 0,
  receivers = 0,
  casters = 0;
for (const [l, w] of [
  [3, 2],
  [10, 4.5],
  [25, 8],
])
  for (const rotate of [false, true])
    for (const ground of [0, 1.2]) {
      const outline = [
        [-l / 2, -w / 2],
        [l / 2, -w / 2],
        [l / 2, w / 2],
        [-l / 2, w / 2],
      ].map(([x, z]) => (rotate ? [z, x] : [x, z]));
      const p = plan(outline, "residence", 0.35, ground),
        r = Math.hypot(l, w) / 2,
        extent = Math.max(l, w) / 2 + 12;
      const c = Math.cos(p.angle),
        s = Math.sin(p.angle);
      const sun = [
        c * garden.sun[0] * 50 + s * garden.sun[2] * 50,
        garden.sun[1] * 50,
        -s * garden.sun[0] * 50 + c * garden.sun[2] * 50,
      ];
      const depth = far(true, r, sun, extent),
        light = lightAt(sun, extent, depth);
      for (const [x, z] of outline) {
        const q = new THREE.Vector3(x, ground, z).project(light.shadow.camera);
        assert(q.z > -1 && q.z < 1, "pool receiver within depth range");
        assert(Math.abs(q.x) < 1 && Math.abs(q.y) < 1);
        receivers++;
      }
      for (const part of p.parts)
        for (const dx of [-0.5, 0.5])
          for (const dy of [-0.5, 0.5])
            for (const dz of [-0.5, 0.5]) {
              const u = part.p[0] + dx * part.s[0],
                v = part.p[2] + dz * part.s[2];
              const q = new THREE.Vector3(
                c * u + s * v,
                part.p[1] + dy * part.s[1],
                -s * u + c * v,
              ).project(light.shadow.camera);
              assert(q.z > -1 && q.z < 1, "building caster depth retained");
              casters++;
            }
      light.dispose();
      cases++;
    }
for (const radius of [1, 2, 5.482928049865327, 13, 50])
  assert.equal(
    far(false, radius, [50, 50, 50], 50),
    Math.max(36, radius * 7),
    "original depth unchanged outside photographic garden",
  );
const radius = Math.hypot(10, 4.5) / 2,
  extent = 17,
  position = garden.sun.map((v) => v * 50),
  oldFar = Math.max(36, radius * 7),
  newFar = far(true, radius, position, extent);
const light = lightAt(position, extent, oldFar),
  point = new THREE.Vector3();
const oldZ = point.clone().project(light.shadow.camera).z;
assert(oldZ > 1, "reproduces previous missing receiver");
light.shadow.camera.far = newFar;
assert.equal(
  point.clone().project(light.shadow.camera).z,
  oldZ,
  "changing the property alone leaves stale projection",
);
light.shadow.camera.updateProjectionMatrix();
const newZ = point.clone().project(light.shadow.camera).z;
assert(newZ > -1 && newZ < 1);
light.shadow.autoUpdate = false;
light.shadow.needsUpdate = false;
// Execute actual effect with a populated ref, then the no-ref Canvas-mount path.
const body = effect.slice(effect.indexOf("{") + 1, effect.lastIndexOf("}, ["));
const execute = new Function("sunLight", body);
execute({ current: light });
assert(light.shadow.needsUpdate);
execute({ current: null });
light.dispose();
console.log(
  JSON.stringify({
    status: "PASS",
    cases,
    receivers,
    buildingCornerDepthChecks: casters,
    reproduction: { oldFar, newFar, oldNdcZ: oldZ, newNdcZ: newZ },
    scope:
      "actual Three.js projection, declared source expression and camera-sync effect; raster visual check separate",
  }),
);
