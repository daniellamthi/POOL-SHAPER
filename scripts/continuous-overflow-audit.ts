import assert from "node:assert/strict";
import { configuratorTesting } from "../src/lib/pool/store";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { buildOutline, buildWaterOutline } from "../src/lib/pool/geometry";
import { studioDeckInnerOffset } from "../src/components/pool/three/studioDeck";
import { createPavingModules } from "../src/components/pool/three/pavingGeometry";
import { offsetOutline } from "../src/lib/pool/geometry";
import { pavingLayout, PAVING } from "../src/lib/pool/presentation";
import { toProjectConfiguration, serializeProjectConfiguration, parseProjectConfiguration } from "../src/lib/pool/project";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { createPhotoSceneSpec } from "../src/lib/pool/photo-scene-spec";
import { leadSubmissionInputSchema } from "../src/lib/lead/schema";
import { planSkimmers } from "../src/lib/pool/engineering";
import { overflowCameraSubject, getCameraPose } from "../src/lib/pool/camera";
import { PerspectiveCamera, Vector3 } from "three";
import { projectMetrics } from "../src/lib/pool/project-metrics";
import { formatLeadEmail } from "../src/lib/lead/formatLeadEmail";
import { concealedOverflowSection } from "../src/components/pool/three/poolConstruction";
import { createBeveledRingGeometry } from "../src/components/pool/three/poolGeometry";
import { integratedCoping, copingEdgeRadius } from "../src/lib/pool/coping-style";
import { copingOuterOffset } from "../src/components/pool/three/poolConstruction";
import { OVERFLOW_GEOMETRY } from "../src/lib/pool/config";

let checks = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
const initial = configuratorTesting.createInitialState();
const base = { ...initial.config, projectType: "new" as const, poolType: "in-ground" as const,
  structure: "reinforced-concrete" as const, shape: "rectangle" as const, shapeSelected: true,
  system: "overflow" as const, overflowType: "continuous" as const, features: [], equipment: [] };
