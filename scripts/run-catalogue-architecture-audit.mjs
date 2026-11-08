import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const {FloatType}=THREE;
const source = readFileSync("src/lib/pool/catalogue-architecture.ts", "utf8");
const { planCatalogueArchitecture: plan } = runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText + ";exports;",
  { exports: {} },
);
const lounger=runInNewContext(ts.transpileModule(readFileSync("src/components/pool/three/catalogueLounger.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+";exports;",{exports:{},require:id=>id==="three"?THREE:id.includes("RoundedBoxGeometry")?{RoundedBoxGeometry}:id.includes("BufferGeometryUtils")?{mergeGeometries}:id.includes("TessellateModifier")?{TessellateModifier}:{CATALOGUE_LOUNGER_RECLINE:0.55}});
const {createCataloguePartGeometry:createPart}=runInNewContext(ts.transpileModule(readFileSync("src/components/pool/three/cataloguePartGeometry.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+";exports;",{exports:{},require:id=>id==="three"?THREE:id.includes("RoundedBoxGeometry")?{RoundedBoxGeometry}:lounger});
let maxArchitectureTriangles=0;
let cases = 0,
  parts = 0;
for (const setting of ["spa-wall", "spa-glass", "residence", "infinity-villa"])
  for (const [l, w] of [
    [3, 2],
    [10, 4.5],
    [25, 8],
  ])
    for (const rotate of [false, true])
      for (const normal of setting === "infinity-villa"
        ? [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]
        : [undefined]) {
        const outline = [
          [-l / 2, -w / 2],
          [l / 2, -w / 2],
          [l / 2, w / 2],
          [-l / 2, w / 2],
        ].map(([x, z]) => (rotate ? [z + 7, x - 4] : [x + 7, z - 4]));
        const before = JSON.stringify(outline),
          p = plan(outline, setting, 0.35, 0, normal);
        assert(p);
        assert.equal(JSON.stringify(outline), before);
        assert(p.parts.length < 260, "bounded box count");
        assert(p.trees.length <= 10);
        assert(p.shrubs.length <= (p.indoor ? 60 : 5), "bounded scanned planting instances");
        assert(p.shrubs.flat().every(Number.isFinite));
        assert.equal(!!p.groundOutline, setting === "residence");
        if(p.groundOutline) assert(p.groundOutline.flat().every(Number.isFinite));
        assert([...p.camera.position, ...p.camera.target, p.camera.fov].every(Number.isFinite));
        assert(
          p.camera.position[1] >= 1.6 && p.camera.position[1] <= 3.1,
          "architectural eye height",
        );
        let geometryTriangles=0;
        for (const part of p.parts) {
          const mesh=createPart(part), sharp=new THREE.BoxGeometry(...part.s);
          if(part.tilt) sharp.rotateX(part.tilt); sharp.translate(...part.p);
          mesh.computeBoundingBox();sharp.computeBoundingBox();
          for(const axis of ["x","y","z"]){
            assert(mesh.boundingBox.min[axis]>=sharp.boundingBox.min[axis]-.0001);
            assert(mesh.boundingBox.max[axis]<=sharp.boundingBox.max[axis]+.0001,"bevel stays inside metric envelope");
          }
          assert(mesh.attributes.normal.array.every(Number.isFinite));
          assert(mesh.attributes.uv.array.every(Number.isFinite));
          geometryTriangles+=mesh.attributes.position.count/3;
          mesh.dispose();sharp.dispose();
          assert([...part.p, ...part.s].every(Number.isFinite));
          assert(part.s.every((v) => v > 0));
          // Architecture and furniture cannot occupy the basin volume.
          const [x, , z] = part.p,
            [sx, , sz] = part.s;
          const outside =
            x + sx / 2 <= -p.length / 2 ||
            x - sx / 2 >= p.length / 2 ||
            z + sz / 2 <= -p.width / 2 ||
            z - sz / 2 >= p.width / 2;
          assert(
            outside || part.p[1] - part.s[1] / 2 >= 3.1,
            `basin obstruction ${setting} ${part.finish}`,
          );
          if (setting === "infinity-villa")
            assert(
              z - sz / 2 >= -p.width / 2 || x - sx / 2 >= p.length / 2,
              "keep vanishing edge open",
            );
          parts++;
        }
        assert(geometryTriangles<60000,"bounded architecture triangles before vegetation");
        maxArchitectureTriangles=Math.max(maxArchitectureTriangles,geometryTriangles);
        cases++;
      }
assert.equal(plan([], "residence", 0.35, 0), null);
assert.equal(
  plan(
    [
      [NaN, 0],
      [1, 0],
      [0, 1],
    ],
    "residence",
    0.35,
    0,
  ),
  null,
);
console.log(JSON.stringify({ status: "PASS", cases, partsChecked: parts, maxArchitectureTriangles }));

const {CATALOGUE_GARDEN:garden}=runInNewContext(ts.transpileModule(readFileSync('src/lib/pool/catalogue-garden.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+';exports;',{exports:{}});
const bytes=readFileSync('public'+garden.url);
assert.equal(createHash('sha256').update(bytes).digest('hex'),'f14afaeb4ddd5ed4624b459a87f44cfc8215d4346fac0bb72304348c9a15dec7');
const hdr=new HDRLoader().setDataType(FloatType).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
assert.equal(hdr.width,2048);assert.equal(hdr.height,1024);
let luminance=0,sunX=0,sunY=0;
for(let y=0;y<hdr.height;y++)for(let x=0;x<hdr.width;x++){
 const i=(y*hdr.width+x)*4,l=hdr.data[i]*.2126+hdr.data[i+1]*.7152+hdr.data[i+2]*.0722;
 if(l>luminance){luminance=l;sunX=x;sunY=y;}
}
const lon=((sunX+.5)/hdr.width-.5)*2*Math.PI,lat=(.5-(sunY+.5)/hdr.height)*Math.PI;
const raw=[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];
for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
 const r=garden.rotation+angle;
 const fromHDR=[Math.cos(r)*raw[0]+Math.sin(r)*raw[2],raw[1],-Math.sin(r)*raw[0]+Math.cos(r)*raw[2]];
 const key=[Math.cos(angle)*garden.sun[0]+Math.sin(angle)*garden.sun[2],garden.sun[1],-Math.sin(angle)*garden.sun[0]+Math.cos(angle)*garden.sun[2]];
 assert(fromHDR.reduce((n,v,i)=>n+v*key[i],0)>.999,'key follows the actual HDR sun in each villa orientation');
}
console.log('PASS: 2K photographic asset SHA/dimensions, bounded garden/shrubs, matched HDR/key orientation in four rotations');

for(const [s,normalAxis,grainAxis] of [[[2,3.3,.2],"z","y"],[[4,.08,3],"y","x"],[[.82,.18,1.94],"y","z"]]){
 const g=createPart({finish:"wood",p:[0,0,0],s});
 const pos=g.getAttribute("position"),n=g.getAttribute("normal"),uv=g.getAttribute("uv");
 for(let i=0;i<pos.count;i++)if(n['get'+normalAxis.toUpperCase()](i)>.999)assert(Math.abs(uv.getX(i)-pos['get'+grainAxis.toUpperCase()](i))<1e-6,"wood grain follows real metre axis");
 g.dispose();
}
console.log("PASS: actual bevel meshes remain within metric envelopes, finite normals/UVs, correct vertical/ceiling/furniture grain");

for(const [file,sha] of [
 ['basecolor.jpg','5107c0400b3ceb551b2d9d3200460efc0509b543dca04be891a49869795d6ed7'],
 ['normal.jpg','f933166a6a3d3dff1dc671b4b93a3a19598c798b621f65bfe5d9bb37ab437ee4'],
 ['roughness.jpg','a681ab188a9066528dce5003dd5ddd00070f762101719aefa2172ee7f8a124d0'],
])assert.equal(createHash('sha256').update(readFileSync('public/textures/catalogue/oak/'+file)).digest('hex'),sha,'unedited original oak map');
const compile=(source,require)=>runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+';exports;',{exports:{},require});
const spot=compile(readFileSync('src/components/pool/three/spotLightWork.ts','utf8'),()=>THREE);
const req=id=>id==='three'?THREE:spot;
const beforeMask=compile(execFileSync('git',['show','HEAD:src/components/pool/three/exteriorLightMask.ts'],{encoding:'utf8'}),req).excludeSubmergedDirectLights;
const afterMask=compile(readFileSync('src/components/pool/three/exteriorLightMask.ts','utf8'),req).excludeSubmergedDirectLights;
for(const y of [-.16,-.054,0,1.5]){
 const before={uniforms:{},fragmentShader:'#include <lights_fragment_begin>'};
 const after={uniforms:{},fragmentShader:before.fragmentShader};
 beforeMask(before,y);afterMask(after,y);
 assert.equal(after.fragmentShader,before.fragmentShader,'legacy dry-receiver shader output unchanged');
 const room={uniforms:{},fragmentShader:'#include <lights_fragment_begin>'};afterMask(room,y,true);
 assert.equal(room.uniforms.exteriorWaterY.value,y);
 assert(room.fragmentShader.includes('rectAreaLight.position + cameraPosition).y >= exteriorWaterY'));
 assert(room.fragmentShader.includes('spotLight.position + cameraPosition).y >= exteriorWaterY'));
 assert(room.fragmentShader.includes('RE_Direct_RectArea( rectAreaLight,'),'above-water coves retained');
}
console.log('PASS: three original oak maps, legacy light-mask output unchanged at four elevations, room spot/area height guards');
