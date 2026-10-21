import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as THREE from "three";
import { HorizontalBlurShader, VerticalBlurShader } from "three-stdlib";

const path = "src/components/pool/three/OwnedContactShadows.tsx";
const source = readFileSync(path, "utf8");
const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const upstream = readFileSync("node_modules/@react-three/drei/core/ContactShadows.js", "utf8");
const upstreamTree = ts.createSourceFile(
  "ContactShadows.js",
  upstream,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
function find(root, predicate) {
  let match;
  function visit(node) {
    if (!match && predicate(node)) match = node;
    if (!match) ts.forEachChild(node, visit);
  }
  visit(root);
  assert(match, "required actual implementation node exists");
  return match;
}
function actualFunction(name) {
  return find(tree, (node) => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(
    tree,
  );
}
const upstreamMemo = find(
  upstreamTree,
  (node) => ts.isCallExpression(node) && node.expression.getText(upstreamTree) === "React.useMemo",
);
const javascript = ts.transpileModule(
  `${actualFunction("createContactShadowResources")}\n${actualFunction("releaseContactShadowResources")}\n({ createContactShadowResources, releaseContactShadowResources });`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const context = { THREE, HorizontalBlurShader, VerticalBlurShader };
const owned = vm.runInNewContext(javascript, context);
const baseline = vm.runInNewContext(
  `(resolution,width,height,color) => (${upstreamMemo.arguments[0].getText(upstreamTree)})()`,
  context,
);
let checks = 0;
function equal(a, b, message) {
  assert.deepEqual(a, b, message);
  checks++;
}
for (const [resolution, width, height, color] of [
  [512, 18, 18, "#000000"],
  [1536, 40, 40, "#121820"],
  [2048, 64, 64, "#444444"],
]) {
  const before = baseline(resolution, width, height, color);
  const after = owned.createContactShadowResources(resolution, width, height, color);
  equal(after.length, before.length, "same resource tuple");
  equal(after[3].geometry, after[1], "blur and display share exactly one plane");
  for (const key of Object.keys(before[1].attributes))
    equal(
      [...after[1].attributes[key].array],
      [...before[1].attributes[key].array],
      `exact plane ${key}`,
    );
  equal([...after[1].index.array], [...before[1].index.array], "exact plane indices");
  for (const i of [0, 6])
    equal(
      [
        after[i].width,
        after[i].height,
        after[i].texture.generateMipmaps,
        after[i].depthBuffer,
        after[i].texture.type,
        after[i].texture.format,
      ],
      [
        before[i].width,
        before[i].height,
        before[i].texture.generateMipmaps,
        before[i].depthBuffer,
        before[i].texture.type,
        before[i].texture.format,
      ],
      "unchanged render target quality",
    );
  for (const i of [2, 4, 5])
    equal(
      [after[i].depthTest, after[i].depthWrite],
      [before[i].depthTest, before[i].depthWrite],
      "same depth flags",
    );
  for (const i of [4, 5])
    equal(
      [after[i].vertexShader, after[i].fragmentShader, Object.keys(after[i].uniforms)],
      [before[i].vertexShader, before[i].fragmentShader, Object.keys(before[i].uniforms)],
      "exact blur shaders",
    );
  const oldShader = { uniforms: {}, fragmentShader: THREE.ShaderLib.depth.fragmentShader };
  const newShader = { uniforms: {}, fragmentShader: THREE.ShaderLib.depth.fragmentShader };
  before[2].onBeforeCompile(oldShader);
  after[2].onBeforeCompile(newShader);
  equal(newShader.fragmentShader, oldShader.fragmentShader, "exact patched depth shader");
  equal(
    newShader.uniforms.ucolor.value.getHexString(),
    oldShader.uniforms.ucolor.value.getHexString(),
    "same shadow color",
  );
  const disposals = new Map();
  for (const i of [0, 1, 2, 4, 5, 6])
    after[i].addEventListener("dispose", () => disposals.set(i, (disposals.get(i) ?? 0) + 1));
  owned.releaseContactShadowResources(after);
  equal(
    [...disposals.keys()].sort(),
    [0, 1, 2, 4, 5, 6],
    "both full targets, shared plane and three materials released",
  );
  equal([...disposals.values()], [1, 1, 1, 1, 1, 1], "each owned resource disposed exactly once");
  owned.releaseContactShadowResources(before);
}
const effect = find(
  tree,
  (node) => ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect",
);
equal(
  effect.arguments[0].getText(tree).replace(/\s/g, ""),
  "()=>()=>releaseContactShadowResources(resources)",
  "actual cleanup runs on replacement/unmount",
);
equal(
  effect.arguments[1].getText(tree),
  "[resources]",
  "cleanup follows the actual memo-owned set",
);
const scene = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
equal(
  scene.includes("OwnedContactShadows as ContactShadows"),
  true,
  "actual scene uses the owned lifecycle",
);
equal(
  source.includes("Copyright (c) 2020 react-spring"),
  true,
  "upstream MIT attribution retained",
);
console.log(
  JSON.stringify({
    status: "PASS",
    checks,
    scope:
      "Actual installed resource/shader parity and disposal events; GPU counts and visual QA required separately",
  }),
);
