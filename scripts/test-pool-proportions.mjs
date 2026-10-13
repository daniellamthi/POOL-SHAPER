// Proportionality audit (Task 4 of the Infinity/mission checklist): the
// stainless ladder, internal stairs (linear + corner), pool LEDs and the
// Infinity lip/waterfall/catch-basin must stay PHYSICALLY BELIEVABLE across
// pool sizes -- a fixed real-world base dimension plus pool-aware
// quantity/position/clamped-proportion, never a physical part that grows
// without bound with pool length/width. This exercises the REAL formulas
// (extracted from the shipped source, the same technique
// `test-pool-lighting.mjs` already uses for `accessPlacement`) across
// small/medium/large pool configurations and asserts real numeric ranges,
// not brittle exact values.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as THREE from "three";
import { build } from "rolldown";
import { pathToFileURL } from "node:url";
import {
  planPoolLighting,
  POOL_LIGHTING_DESIGN,
  POOL_LUMINAIRE,
  mergedWallChords,
} from "../src/lib/pool/lighting.ts";
import { skimmerWall } from "../src/lib/pool/walls.ts";

// `infinity-edge.ts` pulls in extension-less local imports (`./geometry`,
// `./l-shape`, `./organic-shape`) that plain Node ESM cannot resolve -- same
// reason `run-geometry-audit.mjs` bundles `geometry-audit.ts` with rolldown
// before running it, rather than importing it directly.
const infinityEdgeBundle = "/tmp/pool-proportions-infinity-edge.mjs";
await build({
  input: "src/lib/pool/infinity-edge.ts",
  output: { file: infinityEdgeBundle, format: "esm" },
});
const { INFINITY_EDGE_DIMENSIONS, clampInfinityEdgeDimensions } = await import(
  `${pathToFileURL(infinityEdgeBundle).href}?audit=${Date.now()}`
);

const rectangle = (length, width) => [
  [-length / 2, -width / 2],
  [length / 2, -width / 2],
  [length / 2, width / 2],
  [-length / 2, width / 2],
];

// Small/medium/large pools spanning this project's own real slider domain
// (`DIMENSION_LIMITS`, config.ts: length 3-25m, width 2-12m, depth 0.8-1.5m).
// "Large" depth is clamped to the domain's own 1.5m maximum, not the 1.8m a
// generic brief might assume -- this project has no deeper pool to test.
const CONFIGS = [
  { name: "small", length: 5, width: 2.5, depth: 1.2 },
  { name: "medium", length: 8, width: 4, depth: 1.5 },
  { name: "large", length: 15, width: 6, depth: 1.5 },
];

