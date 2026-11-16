import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { configuratorTesting } from "../src/lib/pool/store";
import { configuredSunShelfRange, sunShelfRunWithinRange } from "../src/lib/pool/sun-shelf-range";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { configuredSunShelfLoungers, SUN_SHELF_LOUNGER_MODEL as M, SUN_SHELF_LOUNGER_LAYOUT as L } from "../src/lib/pool/sun-shelf-loungers";
import { comfortConfigurationIssues } from "../src/lib/pool/comfort-compatibility";
import { clampInfinityEdgeParams } from "../src/lib/pool/infinity-edge";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "../src/lib/pool/project";
import { shareableProject } from "../src/lib/project-delivery/service";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { translateText } from "../src/lib/i18n";
import { MOSAIC_FINISHES } from "../src/configurator/materials/interior-textures";
import { leadSubmissionInputSchema } from "../src/lib/lead/schema";
import type { PoolConfig, Outline } from "../src/lib/pool/types";

let checks = 0, cases = 0, rendered = 0;
const check = (value: unknown, message: string) => { assert(value, message); checks++; };
const base = configuratorTesting.createInitialState();
const rect = (o: Outline) => ({ minX: Math.min(...o.map(p=>p[0])), maxX: Math.max(...o.map(p=>p[0])), minZ: Math.min(...o.map(p=>p[1])), maxZ: Math.max(...o.map(p=>p[1])) });
const overlaps = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.minX < b.maxX-1e-7 && a.maxX > b.minX+1e-7 && a.minZ < b.maxZ-1e-7 && a.maxZ > b.minZ+1e-7;
const make = (length: number, width: number): PoolConfig => ({ ...base.config,
  projectType: "new", poolType: "in-ground", structure: "reinforced-concrete", shape: "rectangle", shapeSelected: true,
  system: "skimmer", poolAccess: "internalSteps", internalStairType: "linear", features: ["sunShelf", "ledLighting"],
  dimensions: { ...base.config.dimensions, length, width, depth: 1.5, floorProfile: "flat" },
});
const timing: number[] = [];
for (const [length,width] of [[6,3],[8,4],[12,5],[4,8],[5,12],[6,3.519],[6,3.52],[6,3.521]])
for (const depth of [1.1,1.5,2.4]) for (const slope of [false,true])
for (const system of ["skimmer","overflow","infinity"] as const)
for (const side of system === "infinity" ? [0,1,2,3] : [0]) {
  const c = make(length!,width!);
  c.system = system;
  c.dimensions = { ...c.dimensions, depth, ...(slope ? {floorProfile:"slope", shallowDepth:Math.min(1.1,depth-.2), slopeReversed:side%2===1} : {}) };
  if(system === "infinity") c.infinityEdge = clampInfinityEdgeParams({enabled:true,side});
  const start = performance.now(), range = configuredSunShelfRange(c);
  timing.push(performance.now()-start); cases++;
  if (!range.available) {
    check(!!range.reason, "Unavailable geometry always has an explanation");
    if (length===6 && width===3) check(!configuredSunShelfLoungers(c).available, "6×3 is not grown or furniture scaled");
    continue;
  }
  check(range.max>=range.min && range.min>0, "Actual nonempty geometric interval");
  check(Math.max(length!,width!)-range.max>=2.4-1e-7, "Existing residual swim-space criterion retained");
  check(!sunShelfRunWithinRange(range,range.min-.001) && !sunShelfRunWithinRange(range,range.max+.001), "Millimetre-outside requests rejected");
  for (const run of [range.min,range.min+.001,(range.min+range.max)/2,range.max-.001,range.max]) {
    if (!sunShelfRunWithinRange(range,run)) continue;
    const candidate = {...c,dimensions:{...c.dimensions,sunShelfRun:run}};
    const layout=configuredPoolLayout(candidate), shelf=layout.comfort.elements.find(e=>e.kind==="sunShelf");
    check(layout.status!=="UNAVAILABLE" && shelf, "Every sampled interval value actually renders the shelf/access");
    check(Math.abs(shelf!.run-run)<1e-7, "Exact requested metric run drives the actual geometry");
    const off=configuredSunShelfLoungers(candidate);
    check(off.available && off.capacity>=2 && off.count===0, "Two furniture footprints reserved even optional OFF; no automatic purchase");
    const on=configuredSunShelfLoungers({...candidate,features:[...candidate.features,"sunShelfLoungers"],sunShelfLoungerCount:2});
    check(on.count===2 && on.placements.length===2 && on.passage, "Two actual chaises and connected access route");
    const landing=rect(on.passage!);
    for(const p of on.placements) {
      const b=rect(p.footprint), alongX=length!>=width!;
      check(Math.abs((alongX?b.maxX-b.minX:b.maxZ-b.minZ)-M.length)<1e-7, "Full185cm chaise, never scale-to-fit");
      check(Math.abs((alongX?b.maxZ-b.minZ:b.maxX-b.minX)-M.width)<1e-7, "Full73cm chaise width");
      check(p.y===shelf!.topY && shelf!.waterDepth<=M.maxWaterDepth, "Real support at approved20cm immersion");
      check(!overlaps(b,landing), "Passage remains clear of loungers");
      for(const step of shelf!.steps ?? []) check(!overlaps(b,rect(step.footprint)), "No lounger over any tread");
    }
    check(!overlaps(rect(on.placements[0]!.footprint),rect(on.placements[1]!.footprint)), "Separate real furniture envelopes");
    rendered++;
  }
}
for (const shape of ["l-shape","custom","organic"] as const) check(!configuredSunShelfRange({...make(12,5),shape}).available, "Unsupported concave/custom shape is explicit, never approximated as a rectangle");
check(!configuredSunShelfRange({...make(12,5),poolType:"above-ground"}).available,"No in-ground shelf offered above-ground");
const r8=configuredSunShelfRange(make(8,4)),r12=configuredSunShelfRange(make(12,5));
check(r8.available && r12.available && r8.max!==r12.max,"Maximum derives from each pool, not a shared constant");
const deep=configuredSunShelfRange({...make(8,4),dimensions:{...make(8,4).dimensions,depth:2.4}});
check(r8.available && deep.available && deep.min>r8.min,"Minimum grows with the real deeper stair flight, not an arbitrary size label");
const malformed={...make(8,4),dimensions:{...make(8,4).dimensions,floorProfile:"slope" as const,shallowDepth:3}};
const normalized={...malformed,dimensions:{...malformed.dimensions,shallowDepth:1.3}};
assert.deepEqual(configuredSunShelfRange(malformed),configuredSunShelfRange(normalized),"Range uses the same safe floor normalization as actual rendering"); checks++;

