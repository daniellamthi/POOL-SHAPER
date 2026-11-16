import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { readFileSync } from "node:fs";

const root = process.cwd();
const file = join(root, "node_modules/.cache/deck-lounger-spacing-audit.mjs");
await build({
  input: "deck-spacing-entry",
  output: { file, format: "esm" },
  platform: "node",
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(root, "src") } },
  plugins: [{
    name: "deck-spacing-entry",
    resolveId: id => id === "deck-spacing-entry" ? id : null,
    load: id => id === "deck-spacing-entry" ? `
      export { planDeckFurniture } from "${root}/src/components/pool/three/DeckLoungers.tsx";
      export * from "${root}/src/components/pool/three/studioDeck.ts";
      export { offsetOutline, outlineBounds } from "${root}/src/lib/pool/geometry.ts";
      export { pointInBasin } from "${root}/src/lib/pool/boundary-placement.ts";
      export { DECK_CHAISE_MODEL, DECK_CHAISE_LAYOUT } from "${root}/src/lib/pool/sun-shelf-model.ts";
      export { constructionPresentation } from "${root}/src/lib/pool/construction-presentation.ts";
      export { COPING_MATERIALS, copingMaterialsForPool } from "${root}/src/lib/pool/coping-materials.ts";
      export { createCopingSlabGeometry } from "${root}/src/components/pool/three/poolConstruction.ts";
      export { configureReferenceCoping, configureReferencePaving } from "${root}/src/components/pool/three/referenceFinishTexture.ts";
      export { centeredArchitecturalFrame, architecturalFrustum } from "${root}/src/components/pool/three/architecturalPlan.ts";
      export { createVisiblePavingGeometry } from "${root}/src/components/pool/three/StudioPaving.tsx";
      export { createPavingModules } from "${root}/src/components/pool/three/pavingGeometry.ts";
    ` : null,
  }],
});
const { planDeckFurniture, studioDeckBand, studioDeckInnerOffset, offsetOutline, pointInBasin,
  studioDeckOutline, LOUNGER_SIDE_EXTENSION, outlineBounds, constructionPresentation,
  COPING_MATERIALS, copingMaterialsForPool, createCopingSlabGeometry,
  configureReferenceCoping, configureReferencePaving,
  centeredArchitecturalFrame, architecturalFrustum, createVisiblePavingGeometry, createPavingModules,
  DECK_CHAISE_MODEL: model, DECK_CHAISE_LAYOUT: spacing } = await import(pathToFileURL(file).href);
