/**
 * Above-ground pool audit: exterior volume, cladding panels and joints,
 * internal / external access, pellicano, finish independence, save/restore
 * and switching installation type without stale selections.
 */
import assert from "node:assert/strict";
import {
  CLADDING,
  claddingFaceOffset,
  DEFAULT_EXTERIOR_PANEL_FINISH,
  EXTERIOR_PANEL_FINISHES,
  exteriorPanelFinish,
  planCladding,
  planPellicano,
} from "../src/lib/pool/above-ground";
import { buildOutline, offsetOutline } from "../src/lib/pool/geometry";
import { configuratorTesting } from "../src/lib/pool/store";
import {
  parseProjectConfiguration,
  serializeProjectConfiguration,
  toProjectConfiguration,
} from "../src/lib/pool/project";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { createPhotoSceneSpec } from "../src/lib/pool/photo-scene-spec";
import { planExternalStaircase } from "../src/components/pool/three/externalStaircasePlan";
import { copingOuterOffset } from "../src/components/pool/three/poolConstruction";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { EQUIPMENT } from "../src/lib/pool/config";
import type { PoolConfig } from "../src/lib/pool/types";
import { describeSelection } from "../src/components/pool/wizard/wizard-model";

let checks = 0;
const ok = (value: unknown, message: string) => {
  assert.ok(value, message);
  checks++;
};
const equal = (a: unknown, b: unknown, message: string) => {
  assert.deepEqual(a, b, message);
  checks++;
};
const near = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

// --- 1. Exterior volume and cladding panels -------------------------------
const faceOffset = claddingFaceOffset(copingOuterOffset("skimmer", "hidden"));
ok(
  near(copingOuterOffset("skimmer", "hidden") - faceOffset, CLADDING.copingOverhang),
  "coping overhangs the panels",
);
for (let length = 3; length <= 12; length += 0.5)
  for (let width = 2; width <= Math.min(6, length); width += 0.5) {
    const outline = buildOutline("rectangle", { length, width, depth: 1.3, cornerRadius: 0 }, []);
    const face = offsetOutline(outline, faceOffset);
    const sides = planCladding(face);
    const label = `${length}x${width}`;
    equal(sides.length, 4, `${label}: four closed sides`);
    let trimmed = 0;
    for (const [i, side] of sides.entries()) {
      const widths = side.panels.map((p) => p.to - p.from);
      ok(
        widths.every((w) => near(w, widths[0]!, 1e-9)),
        `${label} side ${i}: equal panels`,
      );
      ok(
        widths[0]! >= CLADDING.module * 0.66 && widths[0]! <= CLADDING.module * 1.5,
        `${label} side ${i}: no sliver or oversize panel (${widths[0]!.toFixed(3)} m)`,
      );
      equal(
        side.panels.length,
        Math.max(1, Math.round(side.length / CLADDING.module)),
        `${label} side ${i}: joint distribution`,
      );
      ok(
        near(side.panels.at(-1)!.to, side.length),
        `${label} side ${i}: panels run the whole side`,
      );
      for (let k = 1; k < side.panels.length; k++)
        ok(
          near(side.panels[k]!.from, side.panels[k - 1]!.to),
          `${label} side ${i}: contiguous panels`,
        );
      // Each end is either the face corner or one board thickness short of it.
      const corner = face[i]!;
      const startGap = Math.hypot(side.a[0] - corner[0], side.a[1] - corner[1]);
      ok(
        near(startGap, 0) || near(startGap, CLADDING.thickness),
        `${label} side ${i}: closed start corner`,
      );
      if (near(startGap, CLADDING.thickness)) trimmed++;
      // Outward normal really points out of the pool.
      const mid = [(side.a[0] + side.b[0]) / 2, (side.a[1] + side.b[1]) / 2];
      ok(
        Math.hypot(mid[0]! + side.normal[0], mid[1]! + side.normal[1]) >
          Math.hypot(mid[0]!, mid[1]!),
        `${label} side ${i}: outward face`,
      );
    }
    // Every convex corner: exactly one board runs through, the other yields.
    let yieldEnds = 0;
    for (const [i, side] of sides.entries()) {
      const end = face[(i + 1) % 4]!;
      if (near(Math.hypot(side.b[0] - end[0], side.b[1] - end[1]), CLADDING.thickness)) yieldEnds++;
    }
    equal(trimmed + yieldEnds, 4, `${label}: one yielding board per corner`);
  }

