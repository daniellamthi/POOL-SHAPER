import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const THREE = await import(pathToFileURL(path.join(root, 'node_modules/three/build/three.module.js')));
const { PhysicalPathTracingMaterial } = await import(pathToFileURL(path.join(root, 'node_modules/three-gpu-pathtracer/src/index.js')));
function load(file, deps) {
  const module = { exports: {} };
  const code = ts.transpile(fs.readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  new Function('require', 'module', 'exports', code)(id => { assert(id in deps, id); return deps[id]; }, module, module.exports);
  return module.exports;
}
const optics = load('src/lib/pool/led-optics.ts', { three: THREE });
const { installPhotoLedTransport: install } = load('src/components/pool/three/photoLedTransport.ts', { three: THREE, '@/lib/pool/led-optics': optics });
const medium = load('src/components/pool/three/photoWaterMedium.ts', { three: THREE });
const material = new PhysicalPathTracingMaterial();
const original = material.fragmentShader;
const samplerCount = shader => (shader.match(/uniform\s+(?:[iu]?sampler\w+)/g) || []).length;
const tracer = { _pathTracer: { material } };
const uploads = [];
material.iesProfiles.setTextures = (_renderer, textures) => uploads.push([...textures]);
const map = new THREE.DataTexture(new Uint8Array(64).fill(255), 4, 4);
let borrowedDisposals = 0, cloneDisposals = 0;
map.addEventListener('dispose', () => borrowedDisposals++);
const cloneMap = map.clone.bind(map);
map.clone = () => { const clone = cloneMap(); clone.addEventListener('dispose', () => cloneDisposals++); return clone; };
let cases = 0;
for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const mediumOwnsAbsorption of [false, true]) {
  const scene = new THREE.Scene(), parent = new THREE.Group();
  parent.position.set(3, 0, -2); parent.rotation.y = angle; scene.add(parent);
  const lights = [];
  for (const x of [-2, 2]) {
    const group = new THREE.Group(); group.name = 'pool-underwater-led'; group.position.set(x, -.5, 1); parent.add(group);
    const led = new THREE.SpotLight('#ff8000', 160, 12, Math.PI * .4, 1, 2);
    led.map = map; led.position.z = .0172; group.add(led);
    led.target.position.set(x, -.9, -2); parent.add(led.target); lights.push(led);
  }
  const other = new THREE.SpotLight('#ffffff', 50); other.map = map;
  other.iesMap = new THREE.DataTexture(new Float32Array([1,1,1,1]),1,1); other.iesMap.uuid = 'profile-z'; scene.add(other);
  // The installed tracer collects a visible light even below a hidden parent.
  // Preserve its existing IES index rather than shifting unrelated profiles.
  const hiddenParent = new THREE.Group(); hiddenParent.visible = false;
  const hiddenProfile = new THREE.SpotLight(); hiddenProfile.iesMap = new THREE.DataTexture(new Float32Array([1,1,1,1]),1,1);
  hiddenProfile.iesMap.uuid = 'profile-a'; hiddenParent.add(hiddenProfile); scene.add(hiddenParent);
  scene.updateMatrixWorld(true);
  const before = JSON.stringify(scene.toJSON());
  const preserved = { value: 42 }; material.uniforms.ownerTest = preserved;
  const prior = { value: 'existing owned uniform' }; material.uniforms.catalogueLedWaterY = prior;
  const dispose = mediumOwnsAbsorption ? install(tracer, scene, 0, {}, true) : install(tracer, scene, 0, {});
  assert.equal(material.fragmentShader.includes('incident *= exp(-vec3('), !mediumOwnsAbsorption, 'exactly one owner of direct-water absorption');
  assert(material.fragmentShader !== original, 'actual tracer shader must adapt raw LED transport');
  assert.equal(samplerCount(material.fragmentShader), samplerCount(original), 'no additional GPU sampler');
  assert(!('catalogueLedDiffuser' in material.uniforms));
  assert.equal(material.uniforms.catalogueLedSources.value.length, 2, 'exclude unrelated mapped spot');
  lights.forEach((led, i) => {
    assert(material.uniforms.catalogueLedSources.value[i].distanceTo(led.getWorldPosition(new THREE.Vector3())) < 1e-10);
    const uv = led.target.getWorldPosition(new THREE.Vector3()).applyMatrix4(material.uniforms.catalogueLedProjection.value[i]);
    assert(Math.abs(uv.x - .5) < 1e-8 && Math.abs(uv.y - .5) < 1e-8, 'actual projected map follows transformed target');
  });
  const packed = uploads.at(-1);
  assert.equal(packed.length, 3, 'preserve the exact existing IES layer set before appending diffuser');
  assert.equal(packed[0].source,other.iesMap.source);assert.equal(packed[1].source,hiddenProfile.iesMap.source);
  assert.notEqual(packed[2],map);assert.equal(packed[2].source,map.source);
  assert(material.fragmentShader.includes('texture2D(iesProfiles, vec3(uv.xy, 2.0))'), 'append at free layer; original IES indices retained');
  assert.equal(JSON.stringify(scene.toJSON()), before, 'live scene byte-equivalent');
  const ledShader = material.fragmentShader;
  if (mediumOwnsAbsorption) {
    const undoMedium = medium.installPhotoWaterMedium(tracer, medium.preparePhotoWaterMedium({
      outline: [[-4,-2],[4,-2],[4,2],[-4,2]], waterY: 0, bottomY: -1.5, absorption: [.45,.14,.035],
    }));
    assert(material.fragmentShader.includes('poolPhotoWaterLength( ray.origin, ray.direction, surfaceHit.dist )'));
    assert(material.fragmentShader.includes('poolPhotoWaterLength( startPoint, ray.direction, rayDist )'));
    assert(!material.fragmentShader.includes('incident *= exp(-vec3('), 'medium owns direct-path extinction exactly once');
    assert.equal(samplerCount(material.fragmentShader), samplerCount(original), 'combined adapters add no sampler');
    undoMedium(); undoMedium(); assert.equal(material.fragmentShader, ledShader, 'reverse teardown retains the LED adapter');
    assert(!('poolPhotoWaterAbsorption' in material.uniforms));
  }
  dispose(); dispose();
  assert.equal(material.fragmentShader, original); assert.equal(material.uniforms.ownerTest, preserved);
  assert.equal(material.uniforms.catalogueLedWaterY, prior); assert(!('catalogueLedSources' in material.uniforms));
  assert.equal(borrowedDisposals, 0); assert.equal(cloneDisposals, cases + 1);
  for (const led of lights) led.intensity = 0;
  const off = install(tracer, scene, 0, {}); assert.equal(material.fragmentShader, original); off();
  for (const led of lights) led.intensity = 160;
  parent.visible = false;
  const hidden = install(tracer, scene, 0, {}); assert.equal(material.fragmentShader, original); hidden(); parent.visible = true;
  const badLevel = install(tracer, scene, NaN, {}); assert.equal(material.fragmentShader, original); badLevel();
  material.fragmentShader = 'unsupported library revision';
  assert.throws(() => install(tracer, scene, 0, {}), /transport shader/);
  assert.equal(material.fragmentShader, 'unsupported library revision'); material.fragmentShader = original;
  other.iesMap.dispose(); hiddenProfile.iesMap.dispose();
  cases++;
}
const caller = fs.readFileSync('src/components/pool/three/PoolScene.tsx', 'utf8').match(/ledTransportWaterY=\{([^\n]+)\}/)?.[1];
assert(caller, 'explicit caller scope');
const resolve = new Function('patioContext', 'sceneTime', 'verticalLayout', `return (${caller});`);
for (const context of [null, {}, false, true]) for (const time of ['day', 'night'])
  assert.equal(resolve(context, time, { waterY: -.07 }), context && time === 'night' ? -.07 : undefined);
const library = fs.readFileSync('node_modules/three-gpu-pathtracer/src/core/WebGLPathTracer.js', 'utf8');
assert(library.includes('lowResPathTracer.material = pathTracer.material;'), 'preview shares adapted owned material in installed library');
material.dispose(); map.dispose();
console.log(`PASS: ${cases} transformed-fixture layouts; optical-map identity/projection; unchanged sampler budget/live scene; clone cleanup/borrowed ownership; off/hidden/invalid-level bypass; compatibility guard; 8 actual caller-scope combinations. GPU/visual acceptance separate.`);
