import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/components/pool/three/StudioPaving.tsx", "utf8");
const tree = ts.createSourceFile(
  "StudioPaving.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const comparator = tree.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "reusePavingSurfaces",
);
assert(comparator, "test must execute the actual retention comparator");
const javascript = ts.transpileModule(comparator.getText(tree), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const reuse = vm.runInNewContext(`${javascript}\nreusePavingSurfaces;`);
const previous = {
  active: true,
  descriptor: "physical-layout-A",
  id: "reference-greige",
  waterY: -0.15,
};
let checks = 0;
function check(value, message) {
  assert(value, message);
  checks++;
}
check(reuse(previous, { ...previous }), "same visible physical surface retains resources");
check(
  reuse(previous, { ...previous, active: false }),
  "raw transition does not unmount/rebuild paving",
);
check(
  reuse(previous, {
    ...previous,
    active: false,
    descriptor: "raw-resized-layout",
    id: "wpc",
    waterY: -0.01,
  }),
  "hidden dimension/material edits do not cut invisible modules",
);
check(
  !reuse(previous, { ...previous, descriptor: "resized-layout" }),
  "visible resized footprint cannot reuse stale geometry",
);
check(!reuse(previous, { ...previous, id: "wpc" }), "visible material changes cannot be skipped");
check(
  !reuse(previous, { ...previous, waterY: -0.01 }),
  "water-level material compatibility updates",
);
check(
  !reuse(previous, { ...previous, descriptor: "rotated-or-furniture-layout" }),
  "orientation/furniture footprint changes update on reveal",
);
check(
  reuse(previous, { ...previous, active: false, descriptor: "hidden-other-layout" }) &&
    reuse(previous, { ...previous }),
  "return to last actually rendered descriptor can retain its buffers",
);
check(source.includes("decking || pavingPrepared"), "first paving reveal remains lazy");
check(source.includes("<group visible={decking}>"), "hidden retained geometry does not render");
check(
  source.includes(
    "JSON.stringify([geometry.inner, geometry.outer, module, { gap, thickness, boards }])",
  ),
  "descriptor contains exact physical outlines, modules and joints",
);
check(
  source.includes("geometry.slabs.dispose();") && source.includes("geometry.grout.dispose();"),
  "retained surface resources have actual disposal cleanup",
);
check(
  source.includes("geometry.ground.dispose()"),
  "current raw ground has a separate disposal owner",
);
check(source.includes("}, reusePavingSurfaces)"), "React.memo uses the tested actual comparator");
console.log(
  JSON.stringify({
    status: "PASS",
    checks,
    scope:
      "Actual comparator and lazy/visibility/disposal contracts; real browser geometry and latency still required",
  }),
);
