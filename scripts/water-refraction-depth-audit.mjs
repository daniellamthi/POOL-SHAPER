import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";

const source = readFileSync("src/components/pool/three/waterRefractionDepth.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const lens = { exports: {}, require: name => name === "three" ? THREE : { photoModeState: { active: false } }, queueMicrotask };
runInNewContext(ts.transpileModule(readFileSync("src/components/pool/three/flatWaterProjection.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, lens);
const context = { exports: {}, require: name => name === "three" ? THREE : lens.exports, queueMicrotask };
runInNewContext(code, context);
const { WaterRefractionDepth, WATER_DEPTH_REFRACTION } = context.exports;
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };

const owner = new WaterRefractionDepth();
const scene = new THREE.Scene();
const geometry = new THREE.BoxGeometry();
const floor = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
const dry = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
const water = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ transmission: 1 }));
const glass = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ transmission: 0.9 }));
const beam = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ depthWrite: false }));
const sky = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ depthWrite: false }));
const hidden = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); hidden.visible = false;
scene.add(floor, dry, water, glass, beam, sky, hidden);
const camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 500);
camera.position.set(4, 3, 5); camera.lookAt(0, -0.6, 0); camera.updateMatrixWorld(true);
const previous = new THREE.WebGLRenderTarget(2, 2);
let target = previous, renders = 0, fail = false;
const gl = {
  shadowMap: { autoUpdate: true }, xr: { enabled: true },
  getDrawingBufferSize: size => size.set(1440, 900),
  getRenderTarget: () => target, setRenderTarget: value => { target = value; }, clear() {},
  getClearColor: value => value.set(0), getClearAlpha: () => 1, setClearColor() {},
  render() {
    renders++;
    check(scene.overrideMaterial === owner.material, "Actual capture uses owned receiver/depth override");
    check(floor.visible && dry.visible, "Opaque emerged and submerged solids both contribute first-hit depth");
    check(!water.visible && !glass.visible && !beam.visible && !sky.visible && !hidden.visible, "No water/self feedback, glazing, additive volume or hidden mesh enters depth");
    check(!gl.shadowMap.autoUpdate && !gl.xr.enabled, "No new shadow/XR pass during depth capture");
    if (fail) throw new Error("Expected capture failure");
  },
};
check(owner.capture(gl, scene, camera, "geometry-1"), "First visible camera captures depth");
check(owner.target.width === 1024 && owner.target.height === 640, "Depth buffer is aspect-preserving and bounded to1024px");
check(target === previous && scene.overrideMaterial === null && gl.shadowMap.autoUpdate && gl.xr.enabled, "Capture restores all renderer/scene owners");
check(water.visible && glass.visible && beam.visible && sky.visible && !hidden.visible, "Original visibility restored exactly");
check(owner.uniforms.poolDepthReady.value, "Only a completed capture becomes usable");
owner.validateCamera(camera);
check(owner.uniforms.poolDepthReady.value, "Actual final camera matching the captured field keeps ripples valid");
check(!owner.capture(gl, scene, camera, "geometry-1") && renders === 1, "Stable frames do not recapture");
floor.material.color.set("red");
check(!owner.capture(gl, scene, camera, "geometry-1"), "Colour/light/ripple-only changes cost no new depth pass");
camera.position.x += 0.1; camera.updateMatrixWorld(true);
owner.validateCamera(camera);
check(!owner.uniforms.poolDepthReady.value && renders === 1, "A camera moved after useFrame cannot sample stale ripple depth or recursively render");
check(owner.capture(gl, scene, camera, "geometry-1"), "Real camera changes update first-hit depth");
check(owner.capture(gl, scene, camera, "geometry-2"), "Geometry/asset revision invalidates the capture");
camera.setViewOffset(1440, 900, 80, -120, 1440, 900);
check(owner.capture(gl, scene, camera, "geometry-2"), "Panel/off-axis projection changes cannot retain stale depth");
fail = true;
assert.throws(() => owner.capture(gl, scene, camera, "geometry-3")); checks++;
check(!owner.uniforms.poolDepthReady.value && target === previous && scene.overrideMaterial === null, "Failure leaves optics disabled and restores the target/override");
check(water.visible && !hidden.visible && gl.shadowMap.autoUpdate && gl.xr.enabled, "Failure restores visibility and flags too");
fail = false;

