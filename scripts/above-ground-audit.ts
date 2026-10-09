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
import { copingOuterOffset, createGrateGeometry } from "../src/components/pool/three/poolConstruction";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { EQUIPMENT } from "../src/lib/pool/config";
import type { PoolConfig } from "../src/lib/pool/types";
import { describeSelection, needsOverflowType } from "../src/components/pool/wizard/wizard-model";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { pointInBasin } from "../src/lib/pool/boundary-placement";
import { pellicanoCurve, createPellicanoSpoutGeometry } from "../src/components/pool/three/Pellicano";
import { createExternalStairEnclosureGeometry, createExternalStairGuardPostGeometry } from "../src/components/pool/three/ExternalStaircase";
import { BufferGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { rectangularCornerTread, stairSolid } from "../src/components/pool/three/PoolAccessModel";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { planSkimmers } from "../src/lib/pool/engineering";
import { ACCESS_DIMENSIONS } from "../src/components/pool/three/PoolAccessModel";

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
const isClosed = (geometry: BufferGeometry) => {
  const p=geometry.getAttribute("position"),index=geometry.getIndex(),edges=new Map<string,number>();
  const vertex=(i:number) => [p.getX(i),p.getY(i),p.getZ(i)].map(value=>Math.round(value*1e5)).join(",");
  const count=index?.count??p.count;
  for(let i=0;i<count;i+=3) {
    const triangle=[0,1,2].map(k=>vertex(index?index.getX(i+k):i+k));
    for(let k=0;k<3;k++) {
      const edge=[triangle[k]!,triangle[(k+1)%3]!].sort().join("|");
      edges.set(edge,(edges.get(edge)??0)+1);
    }
  }
  return [...edges.values()].every(count=>count===2);
};

// --- 1. Exterior volume and cladding panels -------------------------------
const faceOffset = claddingFaceOffset(copingOuterOffset("skimmer", "hidden"));
ok(
  near(copingOuterOffset("skimmer", "hidden") - faceOffset, CLADDING.copingOverhang),
  "coping is flush with the finished panel face",
);
equal(CLADDING.copingOverhang,0,"no above-ground coping overhang");
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

// Reference staircase: steel frame, landing at the real coping height,
// parallel to the selected side and placed beside the real internal access.
for(const length of [6,8,12]) for(const width of [3,4,5]) for(const depth of [1,1.3,1.5])
  for(const side of ["short","long"] as const) for(const type of ["linear","corner"] as const) for(const mirrored of [false,true]) {
    const config:PoolConfig={...withOptions.config,dimensions:{length,width,depth,cornerRadius:0},externalStairSide:side,internalStairType:type,internalStairMirrored:mirrored};
    const o=buildOutline("rectangle",config.dimensions,[]),v=getPoolVerticalLayout({poolType:"above-ground",system:"skimmer",depth,copingThickness:0.04});
    const access=configuredPoolLayout(config).access;
    const standard=configuredPoolLayout({...config,internalStairMirrored:false}).access;
    ok(standard.placement,`${length}x${width}: ${type} existing internal access preserved`);
    if(mirrored && !access.placement) {
      const footprint=standard.footprint.map(([x,z])=>[x,-z] as const);
      const fittings=planSkimmers(o,length*width,true);
      const blocked=fittings.positions.some(p=>pointInBasin(p.x,p.z,footprint)||footprint.some((a,i)=>{
        const b=footprint[(i+1)%footprint.length]!,dx=b[0]-a[0],dz=b[1]-a[1];
        const t=Math.min(1,Math.max(0,((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz)));
        return Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz)<ACCESS_DIMENSIONS.fittingClearance;
      }));
      ok(blocked,"an unavailable mirror must have a real skimmer clearance collision, never an arbitrary refusal");
      ok(!!access.reason,"invalid mirror explicitly unavailable, never silently reuses the standard entry");
      continue;
    }
    ok(access.placement,`${length}x${width}: ${type} mirrored access valid where clear`);
    if(mirrored) {
      ok(!near(access.placement!.z,standard.placement!.z),`${length}x${width} d${depth} ${type}: mirror actually moves entry (${JSON.stringify(access.placement)} vs ${JSON.stringify(standard.placement)})`);
      ok(near(access.placement!.x,standard.placement!.x,1e-5),"mirror preserves the same short end");
    }
    const profile=buildFloorProfile({outline:o,shape:config.shape,poolType:config.poolType,dimensions:config.dimensions,verticalLayout:v});
    if(type==="corner") {
      ok(access.corner?.rectangular,"above-ground corner is rectilinear like the reference, not a round insert");
      for(let i=0;i<access.steps;i++) {
        const geometry=stairSolid(rectangularCornerTread(i?access.corner!.radii[i-1]!:0,access.corner!.radii[i]!),v.copingY-(i+1)*access.rise,access.placement!,profile);
        ok(isClosed(geometry),"every rectangular corner tread is a closed solid");
        for(const name of ["position","normal","uv"]) ok(Array.from(geometry.getAttribute(name).array).every(Number.isFinite),`valid rectangular tread ${name}`);
        geometry.dispose();
      }
    }
    const input={outline:o,groundY:v.groundY,topY:v.copingY,copingOffset:faceOffset,side,accessAnchor:access.placement};
    const plan=planExternalStaircase(input);
    ok(plan,`${length}x${width}: external ${side} fits`);
    equal(plan,planExternalStaircase(input),"same inputs -> same external access");
    ok(near(plan!.walk[0]*plan!.outward[0]+plan!.walk[1]*plan!.outward[1],0),"stair runs parallel to the wall, not radially from its centre");
    ok(near(Math.abs(plan!.outward[side==="short"?0:1]),1),"requested wall orientation honoured");
    ok(near(plan!.height,plan!.rise*plan!.stepCount)&&plan!.rise<=0.2,"regular risers reach the coping");
    equal(plan!.treadDepth,0.3,"30cm exterior treads");
    ok(plan!.landingDepth>=1&&plan!.width>=1,"usable landing and stair width");
    ok(plan!.footprint.every(([x,z])=>!pointInBasin(x,z,o)),"stairs and platform never intersect the basin");
    const extent=(side==="short"?width:length)/2+faceOffset;
    ok(plan!.footprint.every(point=>Math.abs(point[side==="short"?1:0])<=extent+1e-6),"stair run stays within the chosen side, no misplaced centre-wall projection");
    const enclosure=createExternalStairEnclosureGeometry(plan!);
    enclosure.computeBoundingBox();
    ok(isClosed(enclosure),"reference stair and landing form one closed enclosure, never an open frame");
    ok(near(enclosure.boundingBox!.min.y,0),"entire enclosure reaches the ground");
    ok(near(enclosure.boundingBox!.max.y,plan!.height-0.03,1e-5),"landing enclosure meets the walking slab underside");
    const body=new Mesh(enclosure,new MeshBasicMaterial());
    for(let descent=0;descent<plan!.stepCount;descent++) {
      const z=descent===0?0:plan!.landingDepth/2+(descent-0.5)*plan!.treadDepth;
      const hits=new Raycaster(new Vector3(0,plan!.height+1,z),new Vector3(0,-1,0)).intersectObject(body);
      ok(hits.length>0&&near(hits[0]!.point.y,plan!.height-plan!.rise*descent-0.03,1e-5),"closed body supports every tread and the landing without gaps");
    }
    body.material.dispose();enclosure.dispose();
    const restoredSide=parseProjectConfiguration(serializeProjectConfiguration(toProjectConfiguration("ag-side",config,renovation)));
    equal(restoredSide.config.externalStairSide,side,"requested exterior side round-trips");
    equal(restoredSide.config.internalStairMirrored,mirrored,"internal mirror round-trips without losing external placement");
    equal(createPhotoSceneSpec(restoredSide).selection.externalStairSide,side,"photo spec uses the same side");
    equal(createPhotoSceneSpec(restoredSide).selection.internalStairMirrored,mirrored,"photo spec preserves the actual internal orientation");
    ok(rows(config).some(row=>row.includes("Scala esterna")&&row.includes(side==="short"?"lato corto":"lato lungo")),"Summary / PDF explicitly carries the side");
  }
const longSideState=reducer(withOptions,{type:"setExternalStairSide",value:"long"});
equal(longSideState.config.externalStairSide,"long","UI action selects the long side");
equal(reducer(longSideState,{type:"setPoolType",value:"in-ground"}).config.externalStairSide,undefined,"in-ground clears the above-ground-only side");
equal(reducer(toInGround,{type:"setExternalStairSide",value:"short"}),toInGround,"in-ground refuses external-side changes");
const invalidSide=parseProjectConfiguration(JSON.stringify({...toProjectConfiguration("bad-side",withOptions.config,renovation),config:{...withOptions.config,externalStairSide:"invalid"}}));
equal(invalidSide.config.externalStairSide,"short","invalid saved side normalises safely");
equal(reducer(withOptions,{type:"toggleInoxLadder"}),withOptions,"above-ground refuses retired inox toggle");
equal(reducer(withOptions,{type:"setPoolAccess",value:"stainlessSteelLadder"}),withOptions,"above-ground refuses retired inox access");
const oldInox={...withOptions.config,poolAccess:"stainlessSteelLadder" as const,features:[...withOptions.config.features,"inoxLadder" as const]};
const restoredInox=parseProjectConfiguration(serializeProjectConfiguration(toProjectConfiguration("retired-inox",oldInox,renovation))).config;
equal(restoredInox.poolAccess,null,"legacy above-ground inox is cleared, never secretly rendered or quoted");
ok(!restoredInox.features.includes("inoxLadder"),"legacy above-ground optional inox cleared");
equal(configuredPoolLayout(oldInox).effectiveAccess,null,"canonical scene rejects stale above-ground inox");
equal(configuredPoolLayout(oldInox).ladder,null,"canonical scene rejects stale above-ground addon inox");
const mirrorState=reducer(withOptions,{type:"setInternalStairMirrored",value:true});
equal(mirrorState.config.internalStairMirrored,true,"mirror UI action applied to canonical state");
equal(reducer(mirrorState,{type:"setPoolType",value:"in-ground"}).config.internalStairMirrored,undefined,"in-ground never inherits above-ground mirror");
ok(rows(mirrorState.config).some(row=>row.includes("speculare")),"Summary/PDF carries the actual mirror");

// Correct broad C profile; the outlet points into the pool and downwards.
const curve=pellicanoCurve(),mouth=curve.getPoint(1),tangent=curve.getTangent(1);
ok(mouth.z>0.35&&mouth.y>0.65,"reference overhanging mouth");
ok(tangent.z>0&&tangent.y<0,"water leaves into the basin, downward");
const spoutGeometry=createPellicanoSpoutGeometry();spoutGeometry.computeBoundingBox();
const box=spoutGeometry.boundingBox!;
ok(near(box.max.x-box.min.x,0.44,1e-5),"blade has full transverse width; width/thickness axes not swapped");
ok(box.max.y>0.8&&box.min.z>-faceOffset,"curved body fits on the coping, never outside the panels");
for(const attribute of ["position","normal","uv"]) ok(Array.from(spoutGeometry.getAttribute(attribute).array).every(Number.isFinite),`finite spout ${attribute}`);
spoutGeometry.dispose();

const guardPost=createExternalStairGuardPostGeometry();guardPost.computeBoundingBox();
ok(isClosed(guardPost),"folded stainless guard post is closed");
ok(near(guardPost.boundingBox!.max.z-guardPost.boundingBox!.min.z,0.065,1e-5),"reference broad flat-bar post, not a thin tube");
ok(guardPost.boundingBox!.max.x>0.045,"reference folded foot offset");
guardPost.dispose();

// Optional platform: both side choices, no overrun beyond the cladding corners,
// one closed volume and the same saved selection in every delivery surface.
equal(needsOverflowType("system","overflow","system"),true,"Continue must present overflow subtype before access");
equal(needsOverflowType("system","overflow","detail"),false,"after subtype Continue advances normally");
for (const system of ["skimmer","infinity"] as const)
  equal(needsOverflowType("system",system,"system"),false,"no extra subtype step for other systems");
for (const length of [6,8,12]) for (const width of [3,4,5]) for (const depth of [1,1.3,1.5])
  for (const system of ["skimmer","overflow"] as const) for (const side of ["short","long"] as const)
    for (const extended of [false,true]) {
      const config:PoolConfig={...withOptions.config,system,overflowType:"visible",dimensions:{length,width,depth,cornerRadius:0},externalStairSide:side,externalStairPlatformExtended:extended};
      const outline=buildOutline("rectangle",config.dimensions,[]);
      const v=getPoolVerticalLayout({poolType:"above-ground",system,overflowType:"visible",depth,copingThickness:0.04});
      const offset=copingOuterOffset(system,"visible");
      const topY=system==="overflow"?v.waterY-0.001:v.copingY;
      const plan=planExternalStaircase({outline,groundY:v.groundY,topY,copingOffset:offset,side,platformExtended:extended,accessAnchor:configuredPoolLayout(config).access.placement});
      ok(plan,`${length}x${width} ${system} ${side} extended:${extended}: platform fits`);
      const extent=(side==="short"?width:length)/2+offset;
      ok(plan!.footprint.every(point=>Math.abs(point[side==="short"?1:0])<=extent+1e-6),"no residual tread or platform projects beyond the side corners");
      ok(plan!.footprint.every(([x,z])=>!pointInBasin(x,z,outline)),"no basin intrusion");
      ok(near(plan!.height+v.groundY,topY),"platform shares the rim datum");
      ok(extended?near(plan!.landingDepth+plan!.run,2*extent):near(plan!.landingDepth,1.05),"extension is derived from available side, compact landing is unchanged");
      const solid=createExternalStairEnclosureGeometry(plan!);
      ok(isClosed(solid),"extended and compact structures are watertight"); solid.dispose();
      const restored=parseProjectConfiguration(serializeProjectConfiguration(toProjectConfiguration("platform",config,renovation)));
      equal(restored.config.externalStairPlatformExtended,extended,"platform choice round-trips");
      equal(createPhotoSceneSpec(restored).selection.externalStairPlatformExtended,extended,"Photo Spec keeps platform choice");
      equal(JSON.stringify(buildProjectSummary(restored)).includes("piattaforma prolungata"),extended,"shared Summary/PDF/quote describes the chosen platform only");
    }
const extendedState=reducer(withOptions,{type:"setExternalStairPlatformExtended",value:true});
equal(reducer(extendedState,{type:"setExternalStairSide",value:"long"}).config.externalStairPlatformExtended,true,"side switch preserves independent extension");
equal(reducer(extendedState,{type:"setPoolType",value:"in-ground"}).config.externalStairPlatformExtended,undefined,"in-ground has no stale platform option");
const grilleOutline=buildOutline("rectangle",{length:8,width:4,depth:1.3,cornerRadius:0},[]);
const grille=createGrateGeometry(offsetOutline(grilleOutline,0.11),offsetOutline(grilleOutline,0.355),0.016);
grille.computeBoundingBox();
ok(near(grille.boundingBox!.max.y,0),"grille has no raised frame above the rim");
ok(near(grille.boundingBox!.min.y,-0.025,1e-6),"grille ribs have real 25mm depth");
ok(isClosed(grille),"grille consists of closed solid ribs, not a texture");
grille.dispose();

console.log(`Above-ground audit PASS: ${checks} checks`);
