import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

// Run from the repository root. Optional args: candidate.ts baseline.ts report.json.
const root = process.env.POOL_ROOT ?? process.cwd();
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const fromRoot = name => import(pathToFileURL(require.resolve(name)).href);
const T = await import(pathToFileURL(require.resolve('three').replace(/three\.cjs$/, 'three.module.js')).href);
const bufferUtils = await fromRoot('three/addons/utils/BufferGeometryUtils.js');
const { GLTFLoader } = await fromRoot('three/addons/loaders/GLTFLoader.js');
const { MeshoptDecoder } = await fromRoot('three/addons/libs/meshopt_decoder.module.js');
const report = { scope: 'Real Meshopt GLB geometry; images stubbed, borrowed material identities preserved', cases: [] };

function load(path, merge = bufferUtils.mergeGeometries) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }}).outputText, { exports, require(name) {
    if (name === 'three') return T;
    if (name === 'three/addons/utils/BufferGeometryUtils.js') return { ...bufferUtils, mergeGeometries:merge };
    throw Error(`Unexpected import: ${name}`);
  }});
  return exports;
}
const candidatePath = resolve(process.argv[2] ?? resolve(root, 'src/components/pool/three/cataloguePlantGeometry.ts'));
const candidate = load(candidatePath);
// Small independent legacy fixture: decode every instance, then calculate
// missing tangents on expanded batches, as the installed path tracer does.
function legacyBake(instances) {
  const grouped = new Map();
  for (const entry of instances) for (const matrix of entry.matrices) {
    const geometry = entry.geometry.clone();
    for (const name of ['position','normal','uv']) {
      const attribute = geometry.getAttribute(name);
      const array = new Float32Array(attribute.count * attribute.itemSize);
      for (let i=0; i<attribute.count; i++) for (let c=0; c<attribute.itemSize; c++)
        array[i*attribute.itemSize+c] = c===0 ? attribute.getX(i) : c===1 ? attribute.getY(i) : attribute.getZ(i);
      geometry.setAttribute(name,new T.Float32BufferAttribute(array,attribute.itemSize));
    }
    geometry.applyMatrix4(matrix);
    const copies=grouped.get(entry.material) ?? []; copies.push(geometry); grouped.set(entry.material,copies);
  }
  return [...grouped].map(([material,copies]) => {
    const geometry=bufferUtils.mergeGeometries(copies); copies.forEach(copy=>copy.dispose());
    if (!geometry) throw Error('Incompatible catalogue vegetation geometry');
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return {geometry,material};
  });
}
const stock = process.argv[3] ? load(resolve(process.argv[3])) : {
  createCataloguePlantInstances:candidate.createCataloguePlantInstances, bakeCataloguePlantInstances:legacyBake,
};
const bytes = readFileSync(resolve(root, 'public/models/catalogue/canopy-packed.glb'));
await MeshoptDecoder.ready;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.register(() => ({ name: 'AUDIT_SKIP_IMAGE_LOADING', loadTexture() { return Promise.resolve(new T.Texture()); } }));
const asset = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
function fingerprint(geometry) {
  return JSON.stringify({ index: geometry.index && digest(geometry.index.array), groups: geometry.groups,
    attributes: Object.entries(geometry.attributes).map(([key, attr]) => [key, attr.itemSize, attr.normalized,
      attr.isInterleavedBufferAttribute ? [attr.offset, attr.data.stride, digest(attr.data.array)] : digest(attr.array)]),
  });
}
const borrowed = [];
let borrowedDisposals = 0;
asset.scene.traverse(object => {
  if (!object.isMesh) return;
  object.geometry.addEventListener('dispose', () => borrowedDisposals++);
  object.material.addEventListener('dispose', () => borrowedDisposals++);
  borrowed.push({ object, geometry: object.geometry, material: object.material, fingerprint: fingerprint(object.geometry) });
});

