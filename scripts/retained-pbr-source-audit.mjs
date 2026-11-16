import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

// Release parent is fixed so this audit remains meaningful after committing.
const baselineRoot = process.argv[2];
const baseline = path => baselineRoot
  ? readFileSync(join(baselineRoot, path), "utf8")
  : execFileSync("git", ["show", `6ad89bdd5347017ea9a4ced72caf9783b771bf76:${path}`], { encoding: "utf8" });
let materialElements = 0, geometryFactories = 0, shaderConstants = 0;
for (const filename of ["PoolModel", "WaterSurfaceMaterial"]) {
  const path = `src/components/pool/three/${filename}.tsx`;
  const collect = source => {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const materials = [], geometries = [], shaders = [];
    const walk = node => {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(ast) === "meshPhysicalMaterial") materials.push(node.attributes.getText(ast));
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const init = node.initializer;
        if (ts.isCallExpression(init) && init.expression.getText(ast) === "useDisposable") geometries.push(node.getText(ast));
        if (ts.isNoSubstitutionTemplateLiteral(init) && /[A-Z_]+/.test(node.name.getText(ast))) shaders.push(node.getText(ast));
      }
      ts.forEachChild(node, walk);
    };
    walk(ast);
    return { materials, geometries, shaders };
  };
  const before = collect(baseline(path)), after = collect(readFileSync(path, "utf8"));
  assert.deepEqual(after.materials, before.materials, `${filename}: every physical-material descriptor stays unchanged`);
  assert.deepEqual(after.geometries, before.geometries, `${filename}: geometry factories, dimensions and inputs stay unchanged`);
  assert.deepEqual(after.shaders, before.shaders, `${filename}: authored shader constants stay unchanged`);
  materialElements += before.materials.length; geometryFactories += before.geometries.length; shaderConstants += before.shaders.length;
}
assert(materialElements > 4 && geometryFactories > 10 && shaderConstants > 4);
console.log(JSON.stringify({ status: "PASS", materialElements, geometryFactories, shaderConstants, scope: "Exact parent source descriptors/constants; not a rendered image-equivalence claim" }));
