import assert from "node:assert/strict";
import { BufferGeometry, Float32BufferAttribute, ShaderLib, Texture } from "three";
import { GroundedSkybox } from "three/addons/objects/GroundedSkybox.js";
import { coastalGrade, COAST_PHOTO_CAPTURE } from "../src/components/pool/three/coastalLayout";
import { CoastalGroundMaterial } from "../src/components/pool/three/CoastalGroundMaterial";
import type { RectangleInfinityZone } from "../src/lib/pool/infinity-edge";
import type { Outline } from "../src/lib/pool/types";

const outline: Outline = [[-4,-2],[4,-2],[4,2],[-4,2]];
const zone = { start:[-4,2], end:[4,2], normal:[0,1] } as RectangleInfinityZone;
const map = new Texture();
const dome = new GroundedSkybox(map, COAST_PHOTO_CAPTURE.height, COAST_PHOTO_CAPTURE.radius, 64);
dome.position.y = COAST_PHOTO_CAPTURE.eyeY;
const position = dome.geometry.getAttribute("position");
let checks = 0;
for (let i=0;i<position.count;i++) {
  const worldY = position.getY(i) + dome.position.y;
  assert.ok(worldY >= COAST_PHOTO_CAPTURE.groundY - 1e-6, "photographic floor never passes below calibrated support");
  checks++;
}
dome.geometry.computeBoundingBox();
assert.ok(Math.abs(dome.geometry.boundingBox!.min.y + dome.position.y - COAST_PHOTO_CAPTURE.groundY)<1e-6);
checks++;
const samples = [[-6,0,0],[-5,0,0],[0,0,-4],[0,-.9,3],[0,0,8],[10,0,0],[0,0,-8]];
const grade = new BufferGeometry();
grade.setAttribute("position",new Float32BufferAttribute(samples.flat(),3));
coastalGrade(grade,zone,outline);
const gradePosition = grade.getAttribute("position");
for(let i=0;i<4;i++) {
  assert.ok(Math.abs(gradePosition.getY(i)-samples[i]![1]!)<1e-6,"installed deck/receiving-channel support remains unchanged");
  checks++;
}
for(let i=4;i<samples.length;i++) {
  assert.ok(Math.abs(gradePosition.getY(i)-.002-COAST_PHOTO_CAPTURE.groundY)<1e-6,"real outer grade and photographic support share world height");
  checks++;
}
const material = CoastalGroundMaterial({map,rotation:0,outline,projectionHeight:COAST_PHOTO_CAPTURE.height});
assert.equal(material.props.transparent,false);
assert.equal(material.props.toneMapped,false);
const shader = {uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
material.props.onBeforeCompile(shader);
assert.ok(shader.fragmentShader.includes("diffuseColor *= texture2D(map, coastUv)") && !shader.fragmentShader.includes("diffuseColor.a *= "),"photographic ground remains opaque");
checks+=3;
dome.geometry.dispose();dome.material.dispose();grade.dispose();map.dispose();
console.log(`PASS: ${checks} coastal-ground checks — calibrated backdrop support, preserved local grade, shared opaque photographic projection.`);