function tangentMetrics(a, b) {
  let maxComponent = 0, maxAngle = 0, sumAngle = 0, finite = 0, handednessChanges = 0, zeroMismatch = 0;
  const above = Object.fromEntries([0.01, 0.1, 0.5, 1, 5, 45, 90].map(x => [x, 0]));
  for (let i = 0; i < a.count; i++) {
    const o = i * 4;
    const ax = a.array[o], ay = a.array[o+1], az = a.array[o+2];
    const bx = b.array[o], by = b.array[o+1], bz = b.array[o+2];
    assert([ax, ay, az, bx, by, bz, a.array[o+3], b.array[o+3]].every(Number.isFinite));
    for (let j = 0; j < 4; j++) maxComponent = Math.max(maxComponent, Math.abs(a.array[o+j] - b.array[o+j]));
    if (a.array[o+3] !== b.array[o+3]) handednessChanges++;
    const al = Math.hypot(ax,ay,az), bl = Math.hypot(bx,by,bz);
    if (al < 1e-12 || bl < 1e-12) { if ((al < 1e-12) !== (bl < 1e-12)) zeroMismatch++; continue; }
    const angle = Math.acos(Math.max(-1, Math.min(1, (ax*bx + ay*by + az*bz)/(al*bl)))) * 180/Math.PI;
    maxAngle = Math.max(maxAngle, angle); sumAngle += angle; finite++;
    for (const threshold in above) if (angle > Number(threshold)) above[threshold]++;
  }
  return { vertices:a.count, maxComponent, maxAngleDegrees:maxAngle, meanAngleDegrees:sumAngle/finite, handednessChanges, zeroMismatch, aboveDegrees:above };
}
function prepare(api, instances) {
  const tangentCalls = [];
  const original = T.BufferGeometry.prototype.computeTangents;
  T.BufferGeometry.prototype.computeTangents = function() {
    const started = performance.now();
    try { return original.call(this); }
    finally { tangentCalls.push({vertices:this.getAttribute('position').count, ms:performance.now()-started}); }
  };
  try {
    const start = performance.now();
    const result = api.bakeCataloguePlantInstances(instances);
    const bakedMs = performance.now()-start;
    for (const {geometry} of result) if (!geometry.hasAttribute('tangent')) geometry.computeTangents();
    return { result, bakedMs, totalMs:performance.now()-start, tangentCalls };
  } finally { T.BufferGeometry.prototype.computeTangents = original; }
}
function compareCase(name, instances, { existingTangents = false, fallbackTangents = false, maxAngle, sourceTangents = false } = {}) {
  global.gc?.();
  const before = instances.map(entry => fingerprint(entry.geometry));
  const a = prepare(stock, instances);
  global.gc?.();
  const b = prepare(candidate, instances);
  assert.equal(a.result.length, b.result.length);
  const groups = [];
  let extraExpandedBytes = 0;
  for (let i = 0; i < a.result.length; i++) {
    const ga = a.result[i].geometry, gb = b.result[i].geometry;
    assert.equal(a.result[i].material, b.result[i].material);
    assert.deepEqual(ga.groups, gb.groups);
    assert.equal(digest(ga.index.array), digest(gb.index.array), 'index bytes');
    for (const key of Object.keys(ga.attributes).filter(key => key !== 'tangent')) {
      assert.equal(ga.attributes[key].itemSize, gb.attributes[key].itemSize);
      assert.equal(ga.attributes[key].normalized, gb.attributes[key].normalized);
      assert.equal(digest(ga.attributes[key].array), digest(gb.attributes[key].array), `${key} bytes`);
    }
    assert.deepEqual(ga.boundingBox, gb.boundingBox);
    assert.deepEqual(ga.boundingSphere, gb.boundingSphere);
    const metrics = tangentMetrics(ga.attributes.tangent, gb.attributes.tangent);
    if (existingTangents || fallbackTangents) assert.equal(digest(ga.attributes.tangent.array), digest(gb.attributes.tangent.array), 'authored/fallback tangents bytes');
    if (maxAngle !== undefined) assert(metrics.maxAngleDegrees <= maxAngle, `tangent angle must be <= ${maxAngle} degrees`);
    if (!existingTangents && !fallbackTangents) extraExpandedBytes += gb.attributes.tangent.array.byteLength;
    groups.push({ material:a.result[i].material.name, ...metrics });
  }
  instances.forEach((entry, i) => assert.equal(fingerprint(entry.geometry), before[i], 'borrowed source bytes'));
  if (existingTangents) assert.equal(b.tangentCalls.length, 0, 'never recalculate authored tangents');
  if (sourceTangents) assert.deepEqual(b.tangentCalls.map(call=>call.vertices),
    Array.from(instances.filter(entry=>entry.matrices.length),entry=>entry.geometry.getAttribute('position').count),
    'tangent work must scale with unique source primitives, never expanded vertices');
  report.cases.push({name, preservation:'exact position/normal/UV/index/groups/bounds; same material objects',
    stock:{bakedMs:a.bakedMs,totalMs:a.totalMs,tangentCalls:a.tangentCalls},
    candidate:{bakedMs:b.bakedMs,totalMs:b.totalMs,tangentCalls:b.tangentCalls}, extraExpandedBytes, groups});
  for (const {geometry} of [...a.result,...b.result]) geometry.dispose();
  console.log(JSON.stringify(report.cases.at(-1)));
}

const plan = { ground:-0.2, trees:Array.from({length:10}, (_,i)=>[-12+i*2.3, -7+(i%3)*5, 0.8+(i%4)*0.15]),
  shrubs:Array.from({length:10}, (_,i)=>[-12+i*2.3, 7, 0.8+(i%4)*0.15]) };
