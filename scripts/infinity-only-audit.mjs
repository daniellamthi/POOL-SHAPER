import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
const cache = resolve("node_modules/.cache/infinity-only-audit");
await build({ input: ["src/components/pool/three/infinityContainment.ts", "src/components/pool/three/coastalLayout.ts", "src/components/pool/three/infinityLandscape.ts", "src/lib/pool/infinity-edge.ts", "src/lib/pool/store.tsx", "src/lib/pool/project.ts"], output: { dir: cache, format: "esm" }, platform: "node", resolve: { alias: { "@": resolve("src") } },
  plugins: [{ name: "no-server", resolveId(id) { if (id.endsWith("/projectDelivery.server")) return "\0no-rpc"; }, load(id) { if (id === "\0no-rpc") return "export const loadSharedProjectFn=()=>{throw Error('No QA RPC');};"; } }], external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"] });
const mod = async name => import(pathToFileURL(`${cache}/${name}.js`));
const { createInfinityContainmentGeometry, infinityContainmentLevels } = await mod("infinityContainment");
const { createCoastalTerrace, COAST_SEA_Y } = await mod("coastalLayout");
const { createInfinityDeck } = await mod("infinityLandscape");
const { rectangleInfinityZones, clampInfinityEdgeDimensions } = await mod("infinity-edge");
const { configuratorTesting: t } = await mod("store");
const { toProjectConfiguration, parseProjectConfiguration, serializeProjectConfiguration } = await mod("project");
let geometryCases = 0;
for (const [l, w] of [[6,3], [8,4], [12,5]]) {
  const outline = [[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]];
  for (const zone of rectangleInfinityZones(outline)) {
    const terrace = createCoastalTerrace(outline, zone, .33);
    const tp = terrace.getAttribute("position");
    const supportTop=infinityContainmentLevels(clampInfinityEdgeDimensions(),0).baseY;
    for (let i=0;i<tp.count;i++) assert.ok(Math.abs(tp.getY(i)+.04)<1e-6 || Math.abs(tp.getY(i)-supportTop)<1e-6 || Math.abs(tp.getY(i)-(COAST_SEA_Y-.2))<1e-6, "Level supported terrace, no rocky mound");
    const defaultDeck=createInfinityDeck(outline,zone,.33), explicitDeck=createInfinityDeck(outline,zone,.33,2);
    assert.deepEqual(defaultDeck.getAttribute("position").array,explicitDeck.getAttribute("position").array,"Approved two-metre deck unchanged");
    for(const g of [terrace,defaultDeck,explicitDeck])g.dispose();
    const dims = clampInfinityEdgeDimensions(), waterY = -.0005;
    const args = [zone, dims, waterY, .33, .055, outline];
    const all = createInfinityContainmentGeometry(...args);
    const receiver = createInfinityContainmentGeometry(...args, "receiver");
    const glass = createInfinityContainmentGeometry(...args, "glass");
    const signature = g => {
      const p = g.getAttribute("position"), triangles = [];
      for(let i=0;i<p.count;i+=3) triangles.push(Array.from(p.array.slice(i*3,(i+3)*3)).join(","));
      return triangles.sort();
    };
    assert.deepEqual([...signature(receiver), ...signature(glass)].sort(), signature(all), "Glass replaces the existing solid; no extra overlapping wall");
    glass.computeBoundingBox();
    assert.ok(Math.abs(glass.boundingBox.max.y - infinityContainmentLevels(dims, waterY).crestY) < 1e-7);
    assert.ok(Math.abs(waterY - glass.boundingBox.max.y - .006) < 1e-7, "Continuous 6 mm overflow film");
    const p = glass.getAttribute("position");
    const offsets = Array.from({length:p.count},(_,i)=>(p.getX(i)-zone.start[0])*zone.normal[0]+(p.getZ(i)-zone.start[1])*zone.normal[1]);
    assert.ok(Math.abs(Math.max(...offsets)-Math.min(...offsets)-(dims.lipWidth-.004))<1e-6,"Real panel thickness");
    for(const g of [all,receiver,glass])g.dispose(); geometryCases++;
  }
}
let state = [{type:"setProjectType",value:"new"},{type:"setPoolType",value:"in-ground"},{type:"setPoolStructure",value:"reinforced-concrete"},{type:"setShape",value:"rectangle"},{type:"setSystem",value:"infinity"},{type:"setInfinityWall",value:"glass"}].reduce(t.reducer,t.createInitialState());
for(const side of [0,1,2,3]) {
  state=t.reducer(state,{type:"setInfinitySide",value:side});
  state=t.reducer(state,{type:"setDimension",key:"length",value:8+side});
  assert.equal(state.config.infinityEdge.wallType,"glass");
  const saved=toProjectConfiguration("local-infinity-test",state.config,state.renovation);
  assert.equal(parseProjectConfiguration(serializeProjectConfiguration(saved)).config.infinityEdge.wallType,"glass");
}
state=t.reducer(state,{type:"setInfinityWall",value:"traditional"});
assert.notEqual(state.config.infinityEdge.wallType,"glass");
state=t.reducer(state,{type:"setSystem",value:"skimmer"});
assert.equal(state.config.infinityEdge,undefined);
assert.deepEqual(t.reducer(state,{type:"setInfinityWall",value:"glass"}),state);
console.log(`PASS ${geometryCases} Infinity side/size cases: unchanged combined containment, real glass thickness, crest/film elevations; side/dimension transitions and local persistence.`);