let state={...base,config:{...make(8,4),features:["sunShelf","sunShelfLoungers","ledLighting","stairLighting"] as PoolConfig["features"],sunShelfLoungerCount:2}};
const valid=configuredSunShelfRange(state.config); assert(valid.available);
for(const v of [valid.min-.001,valid.max+.001,NaN,Infinity,0,-1]) {
  check(configuratorTesting.reducer(state,{type:"setSunShelfRun",value:v})===state,"Invalid input preserves exact existing draft");
}
state=configuratorTesting.reducer(state,{type:"setSunShelfRun",value:valid.max});
check(state.config.dimensions.sunShelfRun===valid.max,"Explicit measure accepted");
const before=state.config;
state=configuratorTesting.reducer(state,{type:"setDimension",key:"length",value:6});
check(state.config.dimensions.sunShelfRun===valid.max && state.config.features===before.features,"Resize retains requested measure and independent optional intent");
check(comfortConfigurationIssues(state.config).length>0,"Invalid retained request requires explicit resolution");
check(!configuredPoolLayout(state.config).comfort.elements.some(e=>e.kind==="sunShelf"),"No impossible shelf volume rendered");
const unresolved=toProjectConfiguration(state.projectId,state.config,state.renovation);
check(parseProjectConfiguration(serializeProjectConfiguration(unresolved)).config.dimensions.sunShelfRun===valid.max,"Reload preserves unresolved intent instead of silent clamp");
check(shareableProject(unresolved).config.dimensions.sunShelfRun===valid.max,"Read-only/copy whitelist retains measure");
state=configuratorTesting.reducer(state,{type:"setSunShelfRun",value:3.2});
check(state.config.dimensions.sunShelfRun===3.2 && comfortConfigurationIssues(state.config).length===0,"Customer can explicitly repair only the measure");
const renovationReset=configuratorTesting.reducer(state,{type:"setProjectType",value:"renovation"});
check(renovationReset.config.dimensions.sunShelfRun===undefined && !renovationReset.config.features.includes("sunShelfLoungers"),"Renovation does not inherit the new-pool requested shelf measure or loungers");
const project=toProjectConfiguration(state.projectId,state.config,state.renovation);
for (const malformedRun of ["3.2", null, true, 0, -1, {}, []]) {
  assert.throws(() => parseProjectConfiguration(JSON.stringify({ ...project,
    config: { ...project.config, dimensions: { ...project.config.dimensions, sunShelfRun: malformedRun } },
  })), /invalid sunShelfRun/); checks++;
}
assert.throws(() => parseProjectConfiguration(serializeProjectConfiguration(project).replace('"sunShelfRun":3.2', '"sunShelfRun":1e309')), /invalid sunShelfRun/); checks++;
check(parseProjectConfiguration(JSON.stringify({ ...project, config: { ...project.config,
  dimensions: { ...project.config.dimensions, sunShelfRun: 10 } } })).config.dimensions.sunShelfRun === 10,
  "Finite positive but incompatible resize intent stays intact for explicit resolution");