for (const [length, width] of [[6,3],[8,4],[12,5]]) {
  for (const material of PAVING) {
    const config = { ...base, dimensions: { ...base.dimensions, length, width, depth: 1.5 }, paving: material.id };
    const vertical = getPoolVerticalLayout({ poolType: "in-ground", system: config.system,
      overflowType: config.overflowType, depth: 1.5, copingThickness: 0.04 });
    check(vertical.copingY === 0 && vertical.waterY < -0.03 && vertical.waterY > -0.08, "flush deck and recessed water");
    check(vertical.waterY > vertical.wallTopY && vertical.floorY === -1.5, "water overtops collector crest, unchanged floor datum");
    const outline = buildOutline(config.shape, config.dimensions, []);
    const metrics = projectMetrics(config, outline);
    check(Math.abs(metrics.waterVolume - length * width * (1.5 + vertical.waterY)) < 1e-6, "volume respects actual recessed water level");
    check(Math.abs(metrics.wallSurface - 2 * (length + width) * (1.5 + vertical.wallTopY)) < 1e-6, "wall surfaces respect collector crest");
    check(studioDeckInnerOffset("in-ground", "overflow", "continuous") === 0, "deck reaches basin without separate ring");
    const layout = pavingLayout(config.paving);
    const mesh = createPavingModules(outline, offsetOutline(outline, 1.2), layout.module, layout);
    mesh.computeBoundingBox();
    check(Math.abs(mesh.boundingBox!.max.y) < 1e-6 && Math.abs(mesh.boundingBox!.min.y + layout.thickness) < 1e-6, "actual slab top/soffit");
    check([...mesh.getAttribute("position").array].every(Number.isFinite), "no degenerate/nonfinite vertices");
    mesh.dispose();
    const skimmers = planSkimmers(outline, length * width, false);
    check(skimmers.positions.length === 0, "no skimmer geometry planned");
    const camera = overflowCameraSubject("overflow-continuous", outline, vertical, skimmers);
    check(camera.points.flat().every(Number.isFinite), "parametric camera bounds");
    check(buildWaterOutline(outline, "overflow", "continuous").length === outline.length, "continuous water under concealed intake");
    const project = toProjectConfiguration("continuous-overflow-qa", config, initial.renovation);
    const restored = parseProjectConfiguration(serializeProjectConfiguration(project));
    check(restored.config.overflowType === "continuous" && restored.config.paving === material.id, "snapshot roundtrip retains subtype/material");
    const summary = buildProjectSummary(restored);
    check(JSON.stringify(summary).includes("Sfioro nascosto"), "summary and PDF model identify renamed subtype without changing ID");
    const spec = createPhotoSceneSpec(restored);
    check(spec.pool.technicalConfiguration.continuousEdge?.paving.id === material.id, "photo spec has same edge/paving");
    const lead = leadSubmissionInputSchema.safeParse({ customer: {name:"QA",email:"qa@example.invalid",phone:"00000000",projectLocation:"QA"},
      commercial:{timing:"evaluating",notes:"Local validation only"},privacy:{accepted:true,marketingConsent:false},idempotencyKey:"continuous-local-qa",project:restored });
    check(lead.success, "quote server validation accepts full snapshot");
    if (lead.success) {
      const email = formatLeadEmail({ ...lead.data, requestId: "local-qa", projectId: project.projectId,
        schemaVersion: 1, createdAt: "2026-10-21T12:00:00Z", attachments: [] });
      check(email.text.includes(`Bordo/coping: ${layout.label} — bordo a filo`), "commercial notification uses actual paving at edge");
    }
  }
}
let state: ReturnType<typeof configuratorTesting.createInitialState> = { ...initial, config: base };
state = configuratorTesting.reducer(state, { type: "setOverflowType", value: "visible" });
state = configuratorTesting.reducer(state, { type: "setOverflowType", value: "continuous" });
check(state.config.copingMaterial === base.copingMaterial && state.config.linerColor === base.linerColor, "other selections retained");
state = configuratorTesting.reducer(state, { type: "setPoolType", value: "above-ground" });
check(state.config.overflowType === "hidden", "above-ground retains supported concealed section");
state = configuratorTesting.reducer(state, { type: "setOverflowType", value: "continuous" });
check(state.config.overflowType === "hidden", "ground-level system not enabled on raised basin");
const incompatible = toProjectConfiguration("invalid-combination", { ...base, poolType: "above-ground" }, initial.renovation);
check(incompatible.config.overflowType === "hidden", "snapshot creation normalizes unsupported raised continuous edge");
incompatible.config.overflowType = "continuous";
check(parseProjectConfiguration(JSON.stringify(incompatible)).config.overflowType === "hidden", "restore normalizes unsupported raised continuous edge");
for (const system of ["skimmer","infinity"] as const) {
  const before = getPoolVerticalLayout({poolType:"in-ground",system,overflowType:"hidden",depth:1.5,copingThickness:.04});
  const after = getPoolVerticalLayout({poolType:"in-ground",system,overflowType:"continuous",depth:1.5,copingThickness:.04});
  check(JSON.stringify(before) === JSON.stringify(after), `${system} unaffected by dormant subtype`);
}
for (const shape of ["rectangle", "l-shape", "custom"] as const) {
  const controlPoints: [number,number][] = [[-4,-2],[4,-2],[4,1],[2,2],[-4,2]];
  const config = { ...base, shape, controlPoints, dimensions: { ...base.dimensions,
    length: 8, width: 4, depth: 1.5, lShapeRecessLength: 3, lShapeRecessWidth: 1.5 } };
  const outline = buildOutline(shape, config.dimensions, controlPoints);
  const layout = getPoolVerticalLayout({poolType:"in-ground",system:"overflow",overflowType:"continuous",depth:1.5,copingThickness:.04});
  const skimmers = planSkimmers(outline, 32, false);
  const subject = overflowCameraSubject("overflow-continuous", outline, layout, skimmers);
  const tile = pavingLayout("reference-avorio");
  const mesh = createPavingModules(outline, offsetOutline(outline,1.2), tile.module, tile);
  check([...mesh.getAttribute("position").array].every(Number.isFinite), `${shape}: continuous terrace finite`);
  mesh.dispose();
  check(Number.isFinite(projectMetrics(config,outline).waterVolume), `${shape}: metrics finite`);
  for (const [width,height] of [[1440,900],[390,844],[430,932]]) {
    const pose = getCameraPose({intent:"overflow-continuous",outline,layout,depth:1.5,skimmers,verticalFov:35,viewportAspect:width/height});
    const camera = new PerspectiveCamera(35,width/height,.05,1000);
    camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
    check(subject.points.every(point => { const q = new Vector3(...point).project(camera);
      return Math.abs(q.x) < 1 && Math.abs(q.y) < 1 && q.z > -1 && q.z < 1;
    }), `${shape}/${width}: intake, water and paving fit camera frustum`);
  }
}
for (const [length,width] of [[6,3],[8,4],[12,5]]) {
  const layout = getPoolVerticalLayout({poolType:"in-ground",system:"overflow",overflowType:"hidden",depth:1.5,copingThickness:.04});
  const section = concealedOverflowSection(layout.wallTopY,.04);
  const outline = buildOutline("rectangle",{...base.dimensions,length,width,depth:1.5},[]);
  const lip = createBeveledRingGeometry(outline,offsetOutline(outline,OVERFLOW_GEOMETRY.waterEdgeOffset),.003,3);
  lip.computeBoundingBox();
  check(Math.abs(lip.boundingBox!.max.y + section.intakeTopY - layout.groundY) < 1e-9, "actual hidden intake crest flush with terrace");
  check(section.channelFloorY < section.intakeTopY && section.slotWidth > 0, "collector retains depth and open intake");
  check(layout.waterY > section.intakeTopY && layout.waterY - section.intakeTopY <= .00101, "thin water film overtops flush intake");
  lip.dispose();
}
const raised = getPoolVerticalLayout({poolType:"above-ground",system:"overflow",overflowType:"hidden",depth:1.5,copingThickness:.04});
check(Math.abs(raised.waterY - (raised.wallTopY - OVERFLOW_GEOMETRY.hiddenWaterTopClearance)) < 1e-9, "raised hidden overflow remains unchanged");
for (const [id, label] of [["hidden", "Sfioro a bordo continuo"], ["continuous", "Sfioro nascosto"]] as const) {
  const snapshot = toProjectConfiguration("renamed-overflow-qa", {...base, overflowType:id}, initial.renovation);
  const restored = parseProjectConfiguration(serializeProjectConfiguration(snapshot));
  check(restored.config.overflowType === id, "commercial rename preserves saved technical identity");
  check(JSON.stringify(buildProjectSummary(restored)).includes(label), "PDF and summary follow swapped commercial labels");
}
for (const copingStyle of [undefined, "dedicated", "flush"] as const) {
  const edge = {poolType:"in-ground", system:"overflow", overflowType:"continuous", copingStyle} as const;
  check(integratedCoping(edge), "concealed edge always uses the paving, including stored dedicated style");
  check(copingOuterOffset(edge.system, edge.overflowType, copingStyle) === 0, "no separate coping band");
  check(studioDeckInnerOffset(edge.poolType, edge.system, edge.overflowType, copingStyle) === 0, "paving reaches the actual basin outline");
  check(copingEdgeRadius(edge) === .006, "rounded paving nose retained");
  check(getPoolVerticalLayout({...edge, depth:1.5, copingThickness:.055}).copingY === 0, "single ground-level paving datum");
}
check(!integratedCoping({poolType:"in-ground",system:"skimmer",overflowType:"continuous"}), "Skimmer stays unchanged");
check(!integratedCoping({poolType:"in-ground",system:"overflow",overflowType:"hidden"}), "other continuous-stone overflow stays unchanged");
check(!integratedCoping({poolType:"above-ground",system:"overflow",overflowType:"continuous"}), "raised pools stay unchanged");
console.log(`Continuous overflow: ${checks} checks PASS (local; no cloud writes or emails).`);