// Execute the shader's project/unproject mathematics with actual Three
// perspective/off-axis matrices and actual floor/stair/bench world positions.
for (const [width, height] of [[1440, 900], [390, 844], [430, 932]]) {
  for (const [x, y, z] of [[4, 3, 5], [0, 0.55, -0.3], [-7, 4, 3]]) {
    camera.aspect = width / height; camera.clearViewOffset();
    camera.position.set(x, y, z); camera.lookAt(0, -0.6, 0);
    camera.setViewOffset(width, height, width * 0.06, -height * 0.15, width, height);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    for (const point of [[0, -1.5, 0], [0.3, -0.2, 1], [-1, -0.5, -1], [2, 0.03, 1]]) {
      const world = new THREE.Vector3(...point);
      const ndc = world.clone().project(camera);
      const reconstructed = new THREE.Vector4(ndc.x, ndc.y, ndc.z, 1)
        .applyMatrix4(camera.projectionMatrixInverse);
      reconstructed.multiplyScalar(1 / reconstructed.w).applyMatrix4(camera.matrixWorld);
      check(new THREE.Vector3(reconstructed.x, reconstructed.y, reconstructed.z).distanceTo(world) < 1e-8, "Depth reconstructs real surfaces with desktop/mobile off-axis projection");
    }
  }
}
function ray(view, normal, ior) {
  const incident = view.clone().negate();
  const dot = incident.dot(normal), eta = 1 / ior;
  const k = 1 - eta * eta * (1 - dot * dot);
  return incident.multiplyScalar(eta).addScaledVector(normal, -(eta * dot + Math.sqrt(Math.max(0, k))));
}
function differential(view, normal, depth, ior) {
  const flat = ray(view, new THREE.Vector3(0, 1, 0), ior);
  const wave = ray(view, normal, ior);
  return wave.divideScalar(Math.max(Math.abs(wave.y), 0.25))
    .sub(flat.divideScalar(Math.max(Math.abs(flat.y), 0.25))).multiplyScalar(depth);
}
for (const view of [new THREE.Vector3(0.3, 0.8, 0.2).normalize(), new THREE.Vector3(0.9, 0.1, 0.3).normalize()]) {
  const normal = new THREE.Vector3(0.025, 1, 0.01).normalize();
  check(differential(view, new THREE.Vector3(0, 1, 0), 1.5, 1.333).length() < 1e-10, "Flat-interface image is exact identity, not an arbitrary permanent distortion");
  check(differential(view, normal, 1.5, 1).length() < 1e-10, "No refraction without an IOR difference");
  const shelf = differential(view, normal, 0.2, 1.333);
  const floorDelta = differential(view, normal, 1.5, 1.333);
  check(shelf.clone().multiplyScalar(7.5).distanceTo(floorDelta) < 1e-10, "Actual shallow shelf versus basin depth controls displacement");
  check(Math.abs(floorDelta.y) < 1e-10 && floorDelta.length() < 0.1, "Small surface slopes produce bounded tangential, not vertical geometry displacement");
}
check(WATER_DEPTH_REFRACTION.includes("poolWetReceiver") && WATER_DEPTH_REFRACTION.includes("waterShoreline"), "Opaque depth and actual basin domain both guard against pulling dry geometry into water");
let releases = 0; owner.target.addEventListener("dispose", () => { releases++; });
owner.retain(); owner.release(); owner.retain(); await new Promise(resolve => queueMicrotask(resolve));
check(releases === 0, "Immediate StrictMode remount retains depth resources");
owner.release(); await new Promise(resolve => queueMicrotask(resolve));
check(releases === 1, "True unmount disposes the owned render target once");
owner.dispose(); check(releases === 1, "Disposal is idempotent");
previous.dispose(); geometry.dispose();
for (const mesh of [floor, dry, water, glass, beam, sky, hidden]) mesh.material.dispose();
console.log(JSON.stringify({ status: "PASS", checks, scope: "Actual depth capture ownership/cache/failure paths; off-axis depth reconstruction and Snell differential invariants" }));
