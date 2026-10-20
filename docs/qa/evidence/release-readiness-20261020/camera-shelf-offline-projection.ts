import { PerspectiveCamera, Vector3 } from "three";
import { writeFileSync } from "node:fs";
import { buildOutline } from "../../../../src/lib/pool/geometry";
import { configuredPoolLayout } from "../../../../src/lib/pool/resolved-layout";
import { configuredSunShelfLoungers, SUN_SHELF_LOUNGER_MODEL } from "../../../../src/lib/pool/sun-shelf-loungers";
import { sunShelfCameraSubject, componentCameraAspect, visibleCameraFrame, contextualAccessCamera } from "../../../../src/lib/pool/camera";
import { getPoolVerticalLayout } from "../../../../src/lib/pool/vertical-layout";
import { DEFAULT_CUSTOMER } from "../../../../src/lib/pool/config";
import type { PoolConfig } from "../../../../src/lib/pool/types";

const fixtures = [
  { name: "E430", width: 430, height: 932, toolbarLeft: 221, toolbarTop: 311, dockTop: 383.2 },
  { name: "E390", width: 390, height: 844, toolbarLeft: 181, toolbarTop: 258.4, dockTop: 330.4 },
];
const output: unknown[] = [];
const previousPoses = new Map<string, NonNullable<ReturnType<typeof contextualAccessCamera>>>();
for (const fixture of fixtures) for (const run of [3.035, 3.2, 5.6]) {
  const config: PoolConfig = {
    projectType: "new", poolType: "in-ground", structure: "reinforced-concrete", shape: "rectangle", shapeSelected: true,
    customMode: "draw", controlPoints: [], dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0, sunShelfRun: run },
    system: "skimmer", overflowType: "hidden", skimmerFinish: "white", skimmerType: "slim", finish: "liner", linerColor: "motionSandBeach179",
    mosaicFinish: "default", copingMaterial: "travertine", features: ["sunShelf", "sunShelfLoungers"], sunShelfLoungerCount: 2,
    poolAccess: "internalSteps", internalStairType: "linear", equipment: [], customer: DEFAULT_CUSTOMER, uploads: [],
  };
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const resolved = configuredPoolLayout(config);
  const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "skimmer", overflowType: "hidden", depth: 1.5, copingThickness: 0.04 });
  const loungers = configuredSunShelfLoungers(config);
  const loungerPoints = loungers.placements.map(placement => placement.footprint.flatMap(([x, z]) =>
    [placement.y, placement.y + SUN_SHELF_LOUNGER_MODEL.height].map(y => [x, y, z] as const)));
  const envelope = loungerPoints.flat();
  const subject = sunShelfCameraSubject(resolved, layout, outline, envelope)!;
  const preferredAspect = componentCameraAspect(subject.points, subject.direction);
  const canvas = { left: 0, top: 0, width: fixture.width, height: fixture.height };
  const overlays = [
    { left: 0, top: 0, width: fixture.width, height: 127 },
    { left: 12, top: 143, width: 132, height: 36 },
    { left: fixture.width - 174, top: 143, width: 162, height: 35 },
    { left: fixture.toolbarLeft, top: fixture.toolbarTop, width: 193, height: 40 },
    { left: 0, top: fixture.dockTop, width: fixture.width, height: fixture.height - 8 - fixture.dockTop },
  ];
  const frame = visibleCameraFrame(canvas, overlays, preferredAspect);
  const pose = contextualAccessCamera("shelf", resolved, layout, outline, 34, frame.width / frame.height, null, envelope)!;
  if (run === 3.2) previousPoses.set(fixture.name, pose);
  const makeCamera = (chosenPose = pose) => {
    const camera = new PerspectiveCamera(34, fixture.width / fixture.height, 0.05, 500);
    camera.position.set(...chosenPose.position); camera.lookAt(new Vector3(...chosenPose.target)); camera.updateMatrixWorld(true);
    camera.setViewOffset(frame.width, frame.height, -frame.left, -frame.top, fixture.width, fixture.height);
    return camera;
  };
  const bounds = (points: readonly (readonly [number, number, number])[], camera: PerspectiveCamera) => {
    const pixels = points.map(point => new Vector3(...point).project(camera)).map(point => ({ x: (point.x + 1) * fixture.width / 2, y: (1 - point.y) * fixture.height / 2, z: point.z }));
    return { left: Math.min(...pixels.map(p => p.x)), right: Math.max(...pixels.map(p => p.x)), top: Math.min(...pixels.map(p => p.y)), bottom: Math.max(...pixels.map(p => p.y)),
      outsideFrame: pixels.filter(p => p.x < frame.left || p.x > frame.left + frame.width || p.y < frame.top || p.y > frame.top + frame.height).length };
  };
  const camera = makeCamera();
  const intended = { subject: bounds(subject.points, camera), loungers: loungerPoints.map(points => bounds(points, camera)) };
  // Counterfactual diagnostic only: distinguish a full-canvas aspect overwrite from the real tested inset.
  const overwritten = makeCamera(); overwritten.aspect = fixture.width / fixture.height; overwritten.updateProjectionMatrix();
  output.push({ fixture: fixture.name, run, count: loungers.count, preferredAspect, frame, pose, intended,
    counterfactualFullCanvasAspectOverwrite: bounds(subject.points, overwritten),
    ...(run === 5.6 ? { counterfactualStalePose3_2: { subject: bounds(subject.points, makeCamera(previousPoses.get(fixture.name)!)),
      loungers: loungerPoints.map(points => bounds(points, makeCamera(previousPoses.get(fixture.name)!))) } } : {}) });
}
writeFileSync(new URL("./camera-shelf-offline-projection.json", import.meta.url), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
