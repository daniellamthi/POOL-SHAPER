/** Targeted Infinity waterline regression. Mathematical evidence is not wet visual QA. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import * as runtime from "../src/lib/pool/camera";
import { buildOutline, outlineBounds } from "../src/lib/pool/geometry";
import { clampInfinityEdgeDimensions, infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { planSkimmers } from "../src/lib/pool/engineering";
import { resolveAutomaticCover } from "../src/lib/pool/cover-plan";
import { DEFAULT_CUSTOMER } from "../src/lib/pool/config";
import { POOL_BORDER_PRESET } from "../src/configurator/materials/visual-presets";
import { SCENE_VISUAL_PRESET } from "../src/configurator/3d/scene/visual-preset";
import { INFINITY_WATERLINE_R as previous } from "./fixtures/premium-camera-infinity-waterline-r";
import type { PoolConfig } from "../src/lib/pool/types";

let checks = 0, cases = 0;
const ok = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
const equal = (actual: unknown, expected: unknown, message: string) => { assert.deepEqual(actual, expected, message); checks++; };
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const path = "src/components/pool/three/PoolScene.tsx", tree = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const current: Record<string, string> = {};
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer) {
    const name = node.name.getText(tree), keys: Record<string, string> = { localFraming: "local", detail: "detail", opticalDetail: "optical", fitFov: "fit", coastalHero: "coastal" };
    if (keys[name]) current[keys[name]!] = node.initializer.getText(tree);
    if (name === "subjectAspect" && ts.isCallExpression(node.initializer)) current.aspect = node.initializer.arguments[0]!.getText(tree);
  }
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "useLayoutEffect" && node.arguments[0]) {
    const callback = node.arguments[0], text = callback.getText(tree);
    if (text.includes("owned.manual = true")) current.owner = text;
    if (text.includes('canvas.dataset["cameraProjection"]') && text.includes("goal.current.set") && ts.isArrowFunction(callback) && ts.isBlock(callback.body)) {
      const statements = callback.body.statements, end = statements.findIndex(s => s.getText(tree).startsWith("goal.current.set"));
      current.projection = statements.slice(0, end).map(s => s.getText(tree)).join("\n");
    }
  }
  ts.forEachChild(node, visit);
}
visit(tree);
ok(Object.keys(previous.rig).every(key => current[key]), "Read every actual Rig expression and projection/ownership callback");
const candidateR = process.argv.includes("--candidate-r"), rig = candidateR ? previous.rig : current;
const cache = new Map<string, (scope: Record<string, unknown>) => any>();
function evaluate(text: string, scope: Record<string, unknown>) {
  if (!cache.has(text)) { const js = ts.transpileModule(`const result=(${text});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; cache.set(text, new Function("scope", `with(scope){${js};return result;}`) as never); }
  return cache.get(text)!(scope);
}
const projection = new Function("scope", `with(scope){${ts.transpileModule(rig.projection!, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}}`);
const oldPose = new Function("bounds", "layout", "centre", "viewportAspect", previous.oldPose) as (...args: any[]) => runtime.CameraPose;
const cameraTree = ts.createSourceFile("camera.ts", readFileSync("src/lib/pool/camera.ts", "utf8"), ts.ScriptTarget.Latest, true);
function protect(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text && node.name.text in previous.protectedHashes)
    equal(sha(node.getText(cameraTree)), previous.protectedHashes[node.name.text as keyof typeof previous.protectedHashes], "Approved Bordo Infinity front/coping subjects and front pose remain byte-for-byte unchanged");
  ts.forEachChild(node, protect);
}
protect(cameraTree);
equal(current.projection, previous.rig.projection, "Reuse exact existing projection/PhotoMode/Top handoff implementation");
equal(current.owner, previous.rig.owner, "Reuse exact existing ownership and cleanup implementation");
equal(current.coastal, previous.rig.coastal, "Infinity overview/review retains its approved coastal route");
const fiberPath = "node_modules/@react-three/fiber/dist/events-156d8d12.esm.js", fiber = ts.createSourceFile(fiberPath, readFileSync(fiberPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let updateText = "", orthographic = "";
function readFiber(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "updateCamera") updateText = node.getText(fiber); if (ts.isVariableDeclaration(node) && node.name.getText(fiber) === "isOrthographicCamera") orthographic = node.initializer!.getText(fiber); ts.forEachChild(node, readFiber); }
readFiber(fiber); ok(updateText && orthographic, "Read installed R3F updateCamera rather than mock its DPR behavior");
const updateCamera = new Function(`const isOrthographicCamera=${orthographic};return(${updateText});`)();
const dimensions = process.argv.includes("--mobile-repro") ? [[6, 3] as const] : [[6, 3], [8, 4], [12, 5]] as const;
for (const [length, width] of dimensions) {
  const outline = buildOutline("rectangle", { length, width, depth: 1.5, cornerRadius: 0 }, []), bounds = outlineBounds(outline);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "infinity", depth: 1.5, copingThickness: POOL_BORDER_PRESET.thickness });
  for (const zone of infinityZonesForOutline(outline, "rectangle").filter(zone => !process.argv.includes("--mobile-repro") || zone.side === 2))
    for (const wallType of process.argv.includes("--mobile-repro") ? ["traditional" as const] : ["traditional", "glass"] as const) {
      const config: PoolConfig = { projectType: "new", poolType: "in-ground", structure: "modular-steel-panels", shape: "rectangle", shapeSelected: true, customMode: "draw", controlPoints: [], dimensions: { length, width, depth: 1.5, cornerRadius: 0 }, system: "infinity", overflowType: "hidden", skimmerType: "slim", skimmerFinish: "white", finish: "liner", linerColor: "motionBlackStone799", copingMaterial: "prun", paving: "travertine", pavingFormat: "60x120", features: ["inoxLadder"], poolAccess: "internalSteps", internalStairType: "corner", equipment: ["automaticCover"], coverPosition: "closed", coverExtension: 1, infinityEdge: { enabled: true, side: zone.side, startT: 0, endT: 1, dropDirection: "outward", wallType }, sceneTime: "day", customer: DEFAULT_CUSTOMER, uploads: [] };
      const before = JSON.stringify(config), resolvedLayout = configuredPoolLayout(config), skimmers = planSkimmers(outline, length * width, true);
      equal(resolveAutomaticCover(config).geometry, null, "Requested but incompatible cover+inox does not invent an opaque cover/housing");
      const [nx, nz] = zone.normal, tx = (zone.end[0] - zone.start[0]) / zone.length, tz = (zone.end[1] - zone.start[1]) / zone.length;
      const midpoint = [(zone.start[0] + zone.end[0]) / 2, (zone.start[1] + zone.end[1]) / 2], span = Math.min(3.4, Math.max(2.2, zone.length * .42));
      const points: runtime.CameraPoint[] = [];
      // Actual crest film plus a short piece of adjacent basin water. No
      // imaginary full-height columns above every pool/receiver vertex.
      const lip = clampInfinityEdgeDimensions(undefined).lipWidth + .003; // Renderer film stand-off, not a fabricated structural offset.
      for (const along of [-span / 2, 0, span / 2]) {
        for (const inward of [0, -lip]) points.push([midpoint[0]! + tx * along - nx * inward, layout.waterY, midpoint[1]! + tz * along - nz * inward]);
        points.push([midpoint[0]! + tx * along, layout.waterY - .15, midpoint[1]! + tz * along]);
      }
      // The basin water is an entire plane, not a bounded accessory. Test
      // the near-crest central context, not invented full-span water corners
      // that lie nearer the eye than the deliberately framed crest segment.
      points.push([midpoint[0]! - nx * .08, layout.waterY, midpoint[1]! - nz * .08]);
      for (const [vw, vh] of process.argv.includes("--mobile-repro") ? [[1440, 900] as const] : [[1440, 900], [390, 844], [430, 932]] as const) {
        const scope: Record<string, unknown> = { ...runtime, outlineBounds, focus: "waterline", outline, layout, skimmers, resolvedLayout, infinityZone: zone, externalStairPlan: null, coverSubject: null, shelfLoungerEnvelope: [], ledRow: resolvedLayout.lighting.plan.positions, compactPlan: true, planBounds: outline, SCENE_VISUAL_PRESET, viewportSize: { width: vw, height: vh } };
        const preferred = evaluate(`(${rig.aspect})()`, scope);
        const ui = vw === 1440 ? previous.desktopUI : { canvas: { left: 0, top: 0, width: vw, height: vh }, overlays: [{ left: 8, top: 8, width: vw - 16, height: 108 }, { left: 12, top: 132, width: 131.9140625, height: 36 }, { left: vw - 209.078125, top: vw === 390 ? 293.515625 : 346.3125, width: 193.078125, height: 40 }, { left: 8, top: vw === 390 ? 365.515625 : 418.3125, width: vw - 16, height: vw === 390 ? 470.484375 : 505.6875 }] };
        const frame = runtime.visibleCameraFrame(ui.canvas, ui.overlays, preferred); scope.visibleFrame = frame;
        for (const [name, expression] of [["detail", rig.detail], ["localFraming", rig.local], ["opticalDetail", rig.optical], ["fitFov", rig.fit]]) scope[name!] = evaluate(expression!, scope);
        const args = { intent: "waterline" as const, outline, layout, depth: 1.5, skimmers, infinityZone: zone, verticalFov: scope.fitFov as number, viewportAspect: frame.width / frame.height };
        const raw = candidateR ? oldPose(bounds, layout, [0, 0], args.viewportAspect) : runtime.getCameraPose(args);
        const pose = !scope.localFraming && !scope.opticalDetail ? runtime.offsetCameraToFrame(raw, 34, vw, vh, frame) : raw;
        if (length === 6 && zone.side === 2 && wallType === "traditional" && vw === 1440) console.log(`Infinity waterline causal diagnostic, not visual PASS: ${JSON.stringify({ candidateR, raw, pose, frame, layout })}`);
        ok(pose.position[1] > layout.groundY && pose.position[1] > layout.waterY, "Real UI framing keeps the Infinity waterline eye above terrain/water, not under the opaque deck");
        equal(pose, raw, "Infinity waterline fitting never world-translates the physical installation viewpoint");
        for (let sample = 0; sample <= 20; sample++) {
          const t = sample / 20, x = pose.position[0] * (1 - t) + pose.target[0] * t, z = pose.position[2] * (1 - t) + pose.target[2] * t;
          ok(x > bounds.minX && x < bounds.maxX && z > bounds.minZ && z < bounds.maxZ, "Actual eye-to-target segment stays inside the basin, never through the opaque side or deck");
        }
        const targetOut = (pose.target[0] - midpoint[0]!) * nx + (pose.target[2] - midpoint[1]!) * nz;
        ok(targetOut < 0 && targetOut > -.2, "The selected waterline target is next to the actual selected Infinity crest, not arbitrary pool centre");
        ok(scope.localFraming && scope.fitFov === 34, "Infinity waterline uses the existing local34-degree lens and scoped projection ownership");
        const camera = new PerspectiveCamera(34, vw / vh, .05, 1000); camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
        Object.assign(scope, { camera, PerspectiveCamera, OrthographicCamera, canvas: { dataset: {} }, pose, planFit: { current: null }, coastalHero: false }); projection(scope);
        const project = () => { for (const point of points) { const q = new Vector3(...point).project(camera), x = (q.x + 1) * vw / 2, y = (1 - q.y) * vh / 2; ok(q.z > -1 && q.z < 1 && x > frame.left && x < frame.left + frame.width && y > frame.top && y < frame.top + frame.height, `Actual selected crest and adjacent water remain inside the unobscured optical frame: ${JSON.stringify({ length, width, side: zone.side, wallType, viewport: [vw, vh], point, pixel: [x, y], frame, pose })}`); } }; project();
        for (const previousManual of [undefined, false, true]) {
          const owned = camera as PerspectiveCamera & { manual?: boolean }; if (previousManual !== undefined) owned.manual = previousManual; else delete owned.manual;
          const cleanup = evaluate(rig.owner, scope)(), matrix = camera.projectionMatrix.toArray(); updateCamera(camera, { width: vw, height: vh }); equal(camera.projectionMatrix.toArray(), matrix, "Installed R3F DPR/resize preserves the owned waterline inset"); project(); cleanup?.(); equal(owned.manual, previousManual, "Exiting waterline restores absent/false/true ownership correctly");
        }
        for (const focus of ["infinity", "coping", "review", "overview", "access", "inox", "shelf", "hydromassage", "bench", "features", "stair-lighting", "bench-lighting", "top", "depth", "paving", "liner", "mosaic", "cover"]) {
          const values = { ...scope, focus }; equal(evaluate(`(${current.aspect})()`, values), evaluate(`(${previous.rig.aspect})()`, values), "Other approved Infinity subjects retain their exact pre-S frame aspect"); equal(evaluate(current.local!, values), evaluate(previous.rig.local, values), "Other approved Infinity intents retain their exact pre-S ownership/lens route");
        }
        equal(JSON.stringify(config), before, "Camera work does not change saved technical configuration or optional compatibility"); cases++;
      }
    }
}
console.log(`Infinity waterline: ${checks} assertions / ${cases} cases PASS (offline; wet visibility is a separate browser gate)`);
