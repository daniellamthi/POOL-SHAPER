import { build } from "rolldown";
import { pathToFileURL } from "node:url";
const outputFile = "/tmp/pool-proposal-comparison-audit.mjs";
await build({
  platform: "node",
  input: "scripts/proposal-comparison-audit.ts",
  output: { file: outputFile, format: "esm" },
});
await import(`${pathToFileURL(outputFile).href}?audit=${Date.now()}`);

// Execute the actual capture callback with a controlled canvas channel.
const { default: assert } = await import("node:assert/strict");
const { readFileSync } = await import("node:fs");
const { runInNewContext } = await import("node:vm");
const { default: ts } = await import("typescript");
const path = "src/components/pool/PoolConfigurator.tsx";
const source = ts.createSourceFile(
  path,
  readFileSync(path, "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let callback;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "captureHero")
    callback = node.initializer.arguments[0].getText(source);
  ts.forEachChild(node, visit);
};
visit(source);
assert(callback, "Actual capture callback found");
let active = 0;
let maxActive = 0;
const completions = [];
const clean = [];
const queue = { current: Promise.resolve(null) };
const capture = runInNewContext(
  ts.transpileModule(`(${callback})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
    .outputText,
  {
    captureQueue: queue,
    setCleanCapture: (value) => clean.push(value),
    setInspectionView: () => {},
    reframe: () => {},
    renderQualityState: { idle: false },
    requestHeroCapture: () =>
      new Promise((resolve, reject) => {
        active++;
        maxActive = Math.max(maxActive, active);
        completions.push({
          resolve: (value) => {
            active--;
            resolve(value);
          },
          reject: () => {
            active--;
            reject(new Error("capture failed"));
          },
        });
      }),
  },
);
const first = capture();
const second = capture(true);
await Promise.resolve();
assert.equal(completions.length, 1, "Second caller must wait");
completions[0].resolve("first-image");
assert.equal(await first, "first-image");
await Promise.resolve();
assert.equal(completions.length, 2);
completions[1].resolve("second-image");
assert.equal(await second, "second-image");
assert.equal(maxActive, 1, "Never overwrite the canvas channel");
assert.deepEqual(clean, [true, false, true], "Keep-clean behavior is preserved");
const failed = capture();
const afterFailure = capture();
await Promise.resolve();
completions[2].reject();
await assert.rejects(failed);
await Promise.resolve();
completions[3].resolve("recovered");
assert.equal(await afterFailure, "recovered");
assert.equal(maxActive, 1);
console.log(
  "Capture queue PASS: concurrent summary/proposal callers, keep-clean export behavior, failure recovery.",
);
