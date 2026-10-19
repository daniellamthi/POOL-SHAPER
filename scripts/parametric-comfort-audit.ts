import assert from "node:assert/strict";
import { configuratorTesting } from "../src/lib/pool/store";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { configuredSunShelfLoungers, SUN_SHELF_LOUNGER_MODEL as M, SUN_SHELF_LOUNGER_LAYOUT as L } from "../src/lib/pool/sun-shelf-loungers";
import { parseProjectConfiguration, serializeProjectConfiguration, toProjectConfiguration } from "../src/lib/pool/project";
import type { PoolConfig, Outline } from "../src/lib/pool/types";
import { comfortConfigurationIssues } from "../src/lib/pool/comfort-compatibility";
import { clampInfinityEdgeParams } from "../src/lib/pool/infinity-edge";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { buildProjectBook } from "../src/lib/project-delivery/projectBook";
import { leadSubmissionInputSchema } from "../src/lib/lead/schema";

let checks = 0;
function check(value: unknown, message: string): asserts value { assert(value, message); checks++; }
const base = configuratorTesting.createInitialState();
const config = (length: number, width: number, features: PoolConfig["features"], extra: Partial<PoolConfig> = {}): PoolConfig => ({
  ...base.config, projectType: "new", poolType: "in-ground", structure: "reinforced-concrete",
  shape: "rectangle", shapeSelected: true, poolAccess: "internalSteps", internalStairType: "linear",
  dimensions: { ...base.config.dimensions, length, width, depth: 1.5, floorProfile: "flat" },
  system: "skimmer", features, ...extra,
});
const bounds = (o: Outline) => ({ minX: Math.min(...o.map(p=>p[0])), maxX: Math.max(...o.map(p=>p[0])), minZ: Math.min(...o.map(p=>p[1])), maxZ: Math.max(...o.map(p=>p[1])) });
for (const width of [2.7, 2.99, 3, 3.01, 4, 5]) for (const length of [6, 8, 12]) for (const variant of ["closed", "open"] as const) {
  const c = config(length, width, ["hydromassage"], { hydromassageVariant: variant });
  const plan = configuredPoolLayout(c);
  if (width <= 3) {
    check(!plan.comfort.availability.hydromassage.available, `${length}×${width}/${variant}: hydro not offered`);
    check(!plan.comfort.elements.some(e=>e.kind==="hydromassage"), "invalid hydro never rendered");
    check(plan.status === "UNAVAILABLE", "requested hydro is an explicit unresolved layout");
  }
}
for (const [length,width] of [[6,3],[8,4],[12,5]]) for (const sloped of [false,true]) {
  const c = config(length!,width!,["sunShelf","sunShelfLoungers"]);
  if (sloped) c.dimensions = { ...c.dimensions, floorProfile:"slope", shallowDepth:1.1 };
  const plan = configuredPoolLayout(c), loungers = configuredSunShelfLoungers(c);
  console.log(JSON.stringify({length,width,sloped,status:plan.status,shelf:plan.comfort.availability.sunShelf,capacity:loungers.capacity,count:loungers.count}));
  if (width===3) { check(!plan.comfort.availability.sunShelf.available,"6×3 cannot host two chaises plus actual access"); continue; }
  check(loungers.available && loungers.capacity>=2, `${length}×${width}: at least two full chaises`);
  const shelf=plan.comfort.elements.find(e=>e.kind==="sunShelf");
  check(shelf?.landing,"real shelf access landing retained");
  const s=bounds(shelf.footprint), a=bounds(shelf.landing.footprint), alongX=length!>=width!;
  check((alongX?a.maxZ-a.minZ:a.maxX-a.minX)>=L.minimumAccessWidth,"actual access strip ≥90cm");
  for(const p of loungers.placements) {
    const b=bounds(p.footprint);
    check(Math.abs((alongX?b.maxX-b.minX:b.maxZ-b.minZ)-M.length)<1e-7,"chaise length never scaled");
    check(Math.abs((alongX?b.maxZ-b.minZ:b.maxX-b.minX)-M.width)<1e-7,"chaise width never scaled");
    check(b.minX>=s.minX+L.edgeInset-1e-7 && b.maxX<=s.maxX-L.edgeInset+1e-7 && b.minZ>=s.minZ+L.edgeInset-1e-7 && b.maxZ<=s.maxZ-L.edgeInset+1e-7,"full model within real shelf and movement margins");
    check(Math.abs(p.y-shelf.topY)<1e-7,"real shelf support");
    const route=bounds(loungers.passage!);
    check(b.minX>=route.maxX-1e-7 || b.maxX<=route.minX+1e-7 || b.minZ>=route.maxZ-1e-7 || b.maxZ<=route.minZ+1e-7,"explicit connected access route does not cross a chaise");
  }
}
for (const size of [[8,4],[12,5]]) for (const system of ["skimmer","overflow","infinity"] as const)
for (const stair of ["linear","corner"] as const) for(const variant of ["closed","open"] as const)
for(const sloped of [false,true]) for(const side of system==="infinity"?[0,1,2,3]:[0]) {
  const c=config(size[0]!,size[1]!,["hydromassage"],{system,internalStairType:stair,hydromassageVariant:variant,
    ...(system==="infinity"?{infinityEdge:clampInfinityEdgeParams({enabled:true,side})}:{})});
  if(sloped)c.dimensions={...c.dimensions,floorProfile:"slope",shallowDepth:1.1};
  const r=configuredPoolLayout(c),issues=comfortConfigurationIssues(c);
  check(r.status!=="UNAVAILABLE" || issues.length>0,"every unavailable actual entrance has an explicit issue");
  if(!r.comfort.availability.hydromassage.available)check(!r.comfort.elements.some(e=>e.kind==="hydromassage"),"incompatible hydro never blocks selected access in scene");
}
let state={...base,config:config(12,5,["sunShelf","sunShelfLoungers","ledLighting"],{sunShelfLoungerCount:4})};
const requested=state.config.features;
state=configuratorTesting.reducer(state,{type:"setDimension",key:"width",value:3});
check(state.config.features.includes("sunShelfLoungers") && state.config.sunShelfLoungerCount===4,"resize retains lounger intent/quantity");
check(configuredSunShelfLoungers(state.config).count===0,"unavailable scene has no ghost loungers");
state=configuratorTesting.reducer(state,{type:"setShape",value:"l-shape"});
check(state.config.features.includes("sunShelf"),"shape change retains shelf request");
const saved=toProjectConfiguration(state.projectId,state.config,state.renovation);
const restored=parseProjectConfiguration(serializeProjectConfiguration(saved));
check(restored?.config.sunShelfLoungerCount===4 && restored.config.features.includes("sunShelfLoungers"),"snapshot round trip preserves unresolved intent");
check(comfortConfigurationIssues(restored.config).length>0,"restored invalid intent has explicit issues");
const invalidModel=buildProjectSummary(restored);
check(!!invalidModel.compatibilityIssues?.length,"summary records unresolved request");
await assert.rejects(()=>buildProjectBook({model:invalidModel,publicRef:"PW-0000-000000",shareUrl:"http://localhost/qa",issuedAt:new Date()})); checks++;
const lead={customer:{name:"QA local",email:"qa@example.invalid",phone:"0000000000",projectLocation:"QA"},commercial:{timing:"evaluating",notes:"No real email"},privacy:{accepted:true,marketingConsent:false},idempotencyKey:"parametric-qa-only",project:restored};
check(!leadSubmissionInputSchema.safeParse(lead).success,"server-side proposal rejects unresolved geometry");
state=configuratorTesting.reducer(state,{type:"setShape",value:"rectangle"});
state=configuratorTesting.reducer(state,{type:"setDimension",key:"width",value:5});
check(JSON.stringify(state.config.features)===JSON.stringify(requested),"restore dimensions preserves independent selections");
check(configuredSunShelfLoungers(state.config).count===4,"compatible scene restored without reselecting");
const validProject=toProjectConfiguration(state.projectId,state.config,state.renovation);
check(leadSubmissionInputSchema.safeParse({...lead,project:validProject}).success,"compatible proposal snapshot accepted locally, no send");
for(const count of [0,-2,2.9]) {
 const raw={...validProject,config:{...validProject.config,sunShelfLoungerCount:count}};
 const parsed=parseProjectConfiguration(JSON.stringify(raw));
 check(parsed.config.sunShelfLoungerCount===Math.max(1,Math.trunc(count)),"syntactic quantity normalises consistently");
 check(!leadSubmissionInputSchema.safeParse({...lead,project:raw}).success,"raw malformed quantity rejected server-side");
}
console.log(`Parametric comfort audit: ${checks} checks PASS`);