const lead={customer:{name:"Shelf range QA",email:"qa@example.invalid",phone:"0000000000",projectLocation:"QA"},
  commercial:{timing:"evaluating",notes:"Local test only"},privacy:{accepted:true,marketingConsent:false},idempotencyKey:"shelf-range-local-audit",project};
check(leadSubmissionInputSchema.safeParse(lead).success,"Valid server snapshot accepted");
check(!leadSubmissionInputSchema.safeParse({...lead,project:{...project,config:{...project.config,dimensions:{...project.config.dimensions,sunShelfRun:"3.2"}}}}).success,"Server rejects a forged nonnumeric dimension");
for(const locale of ["it","en"] as const) {
  const summary=buildProjectSummary(project,locale);
  const text=JSON.stringify(summary);
  check(text.includes(locale==="it"?"lunghezza complessiva":"total length"),"Summary/PDF/quote model records new measure in requested language");
}
for(const text of ["Lunghezza spiaggetta e gradini","Applica una misura compatibile","Il minimo utile non entra nello spazio disponibile."])
  check(translateText(text,"en")!==text,"New customer controls/errors translated");
for(const [index,mosaic]of MOSAIC_FINISHES.entries()) {
  check(mosaic.name===`Mosaico ${index+1}` && !mosaic.name.includes(mosaic.id.slice(7,15)),"Provisional customer numbering, no technical-ID labels or invented collection");
  check(translateText(mosaic.name,"en")===`Mosaic ${index+1}`,"Mosaic label translates independently of stable catalogue ID");
  check(translateText(`Mosaico · ${mosaic.name}`,"en")===`Mosaic · Mosaic ${index+1}`,"Composed phase selection has no Italian mosaic fragment");
  check(translateText(`Mosaic · Mosaic ${index+1}`,"it")===`Mosaico · ${mosaic.name}`,"Composed mosaic selection round-trips to Italian");
  check(translateText(`Passo 4: Mosaico · ${mosaic.name}`,"en")===`Step 4: Mosaic · Mosaic ${index+1}`,"Nested phase accessibility label translates each mosaic segment");
}
check(translateText("Tonalità LED","en")==="LED hue" && translateText("LED hue","it")==="Tonalità LED","LED slider accessible label follows locale");
check(translateText("Intensità luce LED","en")==="LED brightness","LED dimmer accessible name follows locale");
check(translateText("Livelli rapidi","en")==="Quick levels","LED dimmer preset group follows locale");
check(translateText("{percent} per cento","en",{percent:60})==="60 percent","LED dimmer accessible value preserves its numeric setting");
for(const hint of ["Soffusa","Serale","Intensa","Massima"]) check(translateText(hint,"en")!==hint,"LED dimmer preset tooltip follows locale");
check(translateText("Regola la resa reale dei fari: lente, fascio e luce nell'acqua. Predefinito {percent}%, come una serata tipo.","en",{percent:60})==="Adjust the actual light output: lens, beam and light in the water. Default 60%, for a typical evening scene.","Complete LED dimmer explanation translates without changing its default");
check(translateText("Scegli la struttura","en")==="Choose a structure","Construction scene badge follows the customer locale");
check(translateText("Finitura · vasca inox a vista","en")==="Finish · exposed stainless steel pool","Construction finish badge has no mixed-language fragment");
const legacy=make(8,4);
check(configuredPoolLayout(legacy).comfort.elements.find(e=>e.kind==="sunShelf")!.run===3.035,"Legacy auto shelf retains approved metric geometry");
for(const variant of ["closed","open"] as const) {
  const hydro={...make(8,4),features:["hydromassage"] as PoolConfig["features"],hydromassageVariant:variant};
  check(JSON.stringify(configuredPoolLayout(hydro).comfort)===JSON.stringify(configuredPoolLayout({...hydro,dimensions:{...hydro.dimensions,sunShelfRun:5.6}}).comfort),"Shelf measure never changes approved hydro body");
}
timing.sort((a,b)=>a-b);
console.log(JSON.stringify({status:"PASS",checks,cases,renderedSamples:rendered,model:[M.length,M.width,M.height],layoutCriteria:L,
  rangeSolverCpuMs:{median:timing[Math.floor(timing.length/2)],p95:timing[Math.floor(timing.length*.95)]},
  limitation:"Local geometric/CPU/configuration contracts only; not browser, cloud persistence, GPU FPS, product certification or every combination."}));
