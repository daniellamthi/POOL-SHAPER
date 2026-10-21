/** PC13 only: cast against the real comfort renderer, not a generic collision engine. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import { DoubleSide, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Raycaster, Vector3 } from "three";
import * as cameraRuntime from "../src/lib/pool/camera";
import { buildOutline, outlineBounds } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { planSkimmers } from "../src/lib/pool/engineering";
import { pointInBasin } from "../src/lib/pool/boundary-placement";
import { DEFAULT_CUSTOMER } from "../src/lib/pool/config";
import { HYDRO_DIMENSIONS, type ComfortElementPlan } from "../src/lib/pool/comfort-plan";
import { POOL_BORDER_PRESET } from "../src/configurator/materials/visual-presets";
import { SCENE_VISUAL_PRESET } from "../src/configurator/3d/scene/visual-preset";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { BENCH_LIGHTING_S as before } from "./fixtures/premium-camera-bench-s";
import { BENCH_LIGHTING_U as approvedU } from "./fixtures/premium-camera-bench-u";
import { INFINITY_Y } from "./fixtures/premium-camera-infinity-y";
import { BENCH_MACRO_AB } from "./fixtures/premium-camera-bench-ab";
import type { PoolConfig } from "../src/lib/pool/types";
import type { CameraPoint } from "../src/lib/pool/camera";

let checks = 0, cases = 0;
const apertureMeasurements: Array<{ size: number[]; system: string; variant: string; side: number | undefined; viewport: number[]; index: number; facingDot: number; aboveFacePlaneDegrees: number; minorDiameterPx: number; majorDiameterPx: number; housingMinorDiameterPx: number; housingMajorDiameterPx: number; pixelCenter: number[]; resolvedFixtureCount: number; fitFov: number; renderFov: number; frame: object; baseEye: number[]; eye: number[]; target: number[]; waterY: number; eyeWaterOffset: number; distance: number; normalGroups: Record<string, number>; footwell: object | undefined }> = [];
const ok = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
const equal = (actual: unknown, expected: unknown, message: string) => { assert.deepEqual(actual, expected, message); checks++; };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const scenePath = "src/components/pool/three/PoolScene.tsx", tree = ts.createSourceFile(scenePath, readFileSync(scenePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const current: Record<string, string> = {};
function readRig(node: ts.Node) {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(tree) === "navigationLimits.current") current.limits = node.right.getText(tree);
  if (ts.isVariableDeclaration(node) && node.initializer) {
    const name = node.name.getText(tree), keys: Record<string, string> = { localFraming: "local", detail: "detail", opticalDetail: "optical", fitFov: "fit", coastalHero: "coastal" };
    if (keys[name]) current[keys[name]!] = node.initializer.getText(tree);
    if (name === "subjectAspect" && ts.isCallExpression(node.initializer)) current.aspect = node.initializer.arguments[0]!.getText(tree);
  }
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect" && node.arguments[0]) {
    const callback = node.arguments[0], text = callback.getText(tree);
    if (text.includes("owned.manual = true")) current.owner = text;
    if (text.includes('canvas.dataset["cameraProjection"]') && text.includes("goal.current.set") && ts.isArrowFunction(callback) && ts.isBlock(callback.body)) {
      const statements = callback.body.statements, end = statements.findIndex(s => s.getText(tree).startsWith("goal.current.set")); current.projection = statements.slice(0, end).map(s => s.getText(tree)).join("\n");
    }
  }
  ts.forEachChild(node, readRig);
}
readRig(tree); ok(Object.keys(before.rig).every(key => current[key]), "Read actual bench Rig callbacks, not assumed optical behavior");
equal(current.projection, before.rig.projection, "The approved optical/PhotoMode/Top projection implementation is unchanged");
equal(current.owner, before.rig.owner, "Bench reuses the exact scoped ownership/cleanup lifecycle");
const codeCache = new Map<string, (scope: Record<string, unknown>) => any>();
function evaluate(text: string, scope: Record<string, unknown>) {
  if (!codeCache.has(text)) { const code = ts.transpileModule(`const result=(${text});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; codeCache.set(text, new Function("scope", `with(scope){${code};return result;}`) as never); }
  return codeCache.get(text)!(scope);
}
const projection = new Function("scope", `with(scope){${ts.transpileModule(current.projection!, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}}`);
const fiberPath = "node_modules/@react-three/fiber/dist/events-156d8d12.esm.js", fiber = ts.createSourceFile(fiberPath, readFileSync(fiberPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let updateText = "", orthographic = "";
function readFiber(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "updateCamera") updateText = node.getText(fiber); if (ts.isVariableDeclaration(node) && node.name.getText(fiber) === "isOrthographicCamera") orthographic = node.initializer!.getText(fiber); ts.forEachChild(node, readFiber); }
readFiber(fiber); ok(updateText && orthographic, "Read actual installed R3F updateCamera for scoped bench projection lifecycle");
const updateCamera = new Function(`const isOrthographicCamera=${orthographic};return(${updateText});`)();
const previousMicro = new Function("scope", `with(scope){${ts.transpileModule(before.microSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText};return microLightCameraSubject;}`)({ ...cameraRuntime, HYDRO_DIMENSIONS });
const previousUMicro = new Function("scope", `with(scope){${ts.transpileModule(approvedU.microLightCameraSubject, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText};return microLightCameraSubject;}`)({ ...cameraRuntime, HYDRO_DIMENSIONS });
const previousUFit = new Function("scope", `with(scope){${ts.transpileModule(approvedU.fitBenchLightingCamera, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText};return fitBenchLightingCamera;}`)({ ...cameraRuntime, HYDRO_DIMENSIONS });
const cameraTree = ts.createSourceFile("camera.ts", readFileSync("src/lib/pool/camera.ts", "utf8"), ts.ScriptTarget.Latest, true);
function protect(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text && node.name.text in before.protectedHashes) equal(hash(node.getText(cameraTree).replace(INFINITY_Y.newSpan, INFINITY_Y.oldSpan)), before.protectedHashes[node.name.text as keyof typeof before.protectedHashes], "Approved stair/mainRGB/comfort/Infinity algorithms remain unchanged except the explicit Z subject-arclength expression"); ts.forEachChild(node, protect); }
protect(cameraTree);
// Only the B subject and its bench dispatch are authorized to differ from Z.
// Hash the other shared dispatch branches separately, not the changed branch.
for (const node of cameraTree.statements) if (ts.isFunctionDeclaration(node) && node.name?.text) {
  const name = node.name.text;
  if (name in INFINITY_Y.functions && !["microLightCameraSubject", "contextualAccessCamera"].includes(name))
    equal(hash(node.getText(cameraTree).replace(INFINITY_Y.newSpan, INFINITY_Y.oldSpan)), INFINITY_Y.functions[name as keyof typeof INFINITY_Y.functions], "Every non-bench camera function remains exact Z");
  if (name === "contextualAccessCamera") {
    let unaffected = node.getText(cameraTree);
    const scope = (child: ts.Node) => {
      if (ts.isIfStatement(child) && child.expression.getText(cameraTree) === 'subject && intent === "bench-lighting"')
        unaffected = unaffected.replace(child.getText(cameraTree), "/* scoped bench-lighting implementation */");
      else ts.forEachChild(child, scope);
    };
    scope(node);
    equal(hash(unaffected), BENCH_MACRO_AB.contextOtherBranchesSha, "Shared access/stair/Shelf/hydromassage dispatch outside bench-lighting remains exact Z");
  }
}
equal(hash(readFileSync(scenePath, "utf8")), INFINITY_Y.sceneSha, "The entire Z scene, projection, controls, PhotoMode and all other intent routes are unchanged");
equal(hash(readFileSync("src/components/pool/PoolConfigurator.tsx", "utf8")), BENCH_MACRO_AB.configuratorSha, "Wizard, RGB decision routing, saved state and manual inspection remain exact W2/Z");
equal(hash(readFileSync("src/components/pool/three/PoolComfortModel.tsx", "utf8")), before.geometryHash, "Actual opaque renderer, fittings and materials are unchanged");
equal(hash(readFileSync("src/lib/pool/comfort-plan.ts", "utf8")), before.geometryPlanHash, "Approved comfort geometry, seats, spot locations and dimensions are unchanged");
/** Independent physical oracle: the exposed back-seat face borders the real
 * tub-floor edge. The old all-three/floor subject is NOT the requested macro.
 * Keep its AA 12-point module for the eye, and test the real 10-point close-up
 * separately. None of these points comes from the camera subject helper. */
