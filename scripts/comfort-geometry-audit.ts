import assert from "node:assert/strict";
import { buildFloorProfile, subdivideFloorBoundary, computeSlopeMetrics } from "../src/lib/pool/floor-profile";
import { createSlopedFloorGeometry, createInteriorWallGeometry } from "../src/components/pool/three/poolGeometry";
import { buildOutline } from "../src/lib/pool/geometry";
import { resolveComfortPlan } from "../src/lib/pool/comfort-plan";
import { clampInfinityEdgeParams, infinityExclusion, infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import type { Dimensions, Outline } from "../src/lib/pool/types";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { resolveAccessPlan } from "../src/components/pool/three/PoolAccessModel";

let checks = 0;
const check = (condition: unknown, message: string) => {
  assert(condition, message);
  checks++;
};

function setup(dimensions: Dimensions) {
  const outline = buildOutline("rectangle", dimensions, DEFAULT_CONTROL_POINTS);
  const layout = getPoolVerticalLayout({
    poolType: "in-ground",
    system: "infinity",
    overflowType: "hidden",
    depth: dimensions.depth,
    copingThickness: 0,
  });
  const floor = buildFloorProfile({
    outline,
    shape: "rectangle",
    poolType: "in-ground",
    dimensions,
    verticalLayout: layout,
  });
  return { outline, layout, floor };
}

function rectBounds(outline: Outline) {
  const xs = outline.map((p) => p[0]);
  const zs = outline.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

function overlap(a: Outline, b: Outline) {
  const x = rectBounds(a), y = rectBounds(b);
  return !(x.maxX <= y.minX || x.minX >= y.maxX || x.maxZ <= y.minZ || x.minZ >= y.maxZ);
}

const standard = setup({ ...DEFAULT_DIMENSIONS, length: 10, width: 4.5, depth: 1.5 });
const standardPlan = resolveComfortPlan({
  outline: standard.outline,
  shape: "rectangle",
  poolType: "in-ground",
  system: "skimmer",
  floorProfile: standard.floor,
  waterY: standard.layout.waterY,
  enabled: ["sunShelf", "integratedBench"],
});
check(standardPlan.elements.length === 2, "standard pool builds both comfort elements");
check(standardPlan.elements[0]?.waterDepth === 0.22, "sun shelf keeps 22 cm water");
check(standardPlan.elements[1]?.waterDepth === 0.48, "bench keeps 48 cm seat depth");
check(!overlap(standardPlan.elements[0]!.footprint, standardPlan.elements[1]!.footprint), "comfort footprints never overlap");
check(standardPlan.displacedVolume > 0 && standardPlan.displacedVolume < 20, "volume displacement is finite and plausible");

const slope = setup({
  ...DEFAULT_DIMENSIONS,
  length: 8,
  width: 3,
  depth: 1.5,
  floorProfile: "slope",
  shallowDepth: 1.05,
});
const slopePlan = resolveComfortPlan({
  outline: slope.outline,
  shape: "rectangle",
  poolType: "in-ground",
  system: "overflow",
  floorProfile: slope.floor,
  waterY: slope.layout.waterY,
  enabled: ["sunShelf", "integratedBench"],
});
check(slopePlan.elements.length === 2, "8x3 sloped pool remains compatible");
check(slopePlan.displacedVolume > 0, "sloped floor displacement remains positive");
check(
  slopePlan.elements.every((element) =>
    element.footprint.every(([x, z]) => element.topY > slope.floor.floorYAt(x, z) + 0.02),
  ),
  "closed solids remain above the local sloped floor",
);

for (const zone of infinityZonesForOutline(standard.outline, "rectangle")) {
  const plan = resolveComfortPlan({
    outline: standard.outline,
    shape: "rectangle",
    poolType: "in-ground",
    system: "infinity",
    floorProfile: standard.floor,
    waterY: standard.layout.waterY,
    enabled: ["sunShelf", "integratedBench"],
    infinityExcluded: infinityExclusion(
      standard.outline,
      clampInfinityEdgeParams({ side: zone.side }),
      "rectangle",
    ),
  });
  check(plan.elements.length === 2, `Infinity side ${zone.side + 1} keeps two valid elements`);
}

const unsupported = resolveComfortPlan({
  outline: standard.outline,
  shape: "rectangle",
  poolType: "above-ground",
  system: "skimmer",
  floorProfile: standard.floor,
  waterY: standard.layout.waterY,
  enabled: ["sunShelf", "integratedBench"],
});
check(unsupported.elements.length === 0, "above-ground is explicitly unavailable");

for (const length of [6, 8, 12]) for (const depth of [1.2, 1.5, 2]) for (const sloped of [false, true]) {
  const context = setup({ ...DEFAULT_DIMENSIONS, length, width: 3.5, depth,
    floorProfile: sloped ? "slope" : "flat", shallowDepth: 1 });
  const plan = resolveComfortPlan({ outline: context.outline, shape: "rectangle", poolType: "in-ground",
    system: "skimmer", floorProfile: context.floor, waterY: context.layout.waterY,
    enabled: ["sunShelf", "integratedBench"] });
  const shelf = plan.elements.find(element => element.kind === "sunShelf");
  check(!!shelf?.steps?.length, `${length}m / ${depth}m / slope ${sloped}: mandatory flight`);
  const steps = shelf!.steps!;
  check(shelf!.riser! >= 0.15 && shelf!.riser! <= 0.24, "realistic regular rises");
  let previous = shelf!.topY;
  for (const step of steps) {
    check(Math.abs(previous - step.topY - shelf!.riser!) < 1e-8, "constant riser");
    const b = rectBounds(step.footprint);
    check(Math.abs(Math.min(b.maxX-b.minX,b.maxZ-b.minZ)-0.3)<1e-8, "30 cm tread");
    previous = step.topY;
  }
  const geometry = shelfStairGeometry(shelf!, context.floor);
  const positions=geometry.getAttribute("position"), normals=geometry.getAttribute("normal");
  check(Array.from(positions.array).every(Number.isFinite) && Array.from(normals.array).every(Number.isFinite), "finite mesh and normals");
  // Each undirected triangle edge has two incident faces after collinear grid welding.
  const edges=new Map<string,number>();
  for(let i=0;i<positions.count;i+=3) for(const [a,b] of [[0,1],[1,2],[2,0]]) {
    const key=[a!,b!].map(k=>[positions.getX(i+k),positions.getY(i+k),positions.getZ(i+k)].map(v=>v.toFixed(5)).join(",")).sort().join("|");
    edges.set(key,(edges.get(key)??0)+1);
  }
  check([...edges.values()].every(count=>count===2), "closed shelf/steps surface without internal duplicate faces");
  geometry.dispose();
}

for(const length of [6,8,10,12]) for(const system of ["skimmer","overflow","infinity"] as const)
for(const sunShelf of [false,true]) for(const bench of [false,true]) for(const sloped of [false,true])
for(const slopeReversed of [false,true]) {
  const dimensions={...DEFAULT_DIMENSIONS,length,width:3.5,depth:1.5,shallowDepth:1.05,
    floorProfile:sloped?"slope" as const:"flat" as const,slopeReversed};
  const outline=buildOutline("rectangle",dimensions,DEFAULT_CONTROL_POINTS);
  const layout=getPoolVerticalLayout({poolType:"in-ground",system,overflowType:"hidden",depth:1.5,copingThickness:0});
  const edge=system==="infinity"?clampInfinityEdgeParams({side:slopeReversed?1:3}):null;
  const floor=buildFloorProfile({outline,shape:"rectangle",poolType:"in-ground",dimensions,
    verticalLayout:layout,sunShelf,infinityEdge:edge});
  const plan=resolveComfortPlan({outline,shape:"rectangle",poolType:"in-ground",system,
    floorProfile:floor,waterY:layout.waterY,enabled:[...(sunShelf?["sunShelf" as const]:[]),...(bench?["integratedBench" as const]:[])],
    infinityExcluded:edge?infinityExclusion(outline,edge,"rectangle"):null});
  const shelf=plan.elements.find(e=>e.kind==="sunShelf");
  for(const element of plan.elements) {
    const solid=shelfStairGeometry(element,floor), vertices=solid.getAttribute("position");
    const edges=new Map<string,number>();
    for(let i=0;i<vertices.count;i+=3) for(const pair of [[0,1],[1,2],[2,0]]) {
      const key=pair.map(k=>[vertices.getX(i+k),vertices.getY(i+k),vertices.getZ(i+k)].map(v=>v.toFixed(5)).join(",")).sort().join("|");
      edges.set(key,(edges.get(key)??0)+1);
    }
    check([...edges.values()].every(n=>n===2),"matrix: shelf/bench watertight, including ramp hinge");
    solid.dispose();
  }
  check(!sunShelf || !!shelf?.steps?.length,"matrix: shelf always has integrated flight");
  if(sunShelf && sloped) {
    const zone=floor.shelfZone!;
    check(!!zone,"shelf slope has explicit shared hinge");
    const ladder=resolveAccessPlan({outline,access:"stainlessSteelLadder",floorProfile:floor,
      topY:layout.copingY,infinityExcluded:edge?infinityExclusion(outline,edge,"rectangle"):null});
    check(!ladder.reason && ladder.footprint.every(p=>zone.atMin
      ? p[floor.axis==="x"?0:1]>=zone.slopeStart+0.3
      : p[floor.axis==="x"?0:1]<=zone.slopeStart-0.3),"inox stays outside shelf/flight/landing");
    const last=shelf!.steps!.at(-1)!;
    check(last.footprint.every(p=>Math.abs(floor.floorYAt(...p)-floor.shallowFloorY)<1e-8),"no ramp under flight");
    check(Math.abs(last.topY-floor.shallowFloorY-shelf!.riser!)<1e-8,"final riser lands on shallow floor");
    check(Math.abs(Math.abs(zone.slopeStart-zone.end)-zone.flight.tread)<1e-8,"level landing is one tread");
    const coord=last.footprint.map(p=>p[floor.axis==="x"?0:1]);
    check(Math.abs((zone.atMin?Math.max(...coord):Math.min(...coord))-zone.end)<1e-8,"flight ends at canonical end");
    const metrics=computeSlopeMetrics(outline,floor,layout.waterY,layout.wallTopY);
    const shallowRun=zone.flight.totalRun+zone.flight.tread, ramp=length-shallowRun;
    check(Math.abs(metrics.floorSurface-3.5*(shallowRun+Math.hypot(ramp,floor.elevationDrop)))<1e-7,"piecewise metric exact");
  }
  if(!sunShelf) {
    const original=buildFloorProfile({outline,shape:"rectangle",poolType:"in-ground",dimensions,verticalLayout:layout});
    check(outline.every(p=>floor.floorYAt(...p)===original.floorYAt(...p)) && !floor.shelfZone,"shelf off unchanged");
  }
  const mesh=createSlopedFloorGeometry(outline,floor.floorYAt,floor);
  const p=mesh.getAttribute("position"), indices=mesh.index;
  const count=indices?.count??p.count;
  for(let i=0;i<count;i+=3) {
    const ids=[0,1,2].map(k=>indices?indices.getX(i+k):i+k);
    const x=ids.reduce((s,k)=>s+p.getX(k),0)/3, z=ids.reduce((s,k)=>s+p.getZ(k),0)/3;
    const y=ids.reduce((s,k)=>s+p.getY(k),0)/3;
    check(Math.abs(y-floor.floorYAt(x,z))<1e-6,"no floor triangle spans a profile kink");
  }
  mesh.dispose();
  const boundary=subdivideFloorBoundary(outline,floor);
  const walls=createInteriorWallGeometry(boundary,layout.wallTopY,floor.floorYAt,0.005,2,
    [{x:0,z:-1.75,rotation:0,width:0.4,top:-0.04,bottom:-0.22}]);
  const wp=walls.getAttribute("position");
  check(Array.from(wp.array).every(Number.isFinite),"finite walls including aperture/hinge");
  // The straight wall band ends exactly 5mm above the LOCAL floor cove,
  // including both ends of every aperture subdivision (not the midpoint).
  for(let i=0;i<wp.count;i++) {
    const x=wp.getX(i),z=wp.getZ(i),y=wp.getY(i);
    if(Math.abs(Math.abs(z)-1.75)<1e-6 && y < -0.3)
      check(Math.abs(y-floor.floorYAt(x,z)-0.005)<1e-6,"wall/cove seam has no wedge gaps");
  }
  walls.dispose();
}
console.log(`Comfort geometry PASS: ${checks} parametric checks.`);
