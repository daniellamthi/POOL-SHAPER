import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ShaderChunk } from 'three';

// Shader contract checks, not a substitute for orbit/visual QA.
const source = readFileSync(new URL('../src/components/pool/three/WaterSurfaceMaterial.tsx', import.meta.url), 'utf8');
const hook = 'vec4 transmitted = getIBLVolumeRefraction(';
assert.equal(ShaderChunk.transmission_fragment.split(hook).length, 2, 'Three transmission hook must match exactly once');
assert.match(source, /material\.thickness = 0\.0;\s*poolWaveNormal = inverseTransformDirection\(normal, viewMatrix\);\s*vec4 transmitted = getIBLVolumeRefraction\(/, 'Flat-interface baseline is unchanged; wave displacement uses the actual water normal');
assert.match(source, /poolWaveTransmissionUv\(fragCoord\.xy, ior\)/, 'Physical differential affects only the opaque transmission lookup');
assert.match(source, /const REFLECTION_ENABLED = ACTIVE_RENDERING_QUALITY\.planarReflection\.enabled;/, 'Reflection diagnostic must be reverted');
assert.match(source, /transmission=\{WATER_VISUAL_PRESET\.transmission\}/, 'Do not hide the defect by reducing transmission');
assert.match(source, /opacity=\{WATER_VISUAL_PRESET\.opacity\}/, 'Preserve opacity');
assert.match(source, /thickness=\{outline \? depth : Math\.min\(depth, 0\.22\)\}/, 'Preserve physical depth for still rendering');
assert.match(source, /normalMap=\{largeNormal\}/, 'Preserve ripple normals');
assert.doesNotMatch(source, /diagnostic|isolate-/, 'No temporary debug variant left behind');
assert.match(source, /clock\.elapsedTime - captureState\.time < 1 \/ 15/, 'Stationary mirror capture is rate-limited, not ripple animation');
assert.match(source, /renderQualityState\.idle && !cameraChanged/, 'Camera changes invalidate the stationary reflection');
assert.match(source, /const invalidated = resized \|\| captureState\.waterLevel !== waterLevel/, 'Resized targets and waterline changes cannot retain stale captures');
const scene = readFileSync(new URL('../src/components/pool/three/PoolScene.tsx', import.meta.url), 'utf8');
assert.match(scene, /shadow-autoUpdate=\{false\}/, 'Static sun shadows are cached');
assert.match(scene, /useLayoutEffect\(\(\) => \{\s*if \(sunLight\.current\) sunLight\.current\.shadow\.needsUpdate = true;\s*\},\[shadowRevision,assetsLoading\]\);/, 'Geometry and async asset changes invalidate sun shadows');
const revision = scene.slice(scene.indexOf('const shadowRevision='), scene.indexOf('const shadowRevision=') + scene.slice(scene.indexOf('const shadowRevision=')).indexOf(']);') + 3);
for (const input of ['outline', 'system', 'overflowType', 'poolType', 'length', 'width', 'depth', 'features', 'infinityEdge', 'coverPlan.extension', 'internalStairMirrored', 'loungers']) assert(revision.includes(input), `${input} must invalidate the shadow silhouette`);
assert.doesNotMatch(revision, /sceneTime|ledColor|visualTheme|focus|cameraLocked/, 'Uniform-only lighting/camera changes do not rebuild static sun shadows');
console.log('PASS: water/transmission invariants and geometry-aware shadow invalidation contracts (runtime and visual QA separately required)');
