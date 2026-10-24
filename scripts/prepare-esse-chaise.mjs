/** Owner-supplied CAD. Rigid axis change + uniform cm-to-m conversion only.
 * Meshopt is lossless: no decimation, quantization, smoothing or remodelling. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Matrix4, Vector3 } from "three";
import { TDSLoader } from "three/addons/loaders/TDSLoader.js";
import { MeshoptEncoder } from "meshoptimizer";

export function readEsseSource(path) {
  const bytes = readFileSync(path);
  const scene = new TDSLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse(object => { if (object.isMesh) meshes.push(object); });
  if (meshes.length !== 1) throw Error("Expected the owner's single ESSE shell");
  const geometry = meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, center = box.getCenter(new Vector3());
  // Source: X length (head at +X), Y width, Z up, centimetres.
  // Application: +Z feet, +Y up, grounded at Y=0. Determinant is positive.
  geometry.applyMatrix4(new Matrix4().set(
    0, -0.01, 0, center.y * 0.01,
    0, 0, 0.01, -box.min.z * 0.01,
    -0.01, 0, 0, center.x * 0.01,
    0, 0, 0, 1,
  ));
  geometry.clearGroups();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, sourceSha256: createHash("sha256").update(bytes).digest("hex"), sourceBytes: bytes.length };
}

export async function prepareEsse(path) {
  const { geometry, sourceSha256, sourceBytes } = readEsseSource(path);
  await MeshoptEncoder.ready;
  const parts = [], views = [], accessors = [];
  let packedOffset = 0, unpackedOffset = 0;
  const add = (attribute, semantic, mode) => {
    const array = attribute.array;
    const stride = attribute.itemSize * array.BYTES_PER_ELEMENT;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    const compressed = MeshoptEncoder.encodeGltfBuffer(bytes, attribute.count, stride, mode);
    const padding = (4 - compressed.length % 4) % 4;
    parts.push(Buffer.from(compressed), Buffer.alloc(padding));
    views.push({ buffer: 1, byteOffset: unpackedOffset, byteLength: bytes.length,
      ...(mode === "ATTRIBUTES" ? { byteStride: stride } : {}),
      extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: packedOffset,
        byteLength: compressed.length, byteStride: stride, count: attribute.count, mode, filter: "NONE" } } });
    packedOffset += compressed.length + padding;
    unpackedOffset += bytes.length + (4 - bytes.length % 4) % 4;
    const accessor = { bufferView: views.length - 1, componentType: array instanceof Float32Array ? 5126 : array instanceof Uint16Array ? 5123 : 5125,
      count: attribute.count, type: attribute.itemSize === 1 ? "SCALAR" : `VEC${attribute.itemSize}` };
    if (semantic === "POSITION") Object.assign(accessor, { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() });
    accessors.push(accessor);
    return accessors.length - 1;
  };
  const attributes = { POSITION: add(geometry.attributes.position, "POSITION", "ATTRIBUTES"), NORMAL: add(geometry.attributes.normal, "NORMAL", "ATTRIBUTES") };
  if (geometry.attributes.uv) attributes.TEXCOORD_0 = add(geometry.attributes.uv, "TEXCOORD_0", "ATTRIBUTES");
  const indices = add(geometry.index, "indices", "INDICES");
  const bin = Buffer.concat(parts);
  const gltf = { asset: { version: "2.0", generator: "POOL-SHAPER owner ESSE CAD; lossless metric conversion" },
    extensionsUsed: ["EXT_meshopt_compression"], extensionsRequired: ["EXT_meshopt_compression"],
    buffers: [{ byteLength: bin.length }, { byteLength: unpackedOffset, extensions: { EXT_meshopt_compression: { fallback: true } } }],
    bufferViews: views, accessors, meshes: [{ name: "esse-owner-cad", primitives: [{ attributes, indices }] }],
    nodes: [{ name: "esse-owner-cad", mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
  const rawJson = Buffer.from(JSON.stringify(gltf));
  const json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8);
  jsonHeader.writeUInt32LE(json.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
  const output = Buffer.concat([header, jsonHeader, json, binHeader, bin]);
  mkdirSync("public/models", { recursive: true });
  writeFileSync("public/models/esse-sun-shelf.glb", output);
  const receipt = { source: "ESSE lettino.3ds", provenance: "Owner-supplied CAD, 24 October 2026; original retained privately, not modified",
    sourceSha256, sourceBytes, assetSha256: createHash("sha256").update(output).digest("hex"), assetBytes: output.length,
    vertices: geometry.attributes.position.count, triangles: geometry.index.count / 3,
    dimensionsMetres: geometry.boundingBox.getSize(new Vector3()).toArray(), min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray(),
    transform: "Uniform 0.01 scale, proper rigid axis rotation, horizontal centering and grounding; +Z feet",
    geometryChanges: "None beyond unit/axis/origin conversion; all triangles, source normals and UVs retained", compression: "EXT_meshopt_compression, lossless, no filters" };
  writeFileSync("public/models/esse-sun-shelf.json", JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt, null, 2));
  geometry.dispose();
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error("Provide the owner-supplied ESSE .3ds file path");
  await prepareEsse(process.argv[2]);
}