// --- 2. Finishes: catalogue, normalisation, independence -----------------
equal(
  EXTERIOR_PANEL_FINISHES.map((f) => f.id),
  ["steel-satin", "composite-light", "gres"],
  "panel finishes from existing materials only",
);
equal(exteriorPanelFinish(undefined), DEFAULT_EXTERIOR_PANEL_FINISH, "default satin steel");
equal(exteriorPanelFinish("invented"), DEFAULT_EXTERIOR_PANEL_FINISH, "unknown finish normalised");

const { reducer, createInitialState } = configuratorTesting;
type Action = Parameters<typeof reducer>[1];
const run = (...actions: Action[]) => actions.reduce(reducer, createInitialState());

const above = run(
  { type: "setProjectType", value: "new" } as Action,
  { type: "setPoolType", value: "above-ground" } as Action,
  { type: "setPoolStructure", value: "modular-steel-panels" } as Action,
);
equal(above.config.poolAccess, "internalSteps", "internal stairs included by default above ground");
const finished = [
  { type: "setExteriorPanelFinish", value: "gres" },
  { type: "setLinerColor", value: "motionBlackStone799" },
  { type: "setCopingMaterial", value: "limestone" },
].reduce((state, action) => reducer(state, action as Action), above);
equal(finished.config.exteriorPanelFinish, "gres", "panel finish set");
equal(finished.config.linerColor, "motionBlackStone799", "liner independent of panels");
equal(finished.config.copingMaterial, "limestone", "coping independent of panels");
equal(
  reducer(finished, { type: "setLinerColor", value: "motionArcticWhite180" } as Action).config
    .exteriorPanelFinish,
  "gres",
  "liner change keeps panels",
);
equal(
  reducer(finished, { type: "setCopingMaterial", value: "travertine" } as Action).config
    .exteriorPanelFinish,
  "gres",
  "coping change keeps panels",
);

// --- 3. Internal stairs ON/OFF -------------------------------------------
const noSteps = reducer(above, { type: "toggleInternalSteps" } as Action);
equal(noSteps.config.poolAccess, null, "internal stairs OFF");
equal(
  describeSelection("access", noSteps.config),
  "Scala interna disattivata",
  "valid above-ground stairs OFF is not described as an incomplete selection",
);
equal(
  describeSelection("deck", finished.config),
  "Limestone Ivory",
  "above-ground navigation does not advertise a nonexistent paving finish",
);
equal(
  reducer(noSteps, { type: "toggleInternalSteps" } as Action).config.poolAccess,
  "internalSteps",
  "internal stairs ON again",
);

// --- 4. External access and pellicano ON/OFF -----------------------------
const withOptions = [
  { type: "togglePoolFeature", value: "externalStaircase" },
  { type: "toggleEquipment", value: "pellicano" },
].reduce((state, action) => reducer(state, action as Action), finished);
equal(
  describeSelection("access", withOptions.config),
  "Scala interna · Scala esterna",
  "navigation includes the selected external access",
);
ok(withOptions.config.features.includes("externalStaircase"), "external stair ON");
ok(withOptions.config.equipment.includes("pellicano"), "pellicano ON");
const optionsOff = [
  { type: "togglePoolFeature", value: "externalStaircase" },
  { type: "toggleEquipment", value: "pellicano" },
].reduce((state, action) => reducer(state, action as Action), withOptions);
ok(!optionsOff.config.features.includes("externalStaircase"), "external stair OFF");
ok(!optionsOff.config.equipment.includes("pellicano"), "pellicano OFF");
ok(
  EQUIPMENT.some((e) => e.id === "pellicano"),
  "pellicano is an optional",
);

