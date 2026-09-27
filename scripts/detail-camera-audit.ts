import assert from "node:assert/strict";
import { getAccessDetailCamera, getCameraPose } from "../src/lib/pool/camera";
import { resolveAccessPlan } from "../src/components/pool/three/PoolAccessModel";
import { buildOutline } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS } from "../src/lib/pool/config";
import { planSkimmers } from "../src/lib/pool/engineering";
import { PerspectiveCamera, Vector3 } from "three";

let checked = 0;
for (const shape of ["rectangle", "l-shape", "custom"] as const)
for (const [length, width] of [[6, 3], [10, 4.5]]) {
  const dimensions = { ...DEFAULT_DIMENSIONS, length, width, depth: 1.5 };
  const outline = buildOutline(shape, dimensions, DEFAULT_CONTROL_POINTS);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "skimmer", depth: dimensions.depth, copingThickness: 0.06 });
  const floorProfile = buildFloorProfile({ outline, shape, poolType: "in-ground", dimensions, verticalLayout: layout });
  for (const aspect of [0.45, 0.76, 1.6]) {
    for (const kind of ["linear", "corner", "ladder"] as const) {
      const plan = resolveAccessPlan({ outline, floorProfile, topY: layout.copingY, access: kind === "ladder" ? "stainlessSteelLadder" : "internalSteps", stairType: kind === "corner" ? "corner" : "linear" });
      if (!plan.placement) continue; // The existing planner owns compatibility.
      const pose = getAccessDetailCamera(plan, layout, 35, aspect)!;
      assert([...pose.position, ...pose.target].every(Number.isFinite));
      const camera = new PerspectiveCamera(35, aspect, 0.01, 1000);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      const lo = kind === "ladder" ? plan.ladderAnchorY - plan.ladderDepths.at(-1)! - 0.15 : layout.copingY - plan.rise * plan.riseCount;
      const hi = kind === "ladder" ? plan.ladderAnchorY + 0.82 : layout.copingY;
      for (const [x, z] of plan.footprint) for (const y of [lo, hi]) {
        const projected = new Vector3(x, y, z).project(camera);
        assert(Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95, `${shape}/${kind}/${aspect}: clipped footprint`);
      }
      checked++;
    }
    const args = { outline, layout, depth: dimensions.depth, skimmers: planSkimmers(outline, length! * width!, true), viewportAspect: aspect };
    const liner = getCameraPose({ ...args, intent: "liner" });
    assert(liner.position[1] > layout.copingY);
    assert.deepEqual(liner, getCameraPose({ ...args, intent: "mosaic" }));
  }
}
console.log(`PASS: ${checked} access camera fits; liner/mosaic framing stable across sizes, shapes and aspects.`);