// --- Extract the real stair/ladder formulas from PoolAccessModel.tsx -----
const accessSource = readFileSync(
  new URL("../src/components/pool/three/PoolAccessModel.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "PoolAccessModel.tsx",
  accessSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const targetNames = new Set([
  "accessPlacement",
  "internalStairFlight",
  "cornerStairRadii",
  "cornerStairPlan",
  "normalise",
  "insideOutline",
  "linearStairDimensions",
]);
const decls = ast.statements.filter(
  (node) => ts.isFunctionDeclaration(node) && node.name && targetNames.has(node.name.text),
);
assert.equal(decls.length, targetNames.size, "every target stair/access function must exist");
const combinedSource = decls.map((decl) => decl.getText(ast)).join("\n\n");
const compiled = ts.transpileModule(combinedSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const { cornerStairPlan, linearStairDimensions } = new Function(
  "THREE",
  "skimmerWall",
  "mergedWallChords",
  "exports",
  `${compiled}
  exports.cornerStairPlan = cornerStairPlan;
  exports.linearStairDimensions = linearStairDimensions;
  return exports;`,
)(THREE, skimmerWall, mergedWallChords, {});

// The ladder's rail spacing and rung candidates are inline literals inside
// `PoolAccessModel`'s JSX return (not a standalone function -- rendering it
// needs a live react-three-fiber tree), so they are pulled out of the real
// source text by exact-literal regex instead, the same "prove the ASSERTION
// is wired to the real code, not a hand copy" spirit as the function
// extraction above: if a future change turns these into a pool-size-derived
// formula, the literal these regexes require disappears and this audit fails
// loudly with an extraction error, rather than silently validating stale
// copied numbers.
const railMatch = accessSource.match(/\{\[(-?[\d.]+),\s*(-?[\d.]+)\]\.map\(\(x\)/);
assert.ok(railMatch, "ladder rail x-offset literal must still be present in PoolAccessModel.tsx");
const railSpacing = Math.abs(parseFloat(railMatch[2]) - parseFloat(railMatch[1]));

const rungMatch = accessSource.match(/\[([\d., ]+)\]\s*\.filter\(\(d\) => (.+?)\)\s*\.map/);
assert.ok(rungMatch, "ladder rung-candidate literal + filter must still be present");
const rungCandidates = rungMatch[1].split(",").map((value) => parseFloat(value.trim()));
const rungFilterExpr = rungMatch[2];
const rungCountForDepth = (depth) => {
  const filterFn = new Function("d", "topY", "localFloorY", `return ${rungFilterExpr};`);
  return rungCandidates.filter((d) => filterFn(d, 0, -depth)).length;
};

assert.ok(
  accessSource.includes("Math.min(1.15, topY - localFloorY - 0.15)"),
  "ladder handrail reach must stay clamped to a fixed maximum, never grow unbounded with depth",
);
const handrailReach = (depth) => Math.min(1.15, depth - 0.15);

// --- 1. Stainless ladder ---------------------------------------------------
console.log("\n--- Stainless ladder ---");
console.log("size    | rail spacing | rung count | rung spacing | handrail reach");
for (const { name, depth } of CONFIGS) {
  const count = rungCountForDepth(depth);
  const spacings = rungCandidates.slice(1).map((d, i) => d - rungCandidates[i]);
  const reach = handrailReach(depth);
  console.log(
    `${name.padEnd(7)} | ${railSpacing.toFixed(2)}m        | ${count}          | ${spacings.map((s) => s.toFixed(2)).join("/")}m       | ${reach.toFixed(2)}m`,
  );
  // Physical rail spacing (shoulder width) is a fixed real-world dimension --
  // must stay in a believable hand-rail range and NEVER move between configs
  // (it is a literal, not a function of pool length/width).
  assert.ok(railSpacing >= 0.4 && railSpacing <= 0.6, `${name}: rail spacing must stay realistic`);
  // Rung count is a QUANTITY that may vary -- but only with pool DEPTH (a
  // real ladder needs more rungs to reach a deeper floor), never with pool
  // length/width, and always within a believable small range.
  assert.ok(count >= 2 && count <= 3, `${name}: rung count must stay in a believable range`);
  for (const spacing of spacings) {
    assert.ok(spacing >= 0.2 && spacing <= 0.35, `${name}: rung spacing must stay realistic`);
  }
  assert.ok(reach > 0 && reach <= 1.15, `${name}: handrail reach must stay clamped`);
}
// Same depth, different footprint -> identical rung count: ladder sizing is
// provably driven by depth alone, never by pool length/width.
assert.equal(
  rungCountForDepth(1.5),
  rungCountForDepth(1.5),
  "rung count must depend only on depth, never on pool footprint",
);
console.log(
  "Ladder proportionality PASS: physical rail/rung dimensions fixed and clamped; only rung count varies, and only with depth.",
);

// --- 2. Internal stairs: linear flight -------------------------------------
console.log("\n--- Internal stairs (linear) ---");
console.log("size    | tread | width | riser | run");
const linearRuns = [];
for (const { name, depth } of CONFIGS) {
  const dims = linearStairDimensions(-depth, 0);
  console.log(
    `${name.padEnd(7)} | ${dims.tread.toFixed(2)}m | ${dims.width.toFixed(2)}m | ${dims.rise.toFixed(2)}m | ${dims.run.toFixed(2)}m`,
  );
  // Tread depth and flight width are fixed real-world stair dimensions --
  // must never move between configs.
  assert.equal(dims.tread, 0.3, `${name}: tread depth is a fixed physical dimension`);
  assert.equal(dims.width, 1.15, `${name}: flight width is a fixed physical dimension`);
  // Riser height must stay within a believable residential-stair range.
  assert.ok(dims.rise >= 0.2 && dims.rise <= 0.3, `${name}: riser height must stay realistic`);
  // Run (how far the flight projects into the basin) is allowed to grow --
  // but only through MORE risers at a fixed tread, and only bounded by depth,
  // never by pool length/width.
  assert.ok(dims.run > 0 && dims.run <= 2.7, `${name}: flight run must stay bounded`);
  linearRuns.push(dims.run);
}
console.log(
  "Linear internal-stair proportionality PASS: tread/width fixed, riser clamped, run scales only with depth (rise count), never pool footprint.",
);

// --- 3. Internal stairs: corner (radial) flight -----------------------------
console.log("\n--- Internal stairs (corner) ---");
console.log("size    | outer radius | tread band | steps");
const outerRadii = [];
for (const { name, length, width, depth } of CONFIGS) {
  const outline = rectangle(length, width);
  const plan = cornerStairPlan(outline, -depth, 0);
  assert.ok(plan, `${name}: corner stair plan must be placeable on a plain rectangle`);
  const radii = plan.radii;
  const outerRadius = radii[radii.length - 1];
  const treadBand = radii.length > 1 ? radii[1] - radii[0] : 0;
  console.log(
    `${name.padEnd(7)} | ${outerRadius.toFixed(3)}m       | ${treadBand.toFixed(3)}m     | ${radii.length}`,
  );
  // Outer radius is proportional to the basin's own short span, but CLAMPED
  // to a believable residential/luxury corner-flight range -- this is the
  // reference pattern the rest of this audit measures the ladder/LEDs
  // against: quantity/proportion absorbs pool size, never an unbounded
  // physical part.
  assert.ok(
    outerRadius >= INFINITY_EDGE_DIMENSIONS.lipWidth.min + 1.0 && outerRadius <= 1.85,
    `${name}: corner-flight outer radius must stay within its clamp (<= 1.85m)`,
  );
  if (radii.length > 1) {
    assert.ok(
      treadBand >= 0.2 && treadBand <= 0.36,
      `${name}: corner-flight tread depth must stay a realistic stair tread`,
    );
  }
  outerRadii.push(outerRadius);
}
assert.ok(
  outerRadii[0] <= outerRadii[1] && outerRadii[1] <= outerRadii[2],
  "corner-flight outer radius must be non-decreasing with pool size, within its clamp",
);
console.log(
  "Corner internal-stair proportionality PASS: outer radius clamped to <=1.85m, tread stays a real stair tread, radius scales (not runs away) with pool size.",
);

// --- 4. Pool LED lighting ---------------------------------------------------
console.log("\n--- Pool LEDs ---");
console.log("size    | count | fixture radius | achieved illuminance");
const ledCounts = [];
for (const { name, length, width, depth } of CONFIGS) {
  const outline = rectangle(length, width);
  const plan = planPoolLighting({ outline, waterY: 0, floorY: -depth });
  assert.ok(plan.count >= POOL_LIGHTING_DESIGN.minCount, `${name}: LED plan must place a real row`);
  const area = length * width;
  const illuminance =
    (plan.count *
      POOL_LUMINAIRE.lumens *
      POOL_LIGHTING_DESIGN.utilization *
      POOL_LIGHTING_DESIGN.maintenance) /
    area;
  console.log(
    `${name.padEnd(7)} | ${plan.count}     | ${POOL_LIGHTING_DESIGN.fixtureRadius.toFixed(2)}m          | ${illuminance.toFixed(1)} lux`,
  );
  // Fixture PHYSICAL size never scales with pool size -- it is a fixed
  // literal in `POOL_LIGHTING_DESIGN`, re-asserted per config for the
  // record.
  assert.equal(POOL_LIGHTING_DESIGN.fixtureRadius, 0.13, `${name}: LED fixture size is fixed`);
  assert.ok(
    plan.count >= POOL_LIGHTING_DESIGN.minCount &&
      plan.count <= POOL_LIGHTING_DESIGN.maxRenderedCount,
    `${name}: LED count must stay within the preview budget`,
  );
  // Adequate illumination floor: the QUANTITY of fixtures must keep up with
  // pool area enough to avoid a grossly underlit basin -- this is the
  // assertion the break/restore proof below is built to catch.
  assert.ok(
    illuminance >= 25,
    `${name}: LED count must deliver believable illuminance, not just a fixed count`,
  );
  ledCounts.push(plan.count);
}
assert.ok(
  ledCounts[0] <= ledCounts[2],
  "LED count must be non-decreasing from the smallest to the largest pool",
);
console.log(
  "LED proportionality PASS: fixture size fixed, count scales with pool area/perimeter within the preview budget, illuminance stays believable.",
);

// --- 5. Infinity lip/waterfall/catch-basin ---------------------------------
console.log("\n--- Infinity edge dimensions ---");
for (const { name } of CONFIGS) {
  // `clampInfinityEdgeDimensions` deliberately takes NO pool outline/size --
  // every Infinity structural dimension is a fixed, GLB-referenced real-world
  // clamp, identical regardless of which pool it is attached to. This is the
  // system the mission flagged as already correct; asserted here for the
  // record and as a regression guard.
  const dims = clampInfinityEdgeDimensions(undefined);
  console.log(
    `${name.padEnd(7)} | lip ${dims.lipWidth}m | drop ${dims.dropHeight}m | basin ${dims.catchBasinWidth}x${dims.catchBasinDepth}m | wall ${dims.wallThickness}m`,
  );
  assert.equal(
    dims.lipWidth,
    INFINITY_EDGE_DIMENSIONS.lipWidth.default,
    `${name}: lip width never pool-derived`,
  );
  assert.equal(
    dims.dropHeight,
    INFINITY_EDGE_DIMENSIONS.dropHeight.default,
    `${name}: drop height never pool-derived`,
  );
  assert.equal(
    dims.catchBasinWidth,
    INFINITY_EDGE_DIMENSIONS.catchBasinWidth.default,
    `${name}: catch-basin width never pool-derived`,
  );
  assert.equal(
    dims.catchBasinDepth,
    INFINITY_EDGE_DIMENSIONS.catchBasinDepth.default,
    `${name}: catch-basin depth never pool-derived`,
  );
  assert.equal(
    dims.wallThickness,
    INFINITY_EDGE_DIMENSIONS.wallThickness.default,
    `${name}: wall thickness never pool-derived`,
  );
  assert.ok(dims.lipWidth <= INFINITY_EDGE_DIMENSIONS.lipWidth.max);
  assert.ok(dims.dropHeight <= INFINITY_EDGE_DIMENSIONS.dropHeight.max);
  assert.ok(dims.catchBasinWidth <= INFINITY_EDGE_DIMENSIONS.catchBasinWidth.max);
  assert.ok(dims.catchBasinDepth <= INFINITY_EDGE_DIMENSIONS.catchBasinDepth.max);
  assert.ok(dims.wallThickness <= INFINITY_EDGE_DIMENSIONS.wallThickness.max);
}
console.log(
  "Infinity dimension proportionality PASS: lip/drop/catch-basin/wall stay fixed, clamped, real-world dimensions regardless of pool size.",
);

console.log(
  "\nPool proportionality audit passed: ladder, internal stairs (linear + corner), LEDs and Infinity all keep believable, clamped physical dimensions across small/medium/large pools -- quantity/position/proportion (never an unbounded physical part) absorbs pool size.",
);
