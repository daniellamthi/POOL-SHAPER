import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(process.cwd()+"/package.json")("typescript");
const source = readFileSync("src/lib/pool/catalogue-patio.ts", "utf8");
const { planCataloguePatio } = runInNewContext(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText + "; exports;",
  { exports: {} },
);
const shapes = [
  [[-4,-7],[4,-7],[4,7],[-4,7]],
  [[-6,-7],[6,-7],[6,0],[0,0],[0,7],[-6,7]],
  Array.from({length:48}, (_,i) => [7*Math.cos(i*Math.PI/24), 5*Math.sin(i*Math.PI/24)]),
];
let cases = 0, parts = 0;
for (const shape of shapes) for (const scale of [.5,1,3]) for (const sx of [-1,1]) for (const sz of [-1,1]) for (const accessories of [false,true]) {
  const terrace = shape.map(([x,z])=>[x*scale,z*scale]);
  const occupied = accessories ? [[-12*scale,0,4*scale],[11*scale,2,-10*scale]] : [];
  const before = JSON.stringify([terrace,occupied]);
  const plan = planCataloguePatio(terrace,occupied,[sx,.9,sz]);
  assert(plan);
  assert.equal(JSON.stringify([terrace,occupied]),before,"input mutation");
  const b = plan.protectedBounds;
  const posts=plan.parts.filter(p=>p.finish==='wood'&&p.size[1]>=2.3&&p.size[0]<=.12&&p.size[2]<=.12);
  const slats=plan.parts.filter(p=>p.finish==='wood'&&p.position[1]>2.5);
  assert.equal(posts.length,4,'four metric supports outside circulation');
  assert.equal(slats.length,16,'bounded open overhead slats');
  for(const post of posts)for(const other of plan.parts){
    if(post===other||other.finish==='gravel')continue;
    const overlap=[0,1,2].every(axis=>Math.min(post.position[axis]+post.size[axis]/2,other.position[axis]+other.size[axis]/2)-Math.max(post.position[axis]-post.size[axis]/2,other.position[axis]-other.size[axis]/2)>1e-8);
    assert(!overlap,'support must not penetrate seat/walls/other members; contact is allowed');
  }
  for(const p of posts){assert(Math.abs(p.position[1]-p.size[1]/2)<1e-9,'supports rest at ground');assert.equal(p.size[1],2.4,'human-scale clear height does not grow with pool size');}
  assert(Math.abs(Math.max(...plan.parts.map(p=>p.position[1]+p.size[1]/2))-2.64)<1e-9,'fixed canopy height');
  assert(plan.parts.length <= 70,"bounded geometry budget");
  assert.equal(new Set(plan.parts.map(p=>p.finish)).size,5,"five draw batches");
  for (const p of plan.parts) {
    assert([...p.position,...p.size].every(Number.isFinite));
    assert(p.size.every(v=>v>0));
    const [x,,z] = p.position, [w,,d] = p.size;
    const clear = x+w/2 <= b.minX-.7 || x-w/2 >= b.maxX+.7 || z+d/2 <= b.minZ-.7 || z-d/2 >= b.maxZ+.7;
    assert(clear,`patio overlaps protected circulation: ${p.finish}`);
    parts++;
  }
  const mirror = planCataloguePatio(terrace.map(([x,z])=>[-x,-z]), occupied.map(([x,y,z])=>[-x,y,-z]),[-sx,.9,-sz]);
  assert.equal(plan.parts.length,mirror.parts.length);
  plan.parts.forEach((p,i)=> {
    assert(Math.abs(p.position[0]+mirror.parts[i].position[0])<1e-9);
    assert(Math.abs(p.position[2]+mirror.parts[i].position[2])<1e-9);
  });
  cases++;
}
assert.equal(planCataloguePatio([],[],[1,1,1]),null);
assert.equal(planCataloguePatio([[NaN,0],[1,0],[0,1]],[],[1,1,1]),null);
assert.equal(planCataloguePatio(shapes[0],[[Infinity,0,0]],[1,1,1]),null);
assert.equal(planCataloguePatio(shapes[0],[],[NaN,1,1]),null);
assert.equal(planCataloguePatio([[0,0],[151,0],[0,1]],[],[1,1,1]),null);
console.log(JSON.stringify({status:"PASS",cases,partsChecked:parts,clearanceMetres:.7,maxDrawBatches:5}));
