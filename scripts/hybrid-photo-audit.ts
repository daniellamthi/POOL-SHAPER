import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
import { hybridStudioPose, hybridEnvironmentPose, HYBRID_ENVIRONMENTS, HYBRID_VIEWS } from "../src/lib/pool/hybrid-photo";
import type { Outline } from "../src/lib/pool/types";

let checks=0;
for(const [length,width] of [[6,3],[8,4],[12,5]]) for(const above of [false,true])
for(const aspect of [1440/650,390/420,430/500]) for(const view of HYBRID_VIEWS) {
  // Include external stair/landing footprint and railing height in the fitted bounds.
  const z=width/2+(above?1:0),x=length/2;
  const bounds:Outline=[[-x,-z],[x,-z],[x,z],[-x,z]];
  const original=JSON.stringify(bounds),ground=above?-1.5:0,rim=.15;
  const pose=hybridStudioPose(bounds,ground,rim,aspect,view.id);
  const camera=new PerspectiveCamera(pose.fov,aspect,.1,500);
  camera.position.set(...pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();
  for(const [px,pz] of bounds) for(const py of [ground,rim+1.2]) {
    const projected=new Vector3(px,py,pz).project(camera);
    assert.ok(Math.abs(projected.x)<=.841&&Math.abs(projected.y)<=.841,`${length}×${width} ${view.id} ${aspect}: cropped bounds`);
    checks++;
  }
  assert.equal(JSON.stringify(bounds),original);checks++;
  for(const environment of ["outdoor-villa","indoor-wellness"] as const) {
    const p=hybridEnvironmentPose(bounds,ground,rim,aspect,view.id,environment);
    camera.position.set(...p.position);camera.lookAt(...p.target);camera.updateMatrixWorld();
    for(const [px,pz] of bounds)for(const py of [ground,rim+1.2]) {
      const point=new Vector3(px,py,pz).project(camera);
      assert.ok(Math.abs(point.x)<=.881&&Math.abs(point.y)<=.881,`${environment}: cropped ${view.id}`);checks++;
    }
    if(environment==="indoor-wellness"){assert.ok(p.position[1]<rim+5.2,"camera must stay below ceiling");checks++;}
  }
}
assert.equal(HYBRID_ENVIRONMENTS.filter(e=>e.available).length,3);checks++;
const studio=readFileSync("src/components/pool/HybridPhotoStudio.tsx","utf8");
for(const guard of ["photoMode={false}","technicalView={false}","showMeasurements={false}","snapshot===JSON.stringify(projectConfiguration)","disabled={!ready||busy||!intact}"]) {
  assert.ok(studio.includes(guard),`missing fidelity/export guard ${guard}`);checks++;
}
assert.ok(!/\b(dispatch|setConfig|updateProject)\s*\(/.test(studio));checks++;
const viewport=readFileSync("src/components/pool/PoolViewport.tsx","utf8");
assert.ok(viewport.includes("if (scene.photoMode && premiumPresentationAvailable) return"));checks++;
assert.ok(viewport.includes("<DropdownMenuItem onSelect={onTogglePhotoMode}>"),"mobile must open the real photo dialog");checks++;
// Runtime planBounds can consist of only opposite corners. Fit their complete
// envelope, not merely those two diagonally placed points.
const diagonal:Outline=[[-6.5,-3],[6.5,3]];
for(const aspect of [1.3,2.4])for(const environment of ["outdoor-villa","indoor-wellness"] as const) {
  const pose=hybridEnvironmentPose(diagonal,0,.15,aspect,"hero",environment);
  const camera=new PerspectiveCamera(pose.fov,aspect,.05,500);
  camera.position.set(...pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();
  for(const x of [-6.5,6.5])for(const z of [-3,3])for(const y of [0,1.35]) {
    const p=new Vector3(x,y,z).project(camera);
    assert.ok(Math.abs(p.x)<=.881&&Math.abs(p.y)<=.881,"sparse plan bounds must not crop the other corners");checks++;
  }
}
const scene=readFileSync("src/components/pool/three/PoolScene.tsx","utf8");
assert.ok(scene.includes('indoorPhoto={hybridPhoto?.environment==="indoor-wellness"}'));checks++;
assert.ok(scene.includes('photoRelief={!!hybridPhoto}'));checks++;
assert.ok(scene.includes('toneMapping: ACTIVE_RENDERING_QUALITY.postProcessing.enabled && !hybridPhoto'),"raster photos need renderer tone mapping without the composer");checks++;
assert.ok(scene.includes('dpr={hybridPhoto ? [1,1.5]'),"preview budget must remain separate from PNG resolution");checks++;
const coast=readFileSync("src/components/pool/three/CoastalGroundMaterial.tsx","utf8");
assert.ok(coast.includes("photographicRelief = false"),"normal Infinity projection must retain its default");checks++;
const paving=readFileSync("src/components/pool/three/StudioPaving.tsx","utf8");
assert.ok(paving.includes('photoShadowWaterY')&&paving.includes('spotLights[ i ].position + cameraPosition).y > photoShadowWaterY'),"photo ground must exclude underwater fixture shadow footprints");checks++;
console.log(`PASS: ${checks} hybrid checks (studio bounds, immutable input, asset gate and source guards). Not a visual or GPU performance PASS.`);
