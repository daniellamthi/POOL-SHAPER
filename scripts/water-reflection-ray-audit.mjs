import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const source = readFileSync('src/components/pool/three/WaterSurfaceMaterial.tsx', 'utf8');
const fragment = source.slice(source.indexOf('const REFLECTION_FRAGMENT'), source.indexOf('const DEBUG_FRAGMENT'));
check(fragment.includes('reflect(-normalize(cameraPosition - vWorldPosition),'), 'Incident ray uses the configured world camera');
check(fragment.includes('inverseTransformDirection(normal, viewMatrix)'), 'Wave normal converted from view to world space');
check(fragment.includes('waterTextureMatrix * vec4(reflectedRay, 0.0)'), 'Direction projection excludes translation');
check(fragment.includes('rippleMirrorCoord.w > 0.00001'), 'Reject directions behind the reflected camera');
check(fragment.includes('#ifdef WATER_METRIC_WAVES') && fragment.includes('#else\n  mirrorUv += combinedSlope * 0.015;'), 'Legacy Infinity/film lookup unchanged');
check(source.includes('if (basin && !reflectContext) basin.visible = false;'), 'Metric reflection retains emerged basin objects and selected lights');
check(source.includes('isWaterSurfaceMesh(object) || object.name === "pool-contact-shadows" || (!reflectContext && ('), 'Water feedback and baked shadow decals still excluded');
check(source.includes('}, [active, reflectContext, captureState]);'), 'Changing context invalidates the cached capture');
check(source.includes('if (basin) basin.visible = wasVisible;') && source.includes('for (const object of hiddenWater) object.visible = true;'), 'Original visibility restored after capture');

// Numerical reference, using actual Three matrices, including asymmetric
// view offsets and raised pools. GPU rendering is checked separately.
let maximumError = 0;
for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) {
  for (const level of [-0.1, 0, 1.4]) for (const height of [1, 4, 9]) for (const offset of [false, true]) {
    const camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 500);
    camera.position.set(length, level + height, width);
    camera.lookAt(0, level, 0);
    if (offset) camera.setViewOffset(1800, 1000, 50, 120, 1440, 900);
    camera.updateMatrixWorld(true);
    const mirror = camera.clone();
    mirror.position.y = 2 * level - camera.position.y;
    mirror.up.set(0, -1, 0);
    const target = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()));
    target.y = 2 * level - target.y;
    mirror.lookAt(target);
    mirror.updateMatrixWorld(true);
    const matrix = new THREE.Matrix4().set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1)
      .multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    for (const x of [-length / 2, 0, length / 2]) for (const z of [-width / 2, 0, width / 2]) {
      const point = new THREE.Vector3(x, level, z);
      const planar = new THREE.Vector4(x, level, z, 1).applyMatrix4(matrix);
      const ray = point.clone().sub(camera.position).normalize().reflect(new THREE.Vector3(0, 1, 0));
      const projected = new THREE.Vector4(ray.x, ray.y, ray.z, 0).applyMatrix4(matrix);
      const error = Math.max(Math.abs(planar.x / planar.w - projected.x / projected.w), Math.abs(planar.y / planar.w - projected.y / projected.w));
      maximumError = Math.max(maximumError, error);
      check(error < 1e-12, 'Flat wave normal reproduces the planar lookup exactly');
    }
  }
}
console.log(JSON.stringify({ status: 'PASS', checks, maximumError, scope: 'Shader integration contracts and flat-ray projection reference; browser/GPU acceptance separate' }));
