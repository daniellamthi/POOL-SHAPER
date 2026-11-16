import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
import { projectBookHeroFrame } from "../src/lib/project-delivery/hero-frame";
import { accessCameraSubject, externalStairCameraSubject, getCameraPose, overviewCameraSubject } from "../src/lib/pool/camera";
import { buildOutline } from "../src/lib/pool/geometry";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { planExternalStaircase } from "../src/components/pool/three/externalStaircasePlan";
import { copingOuterOffset } from "../src/components/pool/three/poolConstruction";
import { DEFAULT_CUSTOMER, DIMENSION_LIMITS } from "../src/lib/pool/config";
import { POOL_BORDER_PRESET } from "../src/configurator/materials/visual-presets";
import type { CameraPoint } from "../src/lib/pool/camera";
import type { PoolConfig } from "../src/lib/pool/types";

let checks = 0, cases = 0, unavailableSides = 0, beforeClippedCases = 0, metricPointsChecked = 0;
const check = (value: unknown, message: string) => { assert(value, message); checks++; };
const close = (a: number, b: number) => Math.abs(a - b) < 1e-8;
const viewports = [[1440, 900], [1440, 419], [390, 844], [430, 932], [932, 430]] as const;
const lengths = Array.from({ length: DIMENSION_LIMITS.length.max - DIMENSION_LIMITS.length.min + 1 }, (_, i) => DIMENSION_LIMITS.length.min + i);
const widths = Array.from({ length: DIMENSION_LIMITS.width.max - DIMENSION_LIMITS.width.min + 1 }, (_, i) => DIMENSION_LIMITS.width.min + i);
const depths = [DIMENSION_LIMITS.depth.min, 1.15, DIMENSION_LIMITS.depth.max];
const repro: unknown[] = [];
let minimumFixedMarginPx = Infinity;

for (const [width, height] of viewports) {
  const frame = projectBookHeroFrame(width, height);
  check(close(frame.width / frame.height, 297 / 150), "Export source rectangle retains cover aspect");
  check(close(frame.left * 2 + frame.width, width) && close(frame.top * 2 + frame.height, height), "Export rectangle is centred");
  check(frame.left >= 0 && frame.top >= 0 && frame.left + frame.width <= width + 1e-8 && frame.top + frame.height <= height + 1e-8, "Crop remains inside its source");
  for (const dpr of [1, 1.25, 2, 3]) {
    const physical = projectBookHeroFrame(width * dpr, height * dpr);
    check((Object.keys(frame) as (keyof typeof frame)[]).every(key => close(physical[key] / dpr, frame[key])), "CSS camera rectangle and physical-pixel crop match at every sampled DPR");
  }
}

function metricTreads(plan: NonNullable<ReturnType<typeof planExternalStaircase>>, groundY: number, topY: number): CameraPoint[] {
  const points: CameraPoint[] = [];
  const c = Math.cos(plan.rotation), s = Math.sin(plan.rotation);
  const surface = (y: number, z: number, depth: number) => {
    for (const x of [-plan.width / 2, plan.width / 2]) for (const localZ of [z - depth / 2, z + depth / 2]) for (const localY of [y - 0.03, y])
      points.push([plan.x + c * x + s * localZ, localY, plan.z - s * x + c * localZ]);
  };
  surface(topY, 0, plan.landingDepth);
  // Same metre-valued walking surfaces as ExternalStaircase, not a scaled proxy.
  for (let level = 1; level < plan.stepCount; level++)
    surface(groundY + plan.rise * level, plan.landingDepth / 2 + (plan.stepCount - level - 0.5) * plan.treadDepth, plan.treadDepth);
  return points;
}

