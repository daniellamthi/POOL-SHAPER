import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { Matrix4 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { readEsseSource } from "./prepare-esse-chaise.mjs";

let checks = 0;
const check = (condition, label) => { assert(condition, label); checks++; };
const bytes = readFileSync("public/models/esse-sun-shelf.glb");
const receipt = JSON.parse(readFileSync("public/models/esse-sun-shelf.json", "utf8"));
check(createHash("sha256").update(bytes).digest("hex") === receipt.assetSha256, "prepared asset identity");
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
const mesh = gltf.scene.getObjectByName("esse-owner-cad");
check(mesh?.isMesh, "runtime lookup returns the actual CAD mesh");
check(gltf.scene.children.length === 1 && mesh.children.length === 0, "single geometry, no extra scene/furniture");
const geometry = mesh.geometry;
geometry.computeBoundingBox();
const box = geometry.boundingBox;
check(Math.abs(box.min.y) < 1e-7, "grounded on the actual shelf surface");
check(Math.abs(box.min.x + box.max.x) < 1e-6 && Math.abs(box.min.z + box.max.z) < 1e-6, "centered for existing parametric placements");
check(Math.abs(box.max.x - box.min.x - 0.73) < 0.004 && Math.abs(box.max.z - box.min.z - 1.85) < 0.005 && Math.abs(box.max.y - 0.57) < 0.001, "metric manufacturer envelope, preserving CAD export tolerances");
check(geometry.index.count / 3 === 55658 && geometry.attributes.position.count === 34663, "all source vertices and triangles retained");
check(geometry.index.count / 3 < 60000 && bytes.length < 900000, "single shared CAD resource within explicit size/triangle budget");
for (const attribute of Object.values(geometry.attributes)) check(Array.from(attribute.array).every(Number.isFinite), "finite decoded attributes");
check(Array.from(geometry.index.array).every(index => index < geometry.attributes.position.count), "all triangle indices in bounds");
let head = 0, foot = 0;
const position = geometry.attributes.position;
for (let i = 0; i < position.count; i++) {
  if (position.getZ(i) < -0.7) head = Math.max(head, position.getY(i));
  if (position.getZ(i) > 0.7) foot = Math.max(foot, position.getY(i));
}
check(head > foot + 0.3, "+Z points to feet, not backrest");
if (process.argv[2]) {
  const source = readEsseSource(process.argv[2]);
  check(source.sourceSha256 === receipt.sourceSha256, "owner source identity");
  for (const [name, attribute] of Object.entries(source.geometry.attributes)) {
    const decoded = geometry.attributes[name];
    check(decoded?.array.length === attribute.array.length && attribute.array.every((value, index) => value === decoded.array[index]), `${name}: exact lossless round trip, no shape/smoothing/UV changes`);
  }
  check(source.geometry.index.array.every((value, index) => value === geometry.index.array[index]), "all original triangles and winding preserved exactly");
  source.geometry.dispose();
}
const component = readFileSync("src/components/pool/three/SunShelfLoungers.tsx", "utf8");
check(component.includes('useGLTF(ESSE_ASSET, false, true)'), "local decoder, no external Draco dependency");
check(!component.includes('.preload(') && !component.includes('geometry.dispose()'), "no eager download or disposal of shared cached geometry");
check((component.match(/dispose=\{null\}/g) ?? []).length === 2, "R3F automatic disposal disabled on both shared-geometry mesh paths");
check(component.includes('position={[placement.x, placement.y, placement.z]}') && component.includes('rotation={[0, placement.rotation, 0]}') && !component.includes('scale='), "existing positions/orientations retained without stretching");
check(/plan.enabled\s*\?\s*\(\s*<Suspense fallback={null}>/.test(component), "OFF keeps chaise subtree unmounted and loading never blanks the pool");
// Check the actual CAD envelope, not only the previous nominal rectangular
// footprint (the supplied export is 1.96 mm wider than nominal 73 cm).
const cache = resolve("node_modules/.cache/esse-chaise-audit");
await build({ input: { layout: "src/lib/pool/sun-shelf-loungers.ts", defaults: "src/lib/pool/config.ts", resolved: "src/lib/pool/resolved-layout.ts" },
  output: { dir: cache, format: "esm" }, platform: "node", resolve: { alias: { "@": resolve("src") } }, external: ["three"] });
const { configuredSunShelfLoungers } = await import(pathToFileURL(`${cache}/layout.js`).href);
const { configuredPoolLayout } = await import(pathToFileURL(`${cache}/resolved.js`).href);
const { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS, DEFAULT_CUSTOMER } = await import(pathToFileURL(`${cache}/defaults.js`).href);
const bounds = outline => ({ minX: Math.min(...outline.map(p => p[0])), maxX: Math.max(...outline.map(p => p[0])), minZ: Math.min(...outline.map(p => p[1])), maxZ: Math.max(...outline.map(p => p[1])) });
const overlap = (a, b) => a.min.x < b.maxX && a.max.x > b.minX && a.min.z < b.maxZ && a.max.z > b.minZ;
let placedModels = 0;
for (const [length, width] of [[8, 4], [12, 5], [4, 8]]) {
  const config = { projectType: "new", poolType: "in-ground", structure: "concrete", shape: "rectangle", customMode: "draw",
    controlPoints: DEFAULT_CONTROL_POINTS, dimensions: { ...DEFAULT_DIMENSIONS, length, width }, system: "skimmer", overflowType: "hidden",
    skimmerFinish: "white", skimmerType: "slim", finish: "liner", linerColor: "motionBlueSky602", mosaicFinish: "white",
    features: ["sunShelf", "sunShelfLoungers"], poolAccess: "internalSteps", internalStairType: "linear", equipment: [], customer: DEFAULT_CUSTOMER, uploads: [] };
  const plan = configuredSunShelfLoungers(config);
  const shelf = configuredPoolLayout(config).comfort.elements.find(e => e.kind === "sunShelf");
  check(plan.count > 0 && shelf, `${length}x${width}: compatible test actually places CAD`);
  const platform = bounds(shelf.footprint);
  for (const placement of plan.placements) {
    const transform = new Matrix4().makeRotationY(placement.rotation).setPosition(placement.x, placement.y, placement.z);
    const actual = box.clone().applyMatrix4(transform);
    check(actual.min.x > platform.minX && actual.max.x < platform.maxX && actual.min.z > platform.minZ && actual.max.z < platform.maxZ, "complete imported mesh on shelf, including source dimensional tolerances");
    check(Math.abs(actual.min.y - shelf.topY) < 1e-7, "imported CAD base contacts shelf without suspension/penetration");
    for (const obstacle of [...(shelf.steps ?? []), ...(shelf.landing ? [shelf.landing] : [])]) check(!overlap(actual, bounds(obstacle.footprint)), "real CAD clears stairs and access landing");
    placedModels++;
  }
}
console.log(JSON.stringify({ checks, placedModels, vertices: position.count, triangles: geometry.index.count / 3, assetBytes: bytes.length, losslessSourceCompared: Boolean(process.argv[2]), dimensionsMetres: receipt.dimensionsMetres }, null, 2));