const realInstances = stock.createCataloguePlantInstances(asset.scene, plan);
assert.equal(realInstances.length, 6, 'real GLB must supply all six primitives');
assert.equal(realInstances.reduce((n, x) => n + x.geometry.getAttribute('position').count * x.matrices.length, 0), 4_480_870);
compareCase('real canopy: ten trees and ten shrubs; catalogue placement transforms', realInstances, {sourceTangents:true});

const synth = new T.TorusGeometry(1, 0.3, 6, 12), mat = new T.MeshStandardMaterial();
mat.name = 'synthetic';
const matrix = (scale, translation=[2,3,-4]) => new T.Matrix4().compose(new T.Vector3(...translation),
  new T.Quaternion().setFromEuler(new T.Euler(0.23,0.71,-0.31)), new T.Vector3(...scale));
compareCase('synthetic uniform positive transforms', [{geometry:synth,material:mat,matrices:[new T.Matrix4(),matrix([0.27,0.27,0.27]),matrix([2,2,2])]}], {maxAngle:0.0001,sourceTangents:true});
compareCase('synthetic nonuniform and reflected transforms: stock fallback', [{geometry:synth,material:mat,matrices:[matrix([2,0.5,1.3]),matrix([-1,1,1])]}], {fallbackTangents:true});
const sharedSource = synth.clone();
compareCase('mixed entries sharing one material: whole batch falls back', [
  {geometry:synth,material:mat,matrices:[matrix([1,1,1])]},
  {geometry:sharedSource,material:mat,matrices:[matrix([2,0.5,1.3])]},
], {fallbackTangents:true});
compareCase('shear and singular transforms: stock fallback', [{geometry:synth,material:mat,matrices:[new T.Matrix4().makeShear(0.2,0.1,0,0,0,0),new T.Matrix4().makeScale(1,0,1)]}], {fallbackTangents:true});
const withTangents = synth.clone(); withTangents.computeTangents();
compareCase('existing tangents preserved for uniform, nonuniform and reflection', [{geometry:withTangents,material:mat,matrices:[matrix([0.27,0.27,0.27]),matrix([2,0.5,1.3]),matrix([-1,1,1])]}], {existingTangents:true});
assert.equal(candidate.bakeCataloguePlantInstances([{geometry:synth,material:mat,matrices:[]}]).length, 0);

const originalClone = T.BufferGeometry.prototype.clone;
const originalDispose = T.BufferGeometry.prototype.dispose;
let cloneCalls=0, decodedSource, decodedDisposals=0;
T.BufferGeometry.prototype.clone = function() {
  if (++cloneCalls === 2) throw Error('injected instance clone failure');
  const result = originalClone.call(this); decodedSource=result; return result;
};
T.BufferGeometry.prototype.dispose = function() { if (this===decodedSource) decodedDisposals++; return originalDispose.call(this); };
try {
  assert.throws(() => candidate.bakeCataloguePlantInstances([{geometry:synth,material:mat,matrices:[new T.Matrix4()]}]), /injected/);
  assert.equal(decodedDisposals,1,'decoded temporary source disposed after failure');
} finally { T.BufferGeometry.prototype.clone=originalClone; T.BufferGeometry.prototype.dispose=originalDispose; }
let sourceAtMerge, sourceDisposedAtMerge=false;
T.BufferGeometry.prototype.clone = function() {
  const result=originalClone.call(this);
  if (this===synth) { sourceAtMerge=result; result.addEventListener('dispose',()=>{sourceDisposedAtMerge=true;}); }
  return result;
};
try {
  const mergeFailure=load(candidatePath,()=>{
    assert(sourceAtMerge && sourceDisposedAtMerge,'temporary decoded source disposed before merge');
    throw Error('injected merge failure');
  });
  assert.throws(()=>mergeFailure.bakeCataloguePlantInstances([{geometry:synth,material:mat,matrices:[new T.Matrix4()]}]),/injected merge/);
} finally { T.BufferGeometry.prototype.clone=originalClone; }
for (const item of borrowed) {
  assert.equal(item.object.geometry,item.geometry); assert.equal(item.object.material,item.material);
  assert.equal(fingerprint(item.geometry),item.fingerprint);
}
assert.equal(borrowedDisposals,0,'borrowed assets never disposed');
report.borrowedAssetPreserved=true;
report.decodedSourceDisposedOnFailure=true;
report.tangentDifferencePolicy='Real-asset angle/handedness differences are reported, not asserted equivalent. Synthetic uniform tolerance 0.0001 degrees; authored and fallback tangents exact bytes.';
report.nativeSceneAdditionalTangentBytes=4_895_750*16;
report.allocationStructure='computeTangents tan1/tan2 arrays allocate 2 vectors per vertex: largest expanded primitive 8,278,720 vectors versus source primitive 827,872. Peak memory was not measured.';
if (process.argv[4]) writeFileSync(resolve(process.argv[4]),JSON.stringify(report,null,2)+'\n');
console.log('Preservation and lifecycle assertions PASS; tangent differences and timings are diagnostic measurements, not an equivalence assertion.');