let checks = 0;
const check = (v, name) => { assert(v, name); checks++; };
const report = [];
for (const [length, width] of [[6, 3], [8, 4], [12, 5], [4, 8]]) {
  const outline = [[-length/2,-width/2],[length/2,-width/2],[length/2,width/2],[-length/2,width/2]];
  check(studioDeckBand(outline, false, true) === 1.2, "early-stage compact band unchanged");
  const originalBand = Math.min(3.6, Math.max(2.6, Math.hypot(length, width)*0.3));
  check(studioDeckBand(outline, true, false) === originalBand, "OFF terrace unchanged");
  for (const poolType of ["in-ground", "above-ground"]) for (const [system, overflow] of [["skimmer","hidden"],["overflow","grille"],["overflow","hidden"]]) {
    const innerOffset = studioDeckInnerOffset(poolType, system, overflow);
    const band = studioDeckBand(outline, true, true);
    const inner = offsetOutline(outline, innerOffset), outer = offsetOutline(inner, band);
    const plan = planDeckFurniture(outline, innerOffset, band, [], {loungers:true, shower:true});
    const widened = studioDeckOutline(inner, band, plan.rows);
    const oldBounds = outlineBounds(outer), newBounds = outlineBounds(widened);
    assert.deepEqual(studioDeckOutline(inner, band, []), outer); checks++;
    const directions = plan.rows.map(r => [-Math.sin(r.rotation), -Math.cos(r.rotation)]);
    for (const [key, axis, sign] of [["minX",0,-1],["maxX",0,1],["minZ",1,-1],["maxZ",1,1]]) {
      const occupied = directions.some(n => n[axis] * sign > 0.5);
      check(Math.abs(newBounds[key] - oldBounds[key] - (occupied ? sign*LOUNGER_SIDE_EXTENSION : 0)) < 1e-7,
        "only occupied side gains 80cm; other terrace boundaries unchanged");
    }
    check(plan.rows.reduce((n,r)=>n+r.offsets.length,0) === 4, "four full-size deck loungers fit");
    for (const row of plan.rows) {
      const c=Math.cos(row.rotation), s=Math.sin(row.rotation);
      const world=(x,z)=>({x:row.x+x*c+z*s,z:row.z-x*s+z*c});
      for (let i=1;i<row.offsets.length;i++) {
        const gap=row.offsets[i]-row.offsets[i-1]-model.width;
        check(gap >= spacing.between-1e-7, "at least 90 cm between adjacent loungers");
      }
      const centreDistance = Math.abs(c)>0.5 ? Math.abs(row.z)-width/2 : Math.abs(row.x)-length/2;
      check(centreDistance-model.length/2-innerOffset >= 1-1e-7, "one metre from external coping to foot");
      check(innerOffset+band-centreDistance-model.length/2 >= spacing.rearMargin-1e-7, "rear margin on paving");
      for (const offset of row.offsets) for(const dx of [-model.width/2,model.width/2]) for(const dz of [-model.length/2,model.length/2]) {
        const p=world(offset+dx,dz);
        check(pointInBasin(p.x,p.z,outer)&&!pointInBasin(p.x,p.z,inner), "entire real-size footprint supported on terrace");
        check(pointInBasin(p.x,p.z,widened), "full real-size footprint remains supported after directional expansion");
      }
    }
    check(planDeckFurniture(outline,innerOffset,band,[],{loungers:false,shower:false}).rows.length===0,"OFF removes all deck furniture");
    const obstacle={x:plan.rows[0].x,z:plan.rows[0].z};
    const replan=planDeckFurniture(outline,innerOffset,band,[obstacle],{loungers:true,shower:false});
    check(replan.rows.length>0 && replan.rows.every(r=>Math.hypot(r.x-obstacle.x,r.z-obstacle.z)>1.9),"access obstacle moves row to clear side");
    const redirected = outlineBounds(studioDeckOutline(inner,band,replan.rows));
    check(JSON.stringify(redirected)!==JSON.stringify(newBounds),"terrace extension follows replanned access-safe row, not a fixed side");
    if(poolType==="in-ground"&&system==="skimmer") report.push({size:`${length}×${width}`,band,walkway:spacing.walkway,gap:spacing.between});
  }
}

for (const step of ["pool","system","access","style","lighting","deck","technology","review"]) {
  const presentation = constructionPresentation({projectType:"new",structure:"reinforced-concrete"},step);
  check(presentation.showLoungers === (step === "review"), "external chaises visible only at final presentation");
}
check(!constructionPresentation({projectType:"new",structure:"reinforced-concrete"},"review",true).showLoungers,
  "technical view never introduces presentation furniture");
