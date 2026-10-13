import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { PAVING, PAVING_FORMATS, pavingFormats, pavingLayout, pavingFormatId } from "../src/lib/pool/presentation";
import { createPavingModules, createPavingOnSurface } from "../src/components/pool/three/pavingGeometry";
import { createInfinityDeck } from "../src/components/pool/three/infinityLandscape";
import { studioDeckBand, studioDeckInnerOffset } from "../src/components/pool/three/studioDeck";
import { buildOutline, offsetOutline } from "../src/lib/pool/geometry";
import { pointInBasin } from "../src/lib/pool/boundary-placement";
import { infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { configuratorTesting } from "../src/lib/pool/store";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "../src/lib/pool/project";
import { shareableProject } from "../src/lib/project-delivery/service";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { createPhotoSceneSpec } from "../src/lib/pool/photo-scene-spec";
import { decisions } from "../src/components/pool/wizard/decisions";
import type { PoolConfig } from "../src/lib/pool/types";
import { samplePavingWood, samplePavingGres, WOOD_GRAIN_SCALE } from "../src/components/pool/three/pavingTexture";
import { ShaderLib, type WebGLProgramParametersWithUniforms } from "three";

let checks = 0, cases = 0, maxVertices = 0, maxMs = 0;
const equal = (a: unknown, b: unknown, label: string) => { assert.deepEqual(a, b, label); checks++; };
const ok = (v: unknown, label: string) => { assert.ok(v, label); checks++; };
const initial = configuratorTesting.createInitialState();
const base: PoolConfig = { ...initial.config, projectType: "new", poolType: "in-ground", shape: "rectangle", shapeSelected: true, system: "skimmer" };
equal(pavingFormatId("prun"), "50x100", "Prun default");
for (const id of ["gres", "limestone", "travertine"]) equal(pavingFormatId(id), "60x120", "stone default");
equal(pavingFormatId("wpc"), "wpc-140x2200", "WPC reference");
equal(pavingFormatId("gres", "50x50"), "60x120", "invalid/legacy format recovers safely");
const shader = { fragmentShader: ShaderLib.standard.fragmentShader } as WebGLProgramParametersWithUniforms;
samplePavingWood(shader);
ok(shader.fragmentShader.includes("pavingWoodUv(vMapUv)") && shader.fragmentShader.includes("pavingWoodUv(vNormalMapUv)") &&
  shader.fragmentShader.includes("pavingWoodUv(vRoughnessMapUv)"), "same wood grain coordinates for all maps");
equal(WOOD_GRAIN_SCALE, 0.057 / 0.14, "isotropic wood texels per metre");
const gresShader = { fragmentShader: ShaderLib.standard.fragmentShader } as WebGLProgramParametersWithUniforms;
samplePavingGres(gresShader);
ok(["vMapUv", "vNormalMapUv", "vRoughnessMapUv"].every(uv => gresShader.fragmentShader.includes(`pavingGresUv(${uv})`)), "same mineral coordinates for every gres map");

for (const p of PAVING) for (const f of pavingFormats(p.id)) {
  const state = configuratorTesting.reducer({ ...initial, config: base }, { type: "setPaving", value: p.id });
  const selected = configuratorTesting.reducer(state, { type: "setPavingFormat", value: f });
  equal(selected.config.paving, p.id, "format never changes material");
  equal(selected.config.copingMaterial, base.copingMaterial, "coping remains independent");
  equal(selected.config.mosaicFinish, base.mosaicFinish, "interior mosaic untouched");
  const project = toProjectConfiguration("paving-audit", selected.config, initial.renovation);
  const restored = parseProjectConfiguration(serializeProjectConfiguration(project))!;
  equal(restored.config.pavingFormat, f, "saved format restored");
  equal(shareableProject(restored).config.pavingFormat, f, "share/copy whitelist retains format");
  equal(createPhotoSceneSpec(restored).paving.module, PAVING_FORMATS[f].module, "photo spec module");
  ok(buildProjectSummary(restored).sections.some(s => s.rows.some(r => r.label === "Formato pavimentazione" && r.value === PAVING_FORMATS[f].label)), "PDF/quote summary format");
  for (const [length, width] of [[6,3], [8,4], [12,5]] as const)
  for (const kind of ["skimmer", "overflow-visible", "overflow-hidden", "infinity", "above-skimmer", "above-overflow"] as const) {
    const poolType = kind.startsWith("above") ? "above-ground" : "in-ground";
    const system = kind === "infinity" ? "infinity" : kind.includes("overflow") ? "overflow" : "skimmer";
    const overflowType = kind === "overflow-hidden" ? "hidden" : "visible";
    const config = { ...selected.config, poolType, system, overflowType, dimensions: { ...base.dimensions, length, width } } as PoolConfig;
    ok(decisions("deck", config).some(d => d.id === "paving"), "paving available for every product system");
    const outline = buildOutline("rectangle", config.dimensions), layout = pavingLayout(p.id, f);
    const inner = offsetOutline(outline, studioDeckInnerOffset(poolType, system, overflowType));
    const zones = system === "infinity" ? infinityZonesForOutline(outline) : [null];
    for (const zone of zones) {
      const start = performance.now();
      const source = zone ? createInfinityDeck(outline, zone, studioDeckInnerOffset(poolType, system, overflowType)) : null;
      const geometry = source ? createPavingOnSurface(source, layout.module, layout) :
        createPavingModules(inner, offsetOutline(inner, studioDeckBand(outline, true)), layout.module, layout);
      maxMs = Math.max(maxMs, performance.now() - start);
      const pos = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
      maxVertices = Math.max(maxVertices, pos.count);
      equal(geometry.userData["paving"].module, PAVING_FORMATS[f].module, "fixed metres after resize");
      for (let i = 0; i < pos.count; i += 3) {
        const top = [0,1,2].every(j => Math.abs(pos.getY(i+j)) < 1e-6);
        const cx = (pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3;
        const cz = (pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3;
        ok(!top || !pointInBasin(cx,cz, outline), "no paving over water");
        for (let j=0;j<3;j++) {
          ok([pos.getX(i+j),pos.getY(i+j),pos.getZ(i+j),uv.getX(i+j),uv.getY(i+j)].every(Number.isFinite), "finite geometry/UV");
          ok(top ? normals.getY(i+j) > .99 : Math.abs(normals.getY(i+j)) < 1e-5, `top/edge normals ${p.id}/${f}/${kind}/${length} at ${i+j}: top=${top}, n=${normals.getY(i+j)}`);
          ok(pos.getY(i+j) <= 1e-6 && pos.getY(i+j) >= -layout.thickness - 1e-6, "metric thickness");
        }
      }
      source?.dispose(); geometry.dispose(); cases++;
    }
  }
}
console.log(JSON.stringify({ status: "PASS", checks, cases, maxVertices, maxGeometryBuildMs: Math.round(maxMs), drawCallsForModules: 1 }));
