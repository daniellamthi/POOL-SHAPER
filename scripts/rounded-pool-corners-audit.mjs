import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from "three";

const cache = resolve("node_modules/.cache/rounded-pool-corners-audit");
await build({
  input: ["src/lib/pool/configured-outline.ts", "src/lib/pool/geometry.ts", "src/components/pool/three/poolGeometry.ts", "src/components/pool/three/poolConstruction.ts"],
  output: { dir: cache, format: "esm" }, platform: "node",
  resolve: { alias: { "@": resolve("src") } },
  external: ["three", "three/addons/utils/BufferGeometryUtils.js"],
});
const { configuredOutline, DEDICATED_POOL_CORNER_RADIUS: radius, POOL_CORNER_ARC_SEGMENTS: segments } =
  await import(pathToFileURL(`${cache}/configured-outline.js`));
const { buildOutline, outlineArea, outlineBounds } = await import(pathToFileURL(`${cache}/geometry.js`));
const { createSurfaceGeometry, createWallGeometry } = await import(pathToFileURL(`${cache}/poolGeometry.js`));
const { createCopingSlabGeometry } = await import(pathToFileURL(`${cache}/poolConstruction.js`));
const { offsetOutline } = await import(pathToFileURL(`${cache}/geometry.js`));
const base = {
  shape: "rectangle", poolType: "in-ground", system: "overflow", overflowType: "continuous", copingStyle: "dedicated",
  dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0 },
  controlPoints: [[-.5,-.5], [.5,-.5], [.5,.5], [-.5,.5]],
};
const signedArea = outline => outline.reduce((sum, p, i) => {
  const q = outline[(i + 1) % outline.length]; return sum + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;
let checks = 0;
for (const [length, width] of [[6,3], [8,4], [12,5]]) {
  const config = { ...base, dimensions: { ...base.dimensions, length, width } };
  const outline = configuredOutline(config), raw = buildOutline(config.shape, config.dimensions, config.controlPoints);
  assert.equal(outline.length, 4 * (segments + 1));
  assert.deepEqual(outlineBounds(outline), outlineBounds(raw), "original metric bounds");
  assert(signedArea(outline) > 0, "counter-clockwise winding");
  const polygonCircleArea = 2 * segments * radius ** 2 * Math.sin(Math.PI / (2 * segments));
  assert(Math.abs(outlineArea(outline) - (length * width - 4 * radius ** 2 + polygonCircleArea)) < 1e-10, "exact sampled fillet area");
  assert(Math.abs(outlineArea(outline) - (length * width - (4 - Math.PI) * radius ** 2)) < .00021, "circular area approximation");
  const centers = [[-length/2+radius,-width/2+radius], [length/2-radius,-width/2+radius],
    [length/2-radius,width/2-radius], [-length/2+radius,width/2-radius]];
  for (let corner = 0; corner < 4; corner++) {
    const arc = outline.slice(corner * (segments + 1), (corner + 1) * (segments + 1));
    for (const point of arc) assert(Math.abs(Math.hypot(point[0]-centers[corner][0], point[1]-centers[corner][1]) - radius) < 1e-12, "20 cm circular fillet");
    const end = arc[segments], next = outline[((corner + 1) * (segments + 1)) % outline.length];
    assert(corner % 2 === 0 ? end[1] === next[1] : end[0] === next[0], "exact collinear straight span");
    checks += arc.length + 1;
  }
  for (let i = 0; i < outline.length; i++) {
    const point = outline[i], next = outline[(i+1)%outline.length];
    assert(Number.isFinite(point[0] + point[1]));
    assert(Math.hypot(point[0]-next[0], point[1]-next[1]) > 1e-9, "no zero-length edge");
    assert(Math.abs(point[0]) <= length/2 && Math.abs(point[1]) <= width/2, "fillets stay inside original bounds");
    checks += 3;
  }
  checks += 5;
  const material = new MeshBasicMaterial({side: DoubleSide});
  const water = createSurfaceGeometry(outline), wall = createWallGeometry(outline, 0, -1.5);
  const coping = createCopingSlabGeometry(outline, offsetOutline(outline, .32), .02, null, false, .006);
  const hit = (geometry, origin, direction) => {
    const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld();
    return new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(mesh)[0];
  };
  const corner = [length/2-.01, 1, width/2-.01];
  assert(!hit(water, corner, [0,-1,0]), "actual water mesh removes the former square corner");
  assert(hit(coping, corner, [0,-1,0]), "real coping fills the former square water corner");
  const n = Math.SQRT1_2, x = length/2-radius+radius*n, z = width/2-radius+radius*n;
  const wallHit = hit(wall, [x+n*.05, -.3, z+n*.05], [-n,0,-n]);
  assert(wallHit && Math.abs(wallHit.distance-.05) < .001, "actual wall follows the same circular corner");
  for (const geometry of [water, wall, coping]) {
    assert([...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite), "finite actual rendered geometry");
    geometry.dispose();
  }
  material.dispose(); checks += 6;
}
const cross = (a, b, c) => (b[0]-a[0]) * (c[1]-a[1]) - (b[1]-a[1]) * (c[0]-a[0]);
const cornerSpec = (outline, index) => {
  const point = outline[index], previous = outline[(index+outline.length-1)%outline.length], next = outline[(index+1)%outline.length];
  const inLength = Math.hypot(point[0]-previous[0], point[1]-previous[1]), outLength = Math.hypot(next[0]-point[0], next[1]-point[1]);
  const incoming = [(point[0]-previous[0])/inLength, (point[1]-previous[1])/inLength];
  const outgoing = [(next[0]-point[0])/outLength, (next[1]-point[1])/outLength];
  const turn = Math.sign(incoming[0]*outgoing[1]-incoming[1]*outgoing[0]);
  const r = Math.min(radius, Math.min(inLength,outLength)/2*(1-1e-6));
  const first = [point[0]-incoming[0]*r, point[1]-incoming[1]*r];
  return { point, incoming, outgoing, turn, r,
    center: [first[0]-incoming[1]*r*turn, first[1]+incoming[0]*r*turn] };
};
function auditSelectedCorners(config) {
  const raw = buildOutline(config.shape, config.dimensions, config.controlPoints), outline = configuredOutline(config);
  const cornerSpecs=raw.map((_,i)=>cornerSpec(raw,i));
  const convexCount=cornerSpecs.filter(corner=>corner.turn>0).length;
  assert.equal(outline.length,convexCount*(segments+1)+raw.length-convexCount);
  assert.deepEqual(outlineBounds(outline), outlineBounds(raw));
  assert(signedArea(outline)>0);
  const sampledAreaChange = convexCount*(radius**2-segments*radius**2/2*Math.sin(Math.PI/(2*segments)));
  assert(Math.abs(outlineArea(outline)-(outlineArea(raw)-sampledAreaChange)) < 1e-10, "outer fillet area, square reflex recess preserved");
  const material = new MeshBasicMaterial({side: DoubleSide});
  const water = createSurfaceGeometry(outline), wall = createWallGeometry(outline, 0, -1.5);
  const outer = offsetOutline(outline,.32);
  assert.equal(outer.length,outline.length,"matching coping stations, including square reflex corner");
  const coping = createCopingSlabGeometry(outline,outer,.055,null,false,.006);
  const hit = (geometry, origin, direction) => {
    const mesh = new Mesh(geometry,material);mesh.updateMatrixWorld();
    return new Raycaster(new Vector3(...origin),new Vector3(...direction)).intersectObject(mesh)[0];
  };
  let station=0;
  for(let corner=0;corner<raw.length;corner++){
    const spec=cornerSpecs[corner], count=spec.turn>0?segments+1:1;
    const arc=outline.slice(station,station+count);
    if(spec.turn>0)for(const point of arc){assert(Math.abs(Math.hypot(point[0]-spec.center[0],point[1]-spec.center[1])-spec.r)<1e-12,"exact outer circular fillet");checks++;}
    else {assert.deepEqual(arc,[spec.point],"original single square reflex recess vertex preserved");checks++;}
    station+=count;
    const end=arc[count-1], next=outline[station%outline.length];
    assert(Math.abs(cross(spec.point,raw[(corner+1)%raw.length],end))<1e-12);
    assert(Math.abs(cross(spec.point,raw[(corner+1)%raw.length],next))<1e-12);
    // Stay beside the intentional diagonal slab joint at the square reflex corner.
    const inDistance=spec.turn>0?.01:.007, outDistance=spec.turn>0?.01:.013;
    const x=spec.point[0]-inDistance*spec.incoming[0]+outDistance*spec.outgoing[0];
    const z=spec.point[1]-inDistance*spec.incoming[1]+outDistance*spec.outgoing[1];
    assert.equal(Boolean(hit(water,[x,1,z],[0,-1,0])),false,"water follows rounded outer and original square recess corners");
    assert(hit(coping,[x,1,z],[0,-1,0]),`coping follows actual water boundary: ${config.shape}/${config.dimensions.lShapeOrientation ?? "rectangle"}/${config.system}, corner ${corner}, turn ${spec.turn}, sample ${x},${z}`);
    const middle=spec.turn>0?arc[segments/2]:[spec.point[0]-spec.incoming[0]*.1,spec.point[1]-spec.incoming[1]*.1];
    const nx=spec.turn>0?(middle[0]-spec.center[0])/spec.r:spec.incoming[1];
    const nz=spec.turn>0?(middle[1]-spec.center[1])/spec.r:-spec.incoming[0];
    const wallHit=hit(wall,[middle[0]+nx*.05,-.3,middle[1]+nz*.05],[-nx,0,-nz]);
    assert(wallHit&&Math.abs(wallHit.distance-.05)<.001,"wall follows rounded outer corners and square recess");
    checks+=5;
  }
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    assert(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-9,"nonzero fillet and straight edges");
    for(let j=i+2;j<outline.length;j++){
      if(i===0&&j===outline.length-1)continue;
      const c=outline[j],d=outline[(j+1)%outline.length];
      assert(!(cross(a,b,c)*cross(a,b,d)<-1e-18&&cross(c,d,a)*cross(c,d,b)<-1e-18),"no self-intersection");
    }
    checks++;
  }
  for(const geometry of [water,wall,coping].filter(Boolean)){
    assert([...geometry.attributes.position.array,...geometry.attributes.normal.array].every(Number.isFinite));
    geometry.dispose();checks++;
  }
  material.dispose();checks+=4;
}
function auditSkimmerSquare(config) {
  for(const copingEdge of [undefined,"square"]){
    assert.deepEqual(configuredOutline({...config,copingEdge}),buildOutline(config.shape,config.dimensions,config.controlPoints),"Skimmer default and Retto retain original square geometry");
    checks++;
  }
}
for(const [length,width] of [[6,3],[8,4],[12,5]]){
  const config={...base,system:"skimmer",copingEdge:"rounded",dimensions:{...base.dimensions,length,width}};
  auditSelectedCorners(config);auditSkimmerSquare(config);
}
for(const lShapeOrientation of ["se","sw","ne","nw"])
  for(const system of ["skimmer","overflow"]){
    const config={...base,shape:"l-shape",system,copingEdge:"rounded",dimensions:{...base.dimensions,length:8,width:6,lShapeOrientation}};
    auditSelectedCorners(config);if(system==="skimmer")auditSkimmerSquare(config);
  }
for (const shape of ["rectangle", "l-shape", "organic", "custom"])
  for (const poolType of ["in-ground", "above-ground"])
    for (const system of ["skimmer", "overflow", "infinity"])
      for (const overflowType of ["continuous", "hidden", "visible"])
        for (const copingStyle of [undefined, "flush", "dedicated"])
          for (const copingEdge of [undefined,"square","rounded"]) {
          const config = { ...base, shape, poolType, system, overflowType, copingStyle, copingEdge };
          if ((shape === "rectangle" || shape === "l-shape") && poolType === "in-ground" &&
            (system === "overflow" && overflowType === "continuous" && copingStyle === "dedicated" || system === "skimmer" && copingEdge === "rounded")) continue;
          assert.deepEqual(configuredOutline(config), buildOutline(shape, config.dimensions, config.controlPoints), "non-target outline remains byte-identical");
          checks++;
        }
for (const [length, width] of [[.01,.01], [.4,.3], [NaN,Infinity]]) {
  const outline = configuredOutline({ ...base, dimensions: { ...base.dimensions, length, width } });
  assert(outline.every((point, i) => {
    const next = outline[(i+1)%outline.length];
    return Number.isFinite(point[0]+point[1]) && Math.hypot(point[0]-next[0],point[1]-next[1]) > 0;
  }), "malformed legacy dimensions remain finite and nondegenerate");
  checks++;
}
console.log(`PASS: ${checks} checks; dedicated and Skimmer rounded rectangles, L-shapes in 4 orientations, 20 cm outer fillets with square L recess preserved, matching coping stations, actual water/wall/coping rays, unchanged bounds and all non-target outlines including default/square Skimmer`);