const outline = buildOutline("rectangle", { length: 8, width: 4, depth: 1.3, cornerRadius: 0 }, []);
const layout = getPoolVerticalLayout({
  poolType: "above-ground",
  system: "skimmer",
  depth: 1.3,
  copingThickness: 0.04,
});
const stair = planExternalStaircase({
  outline,
  groundY: layout.groundY,
  topY: layout.copingY,
  copingOffset: copingOuterOffset("skimmer", "hidden"),
});
ok(stair, "external stair fits an 8x4 pool");
ok(
  near(stair!.rise * stair!.stepCount, layout.copingY - layout.groundY),
  "landing at coping height",
);
ok(stair!.rise <= 0.2 && stair!.treadDepth >= 0.27, "consistent rise and tread");
const pell = planPellicano(outline, [{ x: 3.5, z: 1.5 }]);
ok(pell, "pellicano placed");
ok(near(Math.abs(pell!.x), 4) && near(pell!.z, 0), "pellicano centred on a short side");
ok(pell!.x < 0, "pellicano on the short side away from the access");
ok(pell!.inward[0] * -pell!.x > 0, "pellicano faces the water");

// --- 5. Switching installation type: no stale options --------------------
const toInGround = reducer(withOptions, { type: "setPoolType", value: "in-ground" } as Action);
ok(!toInGround.config.features.includes("externalStaircase"), "in-ground drops the external stair");
ok(!toInGround.config.equipment.includes("pellicano"), "in-ground drops the pellicano");
equal(toInGround.config.exteriorPanelFinish, undefined, "in-ground drops the panel finish");
equal(
  reducer(toInGround, {
    type: "toggleEquipment",
    value: "pellicano",
  } as Action).config.equipment.includes("pellicano"),
  false,
  "pellicano refused in ground",
);
equal(
  reducer(toInGround, { type: "setExteriorPanelFinish", value: "gres" } as Action).config
    .exteriorPanelFinish,
  undefined,
  "panel finish refused in ground",
);

// --- 6. Save / restore / summary / photo spec -----------------------------
const renovation = createInitialState().renovation;
const saved = parseProjectConfiguration(
  serializeProjectConfiguration(toProjectConfiguration("ag-audit", withOptions.config, renovation)),
);
equal(saved.config.exteriorPanelFinish, "gres", "restore keeps the panel finish");
ok(
  saved.config.equipment.includes("pellicano") &&
    saved.config.features.includes("externalStaircase"),
  "restore keeps the optionals",
);
equal(saved.config.poolAccess, "internalSteps", "restore keeps internal stairs");
const legacyInGround: PoolConfig = {
  ...withOptions.config,
  poolType: "in-ground",
  structure: "reinforced-concrete",
};
const legacy = parseProjectConfiguration(
  serializeProjectConfiguration({
    ...toProjectConfiguration("ag-legacy", withOptions.config, renovation),
    config: legacyInGround,
  }),
);
ok(!legacy.config.equipment.includes("pellicano"), "in-ground restore drops a stale pellicano");
equal(legacy.config.exteriorPanelFinish, undefined, "in-ground restore drops a stale panel finish");
const rows = (config: PoolConfig) =>
  buildProjectSummary(toProjectConfiguration("ag-sum", config, renovation)).sections.flatMap((s) =>
    s.rows.map((r) => `${r.label}:${r.value}`),
  );
ok(
  rows(withOptions.config).includes("Pannelli esterni:Gres porcellanato"),
  "summary names the panels",
);
ok(
  !rows(withOptions.config).some((r) => r.startsWith("Pavimentazione")),
  "no terrace in an above-ground summary",
);
ok(
  !rows(toInGround.config).some((r) => r.startsWith("Pannelli esterni")),
  "no panels in an in-ground summary",
);
ok(
  !rows(optionsOff.config).some((r) => r.includes("Pellicano")),
  "pellicano OFF not in the summary",
);
const spec = createPhotoSceneSpec(
  toProjectConfiguration("ag-spec", withOptions.config, renovation),
);
equal(
  (spec.selection as Partial<PoolConfig>).exteriorPanelFinish,
  "gres",
  "photo spec carries the panel finish",
);

console.log(`Above-ground audit PASS: ${checks} checks`);