for (const type of ["in-ground","above-ground"]) check(!copingMaterialsForPool(type).some(m=>m.id==="deck-marrone"),"retired brown coping absent from customer choices");
check(COPING_MATERIALS.some(m=>m.id==="deck-marrone"),"legacy brown coping ID retained for saved-project restoration");
check(copingMaterialsForPool("in-ground").some(m=>m.id==="reference-ipe"),"original Ipe remains selectable");
for (const [length,width] of [[6,3],[8,4],[12,5]]) {
  const inner=[[-length/2,-width/2],[length/2,-width/2],[length/2,width/2],[-length/2,width/2]];
  const outer=offsetOutline(inner,.32);
  const regular=createCopingSlabGeometry(inner,outer,.045), continuous=createCopingSlabGeometry(inner,outer,.045,null,true);
  regular.computeBoundingBox(); continuous.computeBoundingBox();
  for (const end of ["min","max"]) for(const axis of ["x","y","z"])
    check(Math.abs(regular.boundingBox[end][axis]-continuous.boundingBox[end][axis])<1e-6,"continuous Ipe preserves surveyed width, thickness and envelope");
  const frames=continuous.getAttribute("slabFrame");
  check(new Set(Array.from({length:frames.count},(_,i)=>frames.getW(i))).size===4,"one continuous timber element per real side, not small slabs");
  regular.dispose();continuous.dispose();
}
const stub=()=>({uniforms:{},fragmentShader:"vec3 stoneColor = texture2D(stoneColorMap, p).rgb * stoneWeights.z;\n#include <map_fragment>"});
const copingShader=stub(),pavingShader=stub();
configureReferenceCoping(copingShader,"reference-ipe"); configureReferencePaving(pavingShader,"reference-ipe");
check(!copingShader.fragmentShader.includes("vColor.r * 997.0"),"Ipe coping uses one uniform photographic wood source, not alternating board crops");
check(pavingShader.fragmentShader.includes("vColor.r * 997.0"),"paving wood sampling remains unchanged");
const modelSource=readFileSync("src/components/pool/three/PoolModel.tsx","utf8");
check(modelSource.includes('vertexColors={materials.coping.id !== "reference-ipe"}'),"Ipe coping has no artificial per-module shade tint");
const sceneSource=readFileSync("src/components/pool/three/PoolScene.tsx","utf8");
check(sceneSource.includes('loungers && (construction?.showLoungers ?? true)')&&sceneSource.includes('furnitureRows={deckFurniturePlan?.rows}'),"scene and terrace share actual stage-gated furniture plan");
for(const [vw,vh] of [[1440,900],[1280,720],[390,844],[430,932]]) for(const [length,width] of [[6,3],[8,4],[12,5]]) {
  for(const frame of [{left:0,top:140,width:vw*.85,height:vh*.3},{left:vw*.15,top:140,width:vw*.85,height:vh*.3}]) {
    const centered=centeredArchitecturalFrame(frame,vw);
    check(Math.abs(centered.left+centered.width/2-vw/2)<1e-7,"top editing plan is horizontally centred despite asymmetric HUD");
    check(centered.left>=frame.left-1e-7 && centered.left+centered.width<=frame.left+frame.width+1e-7,"centred frame stays inside real free area");
    const bounds=[[-length/2-.72,-width/2-.72],[length/2+.72,width/2+.72]];
    const fit=architecturalFrustum(bounds,vw,vh,centered,false,true);
    const project=([x,z])=>[vw/2+(x-fit.centre[0])*vw/fit.width,vh/2+(z-fit.centre[1])*vh/fit.height];
    const centre=project([0,0]);
    check(Math.abs(centre[0]-vw/2)<1e-7,"actual pool centre projects to canvas horizontal centre");
    check(Math.abs(centre[1]-(frame.top+frame.height/2))<1e-7,"actual pool centre projects to free vertical centre above dock");
    for(const point of bounds) {const [x,y]=project(point);check(x>centered.left && x<centered.left+centered.width && y>centered.top && y<centered.top+centered.height,"basin plus dimension annotations fit without clipping");}
  }
}
const performanceReport=[];
const inner=[[-6,-2.5],[6,-2.5],[6,2.5],[-6,2.5]],outer=offsetOutline(inner,1.2);
for(const [module,boards] of [[[1.2,.6],false],[[2.4,.14],true]]) {
  const options={gap:boards ? 0.005 : 0.003,thickness:boards ? 0.025 : 0.02,boards};
  const samples={before:[],after:[]};let oldVertices=0;
  for(let run=0;run<4;run++) for(const visible of [true,false]) {
    const start=performance.now(),built=createVisiblePavingGeometry(inner,outer,module,options,visible),ms=performance.now()-start;
    if(run)samples[visible?"before":"after"].push(ms);
    const count=built.slabs.getAttribute("position")?.count??0;
    if(visible){oldVertices=count;check(count>0,"visible final paving retains all metric modules");}
    else check(count===0 && !built.grout.getAttribute("position"),"dimension editing cuts no invisible paving vertices");
    built.slabs.dispose();built.grout.dispose();
  }
  const full=createPavingModules(inner,outer,module,options),actual=createVisiblePavingGeometry(inner,outer,module,options,true);
  assert.deepEqual(actual.slabs.getAttribute("position").array,full.getAttribute("position").array);checks++;
  full.dispose();actual.slabs.dispose();actual.grout.dispose();
  const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
  performanceReport.push({material:boards?"boards":"stone",hiddenBaselineVertices:oldVertices,hiddenCandidateVertices:0,
    baselineMedianMs:+median(samples.before).toFixed(3),candidateMedianMs:+median(samples.after).toFixed(3),
    baselineRunsMs:samples.before.map(n=>+n.toFixed(3)),candidateRunsMs:samples.after.map(n=>+n.toFixed(3))});
}
console.log(JSON.stringify({result:"PASS",checks,report,performanceReport,note:"CPU geometry only: three timed runs after warm-up; not GPU/FPS or physical-mobile performance."},null,2));
