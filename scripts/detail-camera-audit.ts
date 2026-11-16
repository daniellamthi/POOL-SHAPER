import assert from "node:assert/strict";
import { getAccessDetailCamera, getCameraPose } from "../src/lib/pool/camera";
import { ACCESS_DIMENSIONS, ladderRailCurve, ladderWallContacts, rectangularCornerTread, resolveAccessPlan } from "../src/components/pool/three/PoolAccessModel";
import { buildOutline } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS } from "../src/lib/pool/config";
import { planSkimmers } from "../src/lib/pool/engineering";
import { PerspectiveCamera, TubeGeometry, Vector3 } from "three";

/** Independent renderer-derived subjects: actual tread/riser levels and rail
 * tube vertices, never coping-height columns over the entire footprint. */
function actualAccessPoints(plan: ReturnType<typeof resolveAccessPlan>, outline: ReturnType<typeof buildOutline>, topY: number) {
  const points: Vector3[] = [], p = plan.placement!, c = Math.cos(p.rotation), s = Math.sin(p.rotation);
  const place = (x: number, y: number, z: number) => points.push(new Vector3(p.x + c * x + s * z, y, p.z - s * x + c * z));
  if (plan.ladderDepths.length) {
    for (const contact of ladderWallContacts(outline, p)) {
      const tube = new TubeGeometry(ladderRailCurve(plan.ladderAnchorOffset, plan.ladderDepths.at(-1)!, contact.z), 64, ACCESS_DIMENSIONS.ladderTubeRadius, 12, false);
      const position = tube.getAttribute("position");
      for (let i = 0; i < position.count; i++) place(contact.x + position.getX(i), plan.ladderAnchorY + position.getY(i), position.getZ(i));
      tube.dispose();
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (const y of [0, .024])
        place(contact.x + Math.cos(angle) * .06, plan.ladderAnchorY + y, -plan.ladderAnchorOffset + Math.sin(angle) * .06);
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (const z of [contact.z, contact.z + ACCESS_DIMENSIONS.ladderFootPad])
        place(contact.x + Math.cos(angle) * .034, plan.ladderAnchorY - plan.ladderDepths.at(-1)! - ACCESS_DIMENSIONS.ladderFootDrop + Math.sin(angle) * .034, z);
    }
    for (const depth of plan.ladderDepths) for (const x of [-ACCESS_DIMENSIONS.ladderWidth / 2, ACCESS_DIMENSIONS.ladderWidth / 2])
      for (const z of [.32 - .065, .32 + .065]) for (const dy of [-.0175, .0175]) place(x, plan.ladderAnchorY - depth + dy, z);
    for (const depth of plan.ladderDepths) for (const x of [-.2, .2]) for (const z of [.32 - .0525, .32 + .0525]) for (const dy of [.017, .021])
      place(x, plan.ladderAnchorY - depth + dy, z);
  } else for (let index = 0; index < plan.steps; index++) {
    const top = topY - (index + 1) * plan.rise, below = top - plan.rise;
    if (plan.corner) {
      const radius = plan.corner.radii[index]!, inner = index ? plan.corner.radii[index - 1]! : 0;
      if (plan.corner.rectangular) {
        for (const [x, z] of rectangularCornerTread(inner, radius)) place(x, top, z);
        for (const [x, z] of [[0, radius], [radius, radius], [radius, 0]]) place(x!, below, z!);
      } else for (let sample = 0; sample <= 48; sample++) {
        const angle = sample / 48 * Math.PI / 2, sx = Math.sin(angle), sz = Math.cos(angle);
        place(radius * sx, top, radius * sz); place(radius * sx, below, radius * sz);
        if (inner) place(inner * sx, top, inner * sz); else place(0, top, 0);
      }
    } else for (const x of [-plan.width / 2, plan.width / 2]) {
      place(x, top, index * plan.tread); place(x, top, (index + 1) * plan.tread); place(x, below, (index + 1) * plan.tread);
    }
  }
  if (!plan.ladderDepths.length) {
    if (plan.corner) place(0, topY, 0);
    else for (const x of [-plan.width / 2, plan.width / 2]) place(x, topY, 0);
  }
  return points;
}

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
      const pose = getAccessDetailCamera(plan, layout, 35, aspect, false, outline)!;
      assert([...pose.position, ...pose.target].every(Number.isFinite));
      const camera = new PerspectiveCamera(35, aspect, 0.01, 1000);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      for (const point of actualAccessPoints(plan, outline, layout.copingY)) {
        const projected = point.project(camera);
        assert(Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95, `${shape}/${kind}/${aspect}: clipped actual tread/riser/rail`);
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
