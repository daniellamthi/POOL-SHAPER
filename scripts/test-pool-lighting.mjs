import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as THREE from "three";
import {
  planPoolLighting,
  clearsLightingExclusions,
  POOL_LIGHTING_DESIGN,
} from "../src/lib/pool/lighting.ts";
import { skimmerWall } from "../src/lib/pool/walls.ts";

// Exercise the existing access placement without mounting React/WebGL.
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
const declaration = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "accessPlacement",
);
assert.ok(declaration, "Shared access placement must remain available");
const compiled = ts.transpileModule(declaration.getText(ast), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const accessPlacement = new Function(
  "THREE",
  "skimmerWall",
  "exports",
  `${compiled}; return exports.accessPlacement;`,
)(THREE, skimmerWall, {});
const rectangle = (length, width) => [
  [-length / 2, -width / 2],
  [length / 2, -width / 2],
  [length / 2, width / 2],
  [-length / 2, width / 2],
];

let cases = 0;
for (const [length, width, expected] of [
  [6, 3, 2],
  [8, 4, 2],
  [10, 5, 3],
  [12, 6, 4],
]) {
  for (const waterY of [-0.143, -0.0005, 0.007]) {
    for (const access of [null, "internalSteps", "externalLadder"]) {
      const outline = rectangle(length, width);
      const exclusions = [];
      if (waterY === -0.143) {
        const skimmers = Math.ceil((length * width) / 25);
        for (let i = 0; i < skimmers; i++)
          exclusions.push({
            kind: "skimmer",
            x: -length / 2 + (length * (i + 0.5)) / skimmers,
            z: -width / 2,
            radius: 0.65,
          });
      }
      if (access) {
        const run = access === "internalSteps" ? (Math.ceil(1.555 / 0.25) - 1) * 0.3 : 0.55;
        const accessWidth = access === "internalSteps" ? 1.15 : 0.62;
        const p = accessPlacement(
          outline,
          run,
          accessWidth,
          access === "internalSteps" ? "internalSteps" : "stainlessSteelLadder",
        );
        assert.ok(p);
        const nx = Math.sin(p.rotation),
          nz = Math.cos(p.rotation);
        const polygon = [
          [-accessWidth / 2, -0.05],
          [accessWidth / 2, -0.05],
          [accessWidth / 2, run + 0.1],
          [-accessWidth / 2, run + 0.1],
        ].map(([x, z]) => [p.x + nz * x + nx * z, p.z - nx * x + nz * z]);
        exclusions.push({ kind: "access", polygon, clearance: 0.2 });
      }
      const plan = planPoolLighting({ outline, waterY, floorY: -1.5, exclusions });
      assert.equal(plan.count, expected, `${length}x${width}, water=${waterY}, access=${access}`);
      assert.equal(plan.warnings.length, 0);
      const rowZ = plan.positions[0].z;
      assert.ok(Math.abs(plan.positions.reduce((sum, p) => sum + p.x, 0)) < 1e-8, "Row centred");
      const xs = plan.positions.map((p) => p.x).sort((a, b) => a - b);
      for (let i = 2; i < xs.length; i++)
        assert.ok(Math.abs(xs[i] - xs[i - 1] - (xs[1] - xs[0])) < 1e-8, "Even spacing");
      for (const p of plan.positions) {
        assert.equal(p.z, rowZ, "One long wall");
        // Skimmers are laid along the minZ wall above, so the luminaires must
        // sit on the far side of the basin and shine back across it at them.
        assert.ok(p.z > 0, "Luminaires must face the skimmers from the opposite wall");
        assert.ok(Math.abs(waterY - p.y - 0.6) < 1e-8);
        assert.ok(
          p.y + 0.13 < waterY && p.y - 0.13 > -1.5,
          "Entire fitting submerged and above floor",
        );
        assert.ok(length / 2 - Math.abs(p.x) >= 0.6, "Corner clearance");
        assert.ok(clearsLightingExclusions(p.x, p.z, exclusions), "No fitting collisions");
        assert.ok(Math.abs(p.throwDistance - width) < 0.11, "Light crosses width");
        assert.ok(Math.cos(p.rotation) * p.z < 0, "Beam points inward");
      }
      cases++;
    }
  }
  console.log(`${length}x${width}: ${expected} lights — 3 systems x 3 access modes PASS`);
}
const base = { outline: rectangle(10, 5), waterY: 0, floorY: -1.5 };
assert.ok(planPoolLighting({ ...base, lumenOutput: 750 }).count > planPoolLighting(base).count);
assert.ok(planPoolLighting({ ...base, floorY: -3 }).count > planPoolLighting(base).count);
assert.equal(planPoolLighting({ ...base, floorY: -0.2 }).count, 0);
assert.equal(planPoolLighting({ ...base, lumenOutput: 0 }).count, 0);
assert.equal(planPoolLighting({ ...base, outline: [] }).count, 0);
assert.equal(
  planPoolLighting({
    ...base,
    outline: [
      [NaN, 0],
      [1, 0],
      [1, 1],
    ],
  }).count,
  0,
);
const blocked = planPoolLighting({
  ...base,
  exclusions: [{ kind: "inlet", x: 0, z: 0, radius: 20 }],
});
assert.equal(blocked.count, 0);
assert.match(blocked.warnings.join(" "), /collision-free/);
const capped = planPoolLighting({ ...base, lumenOutput: 1 });
assert.ok(capped.count <= POOL_LIGHTING_DESIGN.maxRenderedCount && capped.warnings.length > 0);
assert.equal(planPoolLighting({ ...base, outline: [...base.outline].reverse() }).count, 3);
console.log(
  `${cases} layout combinations + lumen/depth/invalid/obstruction/budget/winding checks PASS`,
);

// --- L-shape (Geometry Pass B): both wings must get real illumination. ---
// Local L-outline builder (mirrors `buildLShapeOutline`'s math) rather than
// importing l-shape.ts, which sits in a bundler-only circular import chain
// with geometry.ts/config.ts that Node's native ESM loader cannot resolve.
function lShapeOutline(totalLength, totalWidth, recessLength, recessWidth, orientation) {
  const x0 = -totalLength / 2,
    x1 = totalLength / 2,
    z0 = -totalWidth / 2,
    z1 = totalWidth / 2;
  const a = [x0, z0],
    b = [x1, z0],
    c = [x1, z1],
    d = [x0, z1];
  switch (orientation) {
    case "se":
      return [
        a,
        [x1 - recessLength, z0],
        [x1 - recessLength, z0 + recessWidth],
        [x1, z0 + recessWidth],
        c,
        d,
      ];
    case "sw":
      return [
        [x0, z0 + recessWidth],
        [x0 + recessLength, z0 + recessWidth],
        [x0 + recessLength, z0],
        b,
        c,
        d,
      ];
    case "ne":
      return [
        a,
        b,
        [x1, z1 - recessWidth],
        [x1 - recessLength, z1 - recessWidth],
        [x1 - recessLength, z1],
        d,
      ];
    case "nw":
      return [
        a,
        b,
        c,
        [x0 + recessLength, z1],
        [x0 + recessLength, z1 - recessWidth],
        [x0, z1 - recessWidth],
      ];
  }
}

let lCases = 0;
for (const orientation of ["se", "sw", "ne", "nw"]) {
  const outline = lShapeOutline(10, 4.5, 4, 1.8, orientation);
  const plan = planPoolLighting({ outline, waterY: 0, floorY: -1.5 });
  assert.ok(plan.count >= 2, `L-shape (${orientation}): must place a real, non-empty plan`);
  assert.equal(plan.warnings.length, 0, `L-shape (${orientation}): no warnings expected`);
  // Both wings covered: the fixtures must span at least two distinct wall
  // lines -- a distinct (rotation, offset-along-that-axis) pair, since two
  // walls on different wings can be parallel (same rotation) but never sit
  // on the same line -- not all bunched onto the single longest wall.
  const uniqueWalls = new Set(
    plan.positions.map((p) => {
      const facingX = Math.abs(Math.sin(p.rotation)) > Math.abs(Math.cos(p.rotation));
      const offset = facingX ? p.x.toFixed(6) : p.z.toFixed(6);
      return `${p.rotation.toFixed(6)}@${offset}`;
    }),
  ).size;
  assert.ok(
    uniqueWalls >= 2,
    `L-shape (${orientation}): fixtures must sit on more than one distinct wall line, covering both wings, not just the longest one`,
  );
  for (const p of plan.positions) {
    assert.ok(
      Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
      `L-shape (${orientation}): finite position`,
    );
    assert.ok(
      clearsLightingExclusions(p.x, p.z, []),
      `L-shape (${orientation}): no self-collision`,
    );
  }
  lCases++;
}
console.log(
  `${lCases} L-shape orientations PASS: every orientation gets a real, warning-free, multi-wall (both-wing) lighting plan`,
);

// Winding regression: reversed L must produce the same multi-wall coverage.
const lReversed = planPoolLighting({
  outline: [...lShapeOutline(10, 4.5, 4, 1.8, "se")].reverse(),
  waterY: 0,
  floorY: -1.5,
});
assert.ok(
  lReversed.count >= 2 &&
    new Set(lReversed.positions.map((p) => `${p.rotation.toFixed(6)}`)).size >= 2,
  "Reversed-winding L must still light both wings",
);
console.log("L-shape reversed-winding regression PASS");
