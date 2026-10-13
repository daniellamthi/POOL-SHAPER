import assert from "node:assert/strict";
import { offsetOutline } from "../src/lib/pool/geometry";
import type { Outline } from "../src/lib/pool/types";
import { squareInfinityCopingEnds, createCopingSlabGeometry } from "../src/components/pool/three/poolConstruction";
import { createRingGeometry } from "../src/components/pool/three/poolGeometry";

let cases = 0;
for (const [length, width] of [[6,3], [8,4], [12,5]]) {
  for (const rotation of [0, 0.37]) {
    const inner: Outline = [[-length!/2,-width!/2],[length!/2,-width!/2],[length!/2,width!/2],[-length!/2,width!/2]]
      .map(([x,z])=>[x!*Math.cos(rotation)-z!*Math.sin(rotation),x!*Math.sin(rotation)+z!*Math.cos(rotation)] as const);
    const outer = offsetOutline(inner, 0.32);
    assert.equal(squareInfinityCopingEnds(inner, outer, null), outer, "non-Infinity unchanged");
    const before = JSON.stringify(outer);
    for (let side=0; side<4; side++) {
      const excluded = new Set([side]);
      const squared = squareInfinityCopingEnds(inner, outer, excluded);
      assert.equal(JSON.stringify(outer), before, "input not mutated");
      for (let i=0;i<4;i++) {
        if (i!==side && i!==(side+1)%4) {
          assert.deepEqual(squared[i], outer[i], "other corners untouched");
          continue;
        }
        const adjacent = i===side ? (i+3)%4 : (i+1)%4;
        const dx=inner[adjacent]![0]-inner[i]![0], dz=inner[adjacent]![1]-inner[i]![1];
        const ex=squared[i]![0]-inner[i]![0], ez=squared[i]![1]-inner[i]![1];
        assert(Math.abs(dx*ex+dz*ez)<1e-9, "terminal cut is perpendicular (90 degrees)");
        assert(Math.abs(Math.hypot(ex,ez)-0.32)<1e-9, "full border width retained");
      }
      const slab=createCopingSlabGeometry(inner,squared,0.055,excluded);
      const bed=createRingGeometry(inner,squared,false,excluded);
      const a=inner[side]!,b=inner[(side+1)%4]!;
      const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      for (const g of [slab,bed]) {
        const p=g.getAttribute("position");
        assert(p.count>0);
        for(let i=0;i<p.count;i++) {
          assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
          const outward=((p.getX(i)-a[0])*dz-(p.getZ(i)-a[1])*dx)/len;
          assert(outward<1e-6, "no diagonal horn beyond Infinity terminal plane");
        }
        g.dispose();
      }
      cases++;
    }
  }
}
console.log(`PASS: ${cases} Infinity square-end cases, all sides/sizes and rotated pools; coping and bed agree; non-Infinity preserved`);