for (const length of lengths) for (const width of widths) for (const depth of depths) {
  const config: PoolConfig = {
    projectType: "new", poolType: "above-ground", structure: "reinforced-concrete", shape: "rectangle", shapeSelected: true,
    customMode: "draw", controlPoints: [], dimensions: { length, width, depth, cornerRadius: 0, floorProfile: "flat" },
    system: "skimmer", overflowType: "hidden", skimmerFinish: "white", skimmerType: "slim", finish: "liner", linerColor: "motionSandBeach179",
    mosaicFinish: "default", copingMaterial: "travertine", features: ["externalStaircase"], poolAccess: "internalSteps", internalStairType: "corner",
    externalStairPlatformExtended: true, equipment: [], customer: DEFAULT_CUSTOMER, uploads: [],
  };
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const layout = getPoolVerticalLayout({ poolType: "above-ground", system: "skimmer", overflowType: "hidden", depth, copingThickness: POOL_BORDER_PRESET.thickness });
  const resolved = configuredPoolLayout(config);
  for (const side of ["long", "short"] as const) {
    const stairs = planExternalStaircase({ outline, side, platformExtended: true, groundY: layout.groundY, topY: layout.copingY,
      copingOffset: copingOuterOffset("skimmer", "hidden"), accessAnchor: resolved.access.placement });
    if (!stairs) { unavailableSides++; continue; }
    const exterior = externalStairCameraSubject(stairs, layout);
    const metric = metricTreads(stairs, layout.groundY, layout.copingY);
    const subject = overviewCameraSubject(outline, layout, {
      outset: copingOuterOffset("skimmer", "hidden") + 0.15, baseY: layout.groundY, entrance: resolved.access.placement,
      accessories: [...(accessCameraSubject(resolved.access, layout, outline)?.points ?? []), ...exterior.points],
      exteriorDirection: exterior.direction,
    });
    for (const [canvasWidth, canvasHeight] of viewports) {
      const crop = projectBookHeroFrame(canvasWidth, canvasHeight);
      const pixelBounds = (points: readonly CameraPoint[], camera: PerspectiveCamera) => {
        const pixels = points.map(point => new Vector3(...point).project(camera));
        const x = pixels.map(point => (point.x + 1) * canvasWidth / 2), y = pixels.map(point => (1 - point.y) * canvasHeight / 2);
        const margins = x.flatMap((value, i) => [value - crop.left, crop.left + crop.width - value, y[i]! - crop.top, crop.top + crop.height - y[i]!]);
        return { left: Math.min(...x), right: Math.max(...x), top: Math.min(...y), bottom: Math.max(...y),
          outsideCrop: pixels.filter((point, i) => x[i]! < crop.left - 1e-8 || x[i]! > crop.left + crop.width + 1e-8 || y[i]! < crop.top - 1e-8 || y[i]! > crop.top + crop.height + 1e-8 || point.z < -1 || point.z > 1).length,
          minimumMarginPx: Math.min(...margins) };
      };
      const project = (fixed: boolean) => {
        const frame = fixed ? crop : { left: 0, top: 0, width: canvasWidth, height: canvasHeight };
        const pose = getCameraPose({ intent: "review", outline, layout, depth, skimmers: { positions: [], count: 0 } as never,
          verticalFov: 34, viewportAspect: frame.width / frame.height, overviewSubject: subject });
        const camera = new PerspectiveCamera(34, canvasWidth / canvasHeight, 0.05, 500);
        camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
        // Exact non-Infinity localFraming projection in CameraRig.
        camera.setViewOffset(frame.width, frame.height, -frame.left, -frame.top, canvasWidth, canvasHeight);
        return { completeSubject: pixelBounds(subject.points, camera), exteriorEnvelope: pixelBounds(exterior.points, camera), metricTreads: pixelBounds(metric, camera) };
      };
      const before = project(false), after = project(true); cases++;
      if (before.exteriorEnvelope.outsideCrop || before.metricTreads.outsideCrop) beforeClippedCases++;
      check(after.completeSubject.outsideCrop === 0, `Whole configured subject survives crop: ${length}×${width}×${depth} ${side} ${canvasWidth}×${canvasHeight}`);
      check(after.exteriorEnvelope.outsideCrop === 0 && after.metricTreads.outsideCrop === 0, "Every metric tread/landing and complete external stair/guard envelope survives actual source crop");
      metricPointsChecked += metric.length;
      minimumFixedMarginPx = Math.min(minimumFixedMarginPx, after.completeSubject.minimumMarginPx, after.exteriorEnvelope.minimumMarginPx, after.metricTreads.minimumMarginPx);
      if (length === 8 && width === 4 && depth === 1.5 && canvasWidth === 430 && canvasHeight === 932) {
        check(before.exteriorEnvelope.outsideCrop > 0 || before.metricTreads.outsideCrop > 0, "Known portrait regression must fail under the former full-canvas fit");
        repro.push({ dimensions: [length, width, depth], side, internalAccess: "corner", viewport: [canvasWidth, canvasHeight], crop, before, after });
      }
    }
  }
}
const scene = readFileSync("src/components/pool/three/PoolScene.tsx", "utf8");
check(scene.includes("cleanCapture ? projectBookHeroFrame(viewportSize.width, viewportSize.height) : visibleCameraFrame("), "Shared export rectangle is scoped to clean capture; ordinary camera framing stays unchanged");
const cropSource = scene.slice(scene.indexOf("function cropHero("), scene.indexOf("function DevelopmentRendererMetrics("));
check(cropSource.includes("projectBookHeroFrame(width, height)") && cropSource.includes("frame.left") && cropSource.includes("frame.top") && cropSource.includes("frame.width") && cropSource.includes("frame.height"), "Capture uses the same source rectangle as the camera, not an independent late crop");
check(beforeClippedCases > 0 && repro.length === 2, "Regression distinguishes former full-canvas fit from corrected source-crop fit");
const result = { status: "PASS", checks, cases, metricPointsChecked, beforeClippedCases, unavailableSides, minimumFixedMarginPx,
  coverage: "All integer-metre length3–25/width2–12 combinations, depths0.8/1.15/1.5, both valid external sides, five portrait/landscape viewports; not every0.1m slider tick", repro,
  limitation: "Offline geometric projection and crop plumbing only; not a new PDF/browser capture, cloud verification, or performance PASS." };
const evidence = process.argv.find(argument => argument.startsWith("--evidence="))?.slice("--evidence=".length);
if (evidence) writeFileSync(evidence, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