function headModule(hydro: ComfortElementPlan, closeup: boolean) {
  const seat = hydro.tiers!.find(tier => tier.role === "backSeat")!, floor = hydro.tiers!.find(tier => tier.role === "tubFloor")!;
  const head = hydro.spots!.find(spot => Math.abs(Math.max(...seat.footprint.map(([x, z]) => x * spot.dir[0] + z * spot.dir[1])) - spot.x * spot.dir[0] - spot.z * spot.dir[1]) < 1e-6)!;
  ok(head && seat && floor, "Real back-seat fitting, face and adjoining floor exist");
  const [nx, nz] = head.dir, tx = nz, tz = -nx, plane = head.x * nx + head.z * nz, along = head.x * tx + head.z * tz;
  const front = (part: typeof seat) => part.footprint.filter(([x, z]) => Math.abs(x * nx + z * nz - plane) < 1e-6).map(([x, z]) => x * tx + z * tz);
  const seatEdge = front(seat), floorEdge = front(floor);
  ok(seatEdge.length >= 2 && floorEdge.length >= 2, "Macro endpoints belong to a real shared seat/floor front edge");
  const half = closeup ? HYDRO_DIMENSIONS.spotBelowSeat : HYDRO_DIMENSIONS.spotSpacing / 2;
  const ends = [Math.max(along - half, Math.min(...seatEdge), Math.min(...floorEdge)), Math.min(along + half, Math.max(...seatEdge), Math.max(...floorEdge))];
  ok(ends[0]! <= along && ends[1]! >= along && ends[1]! > ends[0]!, "The exposed real module contains its selected fitting");
  const seatBack = plane - Math.min(...seat.footprint.map(([x, z]) => x * nx + z * nz));
  const floorForward = Math.max(...floor.footprint.map(([x, z]) => x * nx + z * nz)) - plane;
  const lowY = closeup ? Math.max(floor.topY, head.y - HYDRO_DIMENSIONS.spotBelowSeat) : floor.topY;
  const points: CameraPoint[] = [];
  // Sort by the actual tangent direction, matching the geometric edge order.
  for (const end of ends) {
    const x = head.x + tx * (end! - along), z = head.z + tz * (end! - along);
    points.push([x, seat.topY, z], [x, lowY, z]);
    points.push([x - nx * Math.min(HYDRO_DIMENSIONS.lipThickness, seatBack), seat.topY, z - nz * Math.min(HYDRO_DIMENSIONS.lipThickness, seatBack)]);
    if (!closeup) points.push([x + nx * Math.min(HYDRO_DIMENSIONS.lipThickness, floorForward), floor.topY, z + nz * Math.min(HYDRO_DIMENSIONS.lipThickness, floorForward)]);
  }
  const radius = HYDRO_DIMENSIONS.spotDiameter / 2;
  for (const side of [-1, 1]) for (const dy of [-1, 1]) points.push([head.x + tx * radius * side, head.y + radius * dy, head.z + tz * radius * side]);
  return { points, direction: [nx, .65, nz] as CameraPoint, head };
}
function samePoints(actual: readonly CameraPoint[], expected: readonly CameraPoint[], message: string) {
  equal(actual.length, expected.length, message);
  for (let i = 0; i < expected.length; i++) for (const axis of [0, 1, 2] as const)
    ok(Math.abs(actual[i]![axis] - expected[i]![axis]) < 1e-9, message);
}
const candidateS = process.argv.includes("--candidate-s"), criticalB = process.argv.includes("--critical-b"), macroB = process.argv.includes("--macro-b"), macroSkimmer = process.argv.includes("--macro-b-skimmer"), rig = candidateS ? before.rig : current;
const sizes = process.argv.includes("--mobile-repro") || criticalB ? [[6, 3] as const] : [[6, 3], [8, 4], [12, 5]] as const;
for (const [length, width] of sizes) for (const system of macroSkimmer ? ["skimmer" as const] : criticalB || macroB ? ["infinity" as const] : process.argv.includes("--mobile-repro") ? ["skimmer" as const] : ["skimmer", "overflow", "infinity"] as const) {
  const outline = buildOutline("rectangle", { length, width, depth: 1.5, cornerRadius: 0 }, []);
  const zones = system === "infinity" ? infinityZonesForOutline(outline, "rectangle").filter(zone => !criticalB || zone.side === 2) : [null];
  for (const zone of zones) for (const variant of criticalB || macroB || macroSkimmer ? ["open" as const] : process.argv.includes("--mobile-repro") ? ["closed" as const] : ["closed", "open"] as const) {
    const config: PoolConfig = { projectType: "new", poolType: "in-ground", structure: "modular-steel-panels", shape: "rectangle", shapeSelected: true, customMode: "draw", controlPoints: [], dimensions: { length, width, depth: 1.5, cornerRadius: 0, floorProfile: "flat" }, system, overflowType: "hidden", skimmerType: "slim", skimmerFinish: "white", finish: "liner", linerColor: "motionBlackStone799", copingMaterial: "prun", paving: "travertine", pavingFormat: "60x120", features: ["hydromassage", "inoxLadder", "ledLighting", "stairLighting", "hydromassageBenchLighting"], hydromassageVariant: variant, poolAccess: "internalSteps", internalStairType: "corner", equipment: ["automaticCover"], coverPosition: "closed", coverExtension: 1, ...(zone ? { infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward" as const, wallType: "traditional" as const } } : {}), sceneTime: "night", ledColor: "#ff0000", ledIntensity: 60, customer: DEFAULT_CUSTOMER, uploads: [] };
    const original = JSON.stringify(config), resolvedLayout = configuredPoolLayout(config), originalResolved = JSON.stringify(resolvedLayout), layout = getPoolVerticalLayout({ poolType: "in-ground", system, overflowType: "hidden", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
    const floor = buildFloorProfile({ outline, shape: "rectangle", poolType: "in-ground", dimensions: config.dimensions, verticalLayout: layout, sunShelf: true, infinityEdge: zone ? config.infinityEdge : null });
    const hydro = resolvedLayout.comfort.elements.find(element => element.kind === "hydromassage"); ok(hydro?.spots?.length, "The selected real hydromassage variant supplies actual bench fittings");
    const geometry = shelfStairGeometry(hydro!, floor), material = new MeshBasicMaterial({ side: DoubleSide }), solid = new Mesh(geometry, material); solid.updateMatrixWorld(true);
    for (const [vw, vh] of criticalB ? [[390, 844] as const] : process.argv.includes("--mobile-repro") ? [[430, 932] as const] : [[1440, 900], [390, 844], [430, 932]] as const) {
      const scope: Record<string, unknown> = { ...cameraRuntime, outlineBounds, focus: "bench-lighting", outline, layout, skimmers: planSkimmers(outline, length * width, system === "skimmer"), resolvedLayout, infinityZone: zone, externalStairPlan: null, coverSubject: null, interiorSubject: null, shelfLoungerEnvelope: [], ledRow: resolvedLayout.lighting.plan.positions, compactPlan: true, planBounds: outline, SCENE_VISUAL_PRESET, viewportSize: { width: vw, height: vh } };
      if (candidateS) scope.microLightCameraSubject = previousMicro;
      const preferred = evaluate(`(${rig.aspect})()`, scope), ui = BENCH_MACRO_AB.ui[vw];
      const frame = cameraRuntime.visibleCameraFrame(ui.canvas, ui.overlays, preferred); scope.visibleFrame = frame;
      for (const [name, expression] of [["detail", rig.detail], ["localFraming", rig.local], ["opticalDetail", rig.optical], ["fitFov", rig.fit]]) scope[name!] = evaluate(expression!, scope);
      const oldSubject = previousMicro("bench-lighting", resolvedLayout, layout, outline), raw = candidateS ? cameraRuntime.fitComponentCamera(oldSubject.points, oldSubject.direction, scope.fitFov as number, frame.width / frame.height) : cameraRuntime.contextualAccessCamera("bench-lighting", resolvedLayout, layout, outline, scope.fitFov as number, frame.width / frame.height, zone);
      ok(raw, "The real bench camera does not fall back to a basin overview");
      const pose = !scope.localFraming && !scope.opticalDetail ? cameraRuntime.offsetCameraToFrame(raw!, 34, vw, vh, frame) : raw!;
      if (zone) {
        const delta = new Vector3(...pose.position).sub(new Vector3(...pose.target)), distance = delta.length(), polar = Math.acos(delta.y / distance), limits = cameraRuntime.infinityNavigationLimits(pose, true, layout.waterY);
        ok(pose.position[1] >= layout.waterY + .4, "The proposed Infinity eye already meets the actual water-clearance contract before OrbitControls runs");
        ok(distance >= limits.minDistance - 1e-9 && distance <= limits.maxDistance + 1e-9 && polar >= limits.minPolarAngle - 1e-9 && polar <= limits.maxPolarAngle + 1e-9,
          `Actual Infinity OrbitControls must not clamp the proposed bench pose into another viewpoint: ${JSON.stringify({ length, width, variant, side: zone.side, viewport: [vw, vh], pose, distance, polar, limits })}`);
      } else {
        const delta = new Vector3(...pose.position).sub(new Vector3(...pose.target)), goalDistance = delta.length(), polar = Math.acos(delta.y / goalDistance);
        ok(current.limits, "Read actual settled Rig limits for non-Infinity, not an invented Orbit clearance");
        const limits = evaluate(current.limits!, { ...scope, pose, goalDistance });
        ok(goalDistance >= limits.minDistance && goalDistance <= limits.maxDistance && polar >= limits.minPolarAngle && polar <= limits.maxPolarAngle, "The actual non-Infinity OrbitControls bounds admit the real close-up without clamping");
      }
      const camera = new PerspectiveCamera(34, vw / vh, SCENE_VISUAL_PRESET.camera.near, SCENE_VISUAL_PRESET.camera.far); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true); Object.assign(scope, { camera, PerspectiveCamera, OrthographicCamera, canvas: { dataset: {} }, pose, planFit: { current: null }, coastalHero: false }); projection(scope);
      const actualSubject = cameraRuntime.microLightCameraSubject("bench-lighting", resolvedLayout, layout, outline)!;
      const basePose = cameraRuntime.fitComponentCamera(actualSubject.points, actualSubject.direction, scope.fitFov as number, frame.width / frame.height);
      const isMacro = !candidateS && variant === "open", selected = isMacro ? headModule(hydro!, false) : null;
      if (isMacro) {
        const detail = headModule(hydro!, true);
        samePoints(actualSubject.points, selected!.points, "The AA physical 12-point head module remains unchanged");
        samePoints(actualSubject.detailPoints!, detail.points, "AB uses only the ten real exposed riser/top-lip/hardware points");
        equal(actualSubject.fixtures, [selected!.head], "Only the actual head fitting constrains this camera, without deleting other fittings");
        equal(actualSubject.direction, selected!.direction, "The physical AA head axis is unchanged");
        equal(preferred, cameraRuntime.componentCameraAspect(selected!.points, selected!.direction), "Rig retains the AA module aspect before solving its physical eye");
        const physical = previousUFit(selected!, { ...hydro!, spots: [selected!.head] }, layout, scope.fitFov as number, frame.width / frame.height, !!zone);
        equal(pose.position, physical.position, "The AB close-up retains the exact AA physical eye, not a newly fitted or underwater eye");
        if (length === 6 && zone?.side === 2 && vw === 390) equal(pose.position, BENCH_MACRO_AB.criticalAAEye, "The observed AA physical eye is retained in its exact critical fixture");
        const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
        for (const point of detail.points) { min.min(new Vector3(...point)); max.max(new Vector3(...point)); }
        equal(pose.target, min.add(max).multiplyScalar(.5).toArray(), "The new aiming point is the real close-up ROI centre");
        const forward = new Vector3(...pose.target).sub(camera.position).normalize(), right = forward.clone().cross(new Vector3(0, 1, 0)).normalize(), up = right.clone().cross(forward);
        let ratio = 0;
        for (const point of detail.points) {
          const delta = new Vector3(...point).sub(camera.position), depth = delta.dot(forward);
          ok(depth > camera.near, "Every real close-up support lies beyond the unchanged near plane");
          ratio = Math.max(ratio, Math.abs(delta.dot(up)) / depth, Math.abs(delta.dot(right)) / (depth * frame.width / frame.height));
          const distance = delta.length(), hits = new Raycaster(camera.position, delta.normalize(), 0, distance - .00001).intersectObject(solid, false);
          ok(hits.length === 0, "The real riser and top-lip context is not hidden by unchanged opaque hydromassage geometry");
        }
        equal(pose.fov, 2 * Math.atan(ratio / .84) * 180 / Math.PI, "The actual tele lens is derived from real support points and the retained 0.84 margin, never clamped for PASS");
        ok(Number(pose.fov) > 0 && Number(pose.fov) <= 60, "The derived detail lens is finite and not an extreme wide angle");
        for (const point of detail.points) {
          const q = new Vector3(...point).project(camera), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2;
          ok(q.z > -1 && q.z < 1 && x > frame.left && x < frame.left + frame.width && y > frame.top && y < frame.top + frame.height, "All true macro-riser/top-lip/35mm vertices fit the actual unobscured inset");
        }
        const nearCorners = [frame.left, frame.left + frame.width].flatMap(x => [frame.top, frame.top + frame.height].map(y => new Vector3(x / vw * 2 - 1, 1 - y / vh * 2, -1).unproject(camera)));
        if (zone) ok(nearCorners.every(point => point.y > layout.waterY), "The visible near plane remains above water with the original Infinity guard");
        else {
          const footwell = hydro!.tiers!.find(tier => tier.role === "tubFloor")!;
          ok(pointInBasin(pose.position[0], pose.position[2], outline), "The non-Infinity eye is inside the real basin, not underground beyond the shell");
          ok(pose.position[1] > floor.floorYAt(pose.position[0], pose.position[2]), "The non-Infinity eye lies above the real pool floor");
          ok(pointInBasin(pose.position[0], pose.position[2], footwell.footprint) && pose.position[1] > footwell.topY, "The physical eye is in the real open footwell volume, not inside a seat");
          const parts = [...(hydro!.tiers ?? []), ...(hydro!.steps ?? []), ...(hydro!.landing ? [hydro!.landing] : [])];
          ok(parts.every(part => !pointInBasin(pose.position[0], pose.position[2], part.footprint) || pose.position[1] > part.topY), "No unchanged tier, tread or landing contains the physical non-Infinity eye");
          ok(nearCorners.every(point => pointInBasin(point.x, point.z, footwell.footprint) && point.y > footwell.topY), "The actual visible near plane does not cut the footwell floor or seats; crossing water is not underground geometry");
        }
        const aConfig = { ...config, hydromassageVariant: "closed" as const }, aResolved = configuredPoolLayout(aConfig), aHydro = aResolved.comfort.elements.find(element => element.kind === "hydromassage")!;
        const aSubject = cameraRuntime.microLightCameraSubject("bench-lighting", aResolved, layout, outline)!;
        equal(aSubject, previousUMicro("bench-lighting", aResolved, layout, outline), "HydroA real subject remains exactly U");
        const aScope = { ...scope, resolvedLayout: aResolved }, aAspect = evaluate(`(${current.aspect})()`, aScope), aFrame = cameraRuntime.visibleCameraFrame(ui.canvas, ui.overlays, aAspect);
        const aPose = cameraRuntime.contextualAccessCamera("bench-lighting", aResolved, layout, outline, 34, aFrame.width / aFrame.height, zone)!;
        equal(aPose, previousUFit(aSubject, aHydro, layout, 34, aFrame.width / aFrame.height, !!zone), "HydroA physical eye/target remain exactly U");
        const finite = cameraTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "fitBenchLightingCamera")!;
        equal(finite.getText(cameraTree), approvedU.fitBenchLightingCamera, "Approved HydroA finite-clearance algorithm bytes remain U");
        const oldSubject = previousUMicro("bench-lighting", aResolved, layout, outline), oldPose = previousUFit(oldSubject, aHydro, layout, 34, aFrame.width / aFrame.height, !!zone);
        equal(aPose, oldPose, "No FOV property leaks into the approved HydroA pose");
        for (const [nextFocus, nextPose, nextFrame] of [["bench-lighting", aPose, aFrame], ["access", { position: [0, 2, 3], target: [0, 0, 0] }, frame]] as const) {
          const next: Record<string, unknown> = { ...scope, focus: nextFocus, pose: nextPose, visibleFrame: nextFrame };
          for (const [name, expression] of [["detail", current.detail], ["localFraming", current.local], ["opticalDetail", current.optical]]) next[name!] = evaluate(expression!, next);
          projection(next);
          equal(camera.fov, 34, "Actual projection callback restores the default 34-degree lens after B's derived lens");
          if (!next.localFraming) equal(camera.aspect, vw / vh, "Leaving the macro restores the actual canvas aspect without waiting for a resize");
        }
        projection(scope);
        equal(camera.fov, pose.fov, "Actual projection callback reinstates B's derived lens when returning");
      }
      const normalGroups: Record<string, number> = {}; for (const spot of hydro!.spots!) { const key = spot.dir.join(","); normalGroups[key] = (normalGroups[key] ?? 0) + 1; }
      const floorTier = hydro!.tiers?.find(tier => tier.role === "tubFloor");
      const eye = new Vector3(...pose.position), r = HYDRO_DIMENSIONS.spotDiameter * .34;
      for (const [index, spot] of (selected ? [selected.head] : hydro!.spots!).entries()) {
        const normal = new Vector3(spot.dir[0], 0, spot.dir[1]);
        // Report the projected REAL lens aperture, not a screen-size target.
        // These measurements inform browser QA; no invented "premium" pixel
        // or angle threshold turns a barely positive facing dot into PASS.
        const center = new Vector3(spot.x, spot.y, spot.z).addScaledVector(normal, .0055), facingDot = normal.dot(eye.clone().sub(center).normalize());
        const ring = Array.from({ length: 64 }, (_, i) => {
          const angle = i * Math.PI / 32, point = center.clone().add(new Vector3(spot.dir[1] * Math.cos(angle) * r, Math.sin(angle) * r, -spot.dir[0] * Math.cos(angle) * r)).project(camera);
          return [(point.x + 1) * vw / 2, (1 - point.y) * vh / 2];
        });
        const diameters = ring.slice(0, 32).map((point, i) => Math.hypot(point[0]! - ring[i + 32]![0]!, point[1]! - ring[i + 32]![1]!));
        const housingCenter = new Vector3(spot.x, spot.y, spot.z).addScaledVector(normal, .004), housingRing = Array.from({ length: 64 }, (_, i) => {
          const angle = i * Math.PI / 32, radius = HYDRO_DIMENSIONS.spotDiameter / 2;
          const point = housingCenter.clone().add(new Vector3(spot.dir[1] * Math.cos(angle) * radius, Math.sin(angle) * radius, -spot.dir[0] * Math.cos(angle) * radius)).project(camera);
          return [(point.x + 1) * vw / 2, (1 - point.y) * vh / 2];
        });
        const housingDiameters = housingRing.slice(0, 32).map((point, i) => Math.hypot(point[0]! - housingRing[i + 32]![0]!, point[1]! - housingRing[i + 32]![1]!)), centrePixel = center.clone().project(camera);
        apertureMeasurements.push({ size: [length, width], system, variant, side: zone?.side, viewport: [vw, vh], index, facingDot, aboveFacePlaneDegrees: Math.asin(facingDot) * 180 / Math.PI, minorDiameterPx: Math.min(...diameters), majorDiameterPx: Math.max(...diameters), housingMinorDiameterPx: Math.min(...housingDiameters), housingMajorDiameterPx: Math.max(...housingDiameters), pixelCenter: [(centrePixel.x + 1) * vw / 2, (1 - centrePixel.y) * vh / 2], resolvedFixtureCount: hydro!.spots!.length, fitFov: pose.fov ?? scope.fitFov as number, renderFov: camera.fov, frame, baseEye: [...basePose.position], eye: [...pose.position], target: [...pose.target], waterY: layout.waterY, eyeWaterOffset: pose.position[1] - layout.waterY, distance: eye.distanceTo(new Vector3(...pose.target)), normalGroups, footwell: floorTier ? { ...outlineBounds(floorTier.footprint), topY: floorTier.topY } : undefined });
        // Glass and housing have different real radii/front offsets in
        // HydroSpot: test both, rather than reducing occlusion coverage to
        // the smaller luminous aperture. Each has center+four rim rays.
        for (const surface of [{ name: "glass", radius: r, offset: .0055 }, { name: "housing", radius: HYDRO_DIMENSIONS.spotDiameter / 2, offset: .004 }])
          for (const [along, dy] of [[0, 0], [-surface.radius, 0], [surface.radius, 0], [0, -surface.radius], [0, surface.radius]]) {
          const point = new Vector3(spot.x + spot.dir[1] * along!, spot.y + dy!, spot.z - spot.dir[0] * along!).addScaledVector(normal, surface.offset), distance = eye.distanceTo(point);
          const ray = new Raycaster(eye, point.clone().sub(eye).normalize(), 0, distance - .00001), hits = ray.intersectObject(solid, false);
          if (length === 6 && system === "skimmer" && variant === "closed" && vw === 430 && along === 0 && dy === 0 && surface.name === "glass") console.log(`Bench true-mesh ray, not material PASS: ${JSON.stringify({ candidateS, index, frame, pose, point: point.toArray(), distance, facingDot: normal.dot(eye.clone().sub(point).normalize()), hits: hits.slice(0, 2).map(hit => ({ distance: hit.distance, point: hit.point.toArray() })) })}`);
          ok(hits.length === 0, `Every actual glass/housing ray must avoid the unchanged opaque hydromassage geometry: ${JSON.stringify({ length, width, system, variant, side: zone?.side, viewport: [vw, vh], index, surface: surface.name, point: point.toArray(), hit: hits[0]?.point.toArray(), distance, hitDistance: hits[0]?.distance, pose, frame })}`);
          ok(normal.dot(eye.clone().sub(point).normalize()) > 0, "Actual normal faces the camera; a back-facing fitting is not certified by its projected bounding box");
          const q = point.clone().project(camera), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2;
          ok(q.z > -1 && q.z < 1 && x > frame.left && x < frame.left + frame.width && y > frame.top && y < frame.top + frame.height, "The real lens is inside the actual unobscured optical frame");
          if (system !== "infinity") ok(-point.clone().applyMatrix4(camera.matrixWorldInverse).z < Math.hypot(length, width) / 2 * 6, "Real selected bench spots remain before unchanged scene fogNear");
        }
      }
      const oldStair = previousMicro("stair-lighting", resolvedLayout, layout, outline), currentStair = cameraRuntime.microLightCameraSubject("stair-lighting", resolvedLayout, layout, outline);
      equal(currentStair, oldStair, "Stair micro-light subject, three real levels and direction remain exact S");
      equal(cameraRuntime.contextualAccessCamera("stair-lighting", resolvedLayout, layout, outline, 34, frame.width / frame.height, zone), cameraRuntime.fitComponentCamera(oldStair.points, oldStair.direction, 34, frame.width / frame.height), "Independent stair micro camera pose remains exact S");
      for (const focus of ["infinity", "coping", "waterline", "review", "overview", "access", "inox", "shelf", "hydromassage", "bench", "features", "stair-lighting", "top", "depth", "paving", "liner", "mosaic", "cover"]) {
        const values = { ...scope, focus }; equal(evaluate(`(${current.aspect})()`, values), evaluate(`(${before.rig.aspect})()`, values), "All other selected component frame aspects remain exact S"); equal(evaluate(current.local!, values), focus === "infinity" && !!zone ? true : evaluate(before.rig.local, values), "Only the explicitly approved Y Infinity detail joins local-lens ownership; all other routes remain exact S");
      }
      for (const previousManual of [undefined, false, true]) {
        const owned = camera as PerspectiveCamera & { manual?: boolean }; if (previousManual !== undefined) owned.manual = previousManual; else delete owned.manual;
        const cleanup = evaluate(rig.owner, scope)(), matrix = camera.projectionMatrix.toArray(), position = camera.position.toArray();
        updateCamera(camera, { width: vw, height: vh });
        equal(camera.projectionMatrix.toArray(), matrix, "Installed R3F idle/DPR camera update preserves the actual bench projection");
        updateCamera(camera, { width: vw + 17, height: vh - 9 });
        equal(camera.projectionMatrix.toArray(), matrix, "Installed R3F resize cannot overwrite the locally owned macro lens/aspect");
        equal(camera.position.toArray(), position, "Renderer quality updates cannot create another bench camera flight");
        cleanup?.(); equal(owned.manual, previousManual, "Bench projection exit restores prior absent/false/true ownership without leaking to another intent");
        equal(Object.hasOwn(owned, "manual"), previousManual !== undefined, "Bench ownership preserves the previous presence of the manual property");
      }
      equal(JSON.stringify(resolvedLayout), originalResolved, "All actual fittings, unselected side fixtures, tiers and steps remain in the resolved model");
      if (isMacro && length === 6 && width === 3) equal(hydro!.spots!.length, 3, "The observed 6×3 B model still contains all three real spots");
      equal(JSON.stringify(config), original, "No selected light, scene time, RGB value, seat or saved configuration changes for camera QA"); cases++;
    }
    geometry.dispose(); material.dispose();
  }
}
console.log(`Bench projected apertures, NOT a visual PASS: ${JSON.stringify({ housingDiameterMm: HYDRO_DIMENSIONS.spotDiameter * 1000, glassDiameterMm: HYDRO_DIMENSIONS.spotDiameter * .68 * 1000, exact6x3A: apertureMeasurements.filter(m => m.size[0] === 6 && m.system === "skimmer" && m.variant === "closed"), criticalB: apertureMeasurements.filter(m => m.size[0] === 6 && m.system === "infinity" && m.side === 2), skimmerB: apertureMeasurements.filter(m => m.size[0] === 6 && m.system === "skimmer" && m.variant === "open"), derivedFovRange: [Math.min(...apertureMeasurements.map(m => m.renderFov)), Math.max(...apertureMeasurements.map(m => m.renderFov))], smallest: apertureMeasurements.reduce((a, b) => a.minorDiameterPx < b.minorDiameterPx ? a : b) })}`);
console.log(`Bench lighting: ${checks} assertions / ${cases} cases PASS (opaque-ray geometry only; Day/Night appearance remains a browser gate)`);
