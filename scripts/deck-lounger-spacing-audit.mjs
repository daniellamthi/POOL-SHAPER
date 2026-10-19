import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";

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
      export { offsetOutline } from "${root}/src/lib/pool/geometry.ts";
      export { pointInBasin } from "${root}/src/lib/pool/boundary-placement.ts";
      export { DECK_CHAISE_MODEL, DECK_CHAISE_LAYOUT } from "${root}/src/lib/pool/sun-shelf-model.ts";
    ` : null,
  }],
});
const { planDeckFurniture, studioDeckBand, studioDeckInnerOffset, offsetOutline, pointInBasin,
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
    check(plan.rows.reduce((n,r)=>n+r.offsets.length,0) === 4, "four full-size deck loungers fit");
    for (const row of plan.rows) {
      const c=Math.cos(row.rotation), s=Math.sin(row.rotation);
      const world=(x,z)=>({x:row.x+x*c+z*s,z:row.z-x*s+z*c});
      for (let i=1;i<row.offsets.length;i++) {
        const gap=row.offsets[i]-row.offsets[i-1]-model.width;
        check(gap >= spacing.between-1e-7, "at least 70 cm between adjacent loungers");
      }
      const centreDistance = Math.abs(c)>0.5 ? Math.abs(row.z)-width/2 : Math.abs(row.x)-length/2;
      check(centreDistance-model.length/2-innerOffset >= 1-1e-7, "one metre from external coping to foot");
      check(innerOffset+band-centreDistance-model.length/2 >= spacing.rearMargin-1e-7, "rear margin on paving");
      for (const offset of row.offsets) for(const dx of [-model.width/2,model.width/2]) for(const dz of [-model.length/2,model.length/2]) {
        const p=world(offset+dx,dz);
        check(pointInBasin(p.x,p.z,outer)&&!pointInBasin(p.x,p.z,inner), "entire real-size footprint supported on terrace");
      }
    }
    check(planDeckFurniture(outline,innerOffset,band,[],{loungers:false,shower:false}).rows.length===0,"OFF removes all deck furniture");
    const obstacle={x:plan.rows[0].x,z:plan.rows[0].z};
    const replan=planDeckFurniture(outline,innerOffset,band,[obstacle],{loungers:true,shower:false});
    check(replan.rows.length>0 && replan.rows.every(r=>Math.hypot(r.x-obstacle.x,r.z-obstacle.z)>1.9),"access obstacle moves row to clear side");
    if(poolType==="in-ground"&&system==="skimmer") report.push({size:`${length}×${width}`,band,walkway:spacing.walkway,gap:spacing.between});
  }
}
console.log(JSON.stringify({result:"PASS",checks,report},null,2));
