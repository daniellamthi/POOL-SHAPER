import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
const tree = ts.createSourceFile(
  "PoolScene.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const effects = [];
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(tree) === "useEffect" &&
    node.arguments[0]?.getText(tree).includes("setSkimmersPrepared")
  )
    effects.push(node.arguments[0]);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(effects.length, 1, "execute the actual single lifecycle effect");
const context = vm.createContext({
  system: "skimmer",
  showSkimmers: false,
  retained: false,
  writes: 0,
});
context.setSkimmersPrepared = (value) => {
  context.retained = value;
  context.writes++;
};
const effect = ts.transpileModule(`const effect = ${effects[0].getText(tree)}; effect;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const run = vm.runInContext(effect, context);
let checks = 0;
function check(value, message) {
  assert(value, message);
  checks++;
}
run();
check(
  !context.retained && context.writes === 0,
  "initial raw stage does not prepare hidden skimmers",
);
context.showSkimmers = true;
run();
check(context.retained, "first visible exposure prepares resources");
context.showSkimmers = false;
run();
check(context.retained && context.writes === 1, "return to raw retains the same owner");
context.system = "overflow";
run();
check(!context.retained, "leaving the system resets retention");
context.system = "skimmer";
run();
check(!context.retained, "raw reentry does not remount hidden resources");
context.showSkimmers = true;
run();
check(context.retained, "next visible reentry prepares normally");
context.system = "infinity";
run();
check(!context.retained, "Infinity does not retain skimmer resources");
check(
  source.includes('system === "skimmer" && (showSkimmers || skimmersPrepared)'),
  "other systems unmount the actual skimmer subtree",
);
check(
  source.includes("<group visible={showSkimmers}>"),
  "raw-stage retained assemblies do not render",
);
check(
  source.includes('useState(system === "skimmer" && showSkimmers)'),
  "initial allocation remains lazy",
);
check(
  source.includes("}, [system, showSkimmers])"),
  "effect follows both system and exposure changes",
);
console.log(
  JSON.stringify({
    status: "PASS",
    checks,
    scope:
      "Actual effect and lazy/visibility/system-exit contracts; runtime GPU/visual verification remains separate",
  }),
);
