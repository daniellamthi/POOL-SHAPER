import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CATALOGUE_LOUNGER_RECLINE } from "@/lib/pool/catalogue-architecture";

function nonIndexed(geometry: THREE.BufferGeometry) {
  if (!geometry.index) return geometry;
  const output = geometry.toNonIndexed();
  geometry.dispose();
  return output;
}

/** Metric frame, in the exact planner envelope [-.41,.41] x [0,.9] x [-.97,1.05]. */
export function createCatalogueLoungerFrame() {
  const pieces: THREE.BufferGeometry[] = [];
  const box = (size: [number, number, number], position: [number, number, number], tilt = 0) => {
    const geometry = nonIndexed(new RoundedBoxGeometry(...size, 1, 0.002));
    const positionAttribute = geometry.getAttribute("position"),
      normalAttribute = geometry.getAttribute("normal"),
      uv = geometry.getAttribute("uv");
    const axis = size[1] > Math.max(size[0], size[2]) ? "y" : size[2] > size[0] ? "z" : "x";
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i),
        y = positionAttribute.getY(i),
        z = positionAttribute.getZ(i);
      const nx = Math.abs(normalAttribute.getX(i)),
        ny = Math.abs(normalAttribute.getY(i));
      uv.setXY(
        i,
        axis === "y" ? y : axis === "z" ? z : x,
        axis === "y" ? (nx > 0.5 ? z : x) : axis === "z" ? (ny > 0.5 ? x : y) : ny > 0.5 ? z : y,
      );
    }
    if (tilt) geometry.rotateX(tilt);
    geometry.translate(...position);
    pieces.push(geometry);
  };
  for (const x of [-0.365, 0.365]) box([0.07, 0.1, 1.94], [x, 0.28, 0]);
  for (const x of [-0.33, 0.33])
    for (const z of [-0.74, 0.74]) box([0.065, 0.27, 0.065], [x, 0.135, z]);
  for (const z of [-0.88, 0.88]) box([0.69, 0.075, 0.07], [0, 0.28, z]);
  for (let i = 0; i < 7; i++) box([0.66, 0.035, 0.09], [0, 0.315, -0.8 + i * 0.16]);
  const a = CATALOGUE_LOUNGER_RECLINE,
    c = Math.cos(a),
    s = Math.sin(a);
  const backY = 0.4 + 0.425 * s - 0.1 * c - 0.04 * s;
  const backZ = 0.3 + 0.425 * c + 0.1 * s - 0.04 * c;
  for (const x of [-0.35, 0.35]) box([0.06, 0.05, 0.78], [x, backY, backZ], -a);
  for (const z of [-0.3, -0.15, 0, 0.15, 0.3])
    box([0.64, 0.025, 0.075], [0, backY + z * s, backZ + z * c], -a);
  const dy = backY + 0.2 * s - 0.33,
    dz = backZ + 0.2 * c - 0.78;
  for (const x of [-0.32, 0.32])
    box([0.045, Math.hypot(dy, dz), 0.045], [x, 0.33 + dy / 2, 0.78 + dz / 2], Math.atan2(dz, dy));
  const output = mergeGeometries(pieces)!;
  pieces.forEach((geometry) => geometry.dispose());
  // Local part origin agrees with the planner; placement is applied once later.
  output.translate(0, -0.45, -0.04);
  return output;
}

/** A soft crown and an actual narrow welt, both inside the declared box. */
export function createCatalogueCushion(size: [number, number, number]) {
  const [w, h, d] = size,
    bodyHeight = h - 0.015;
  const rounded = new RoundedBoxGeometry(
    w - 0.006,
    bodyHeight,
    d - 0.006,
    2,
    Math.min(0.04, bodyHeight / 2 - 0.001),
  );
  // RoundedBox samples the bevel, leaving large flat face triangles. Split
  // those faces before adding the crown so the middle can actually rise.
  const body = nonIndexed(new TessellateModifier(0.22, 6).modify(rounded));
  rounded.dispose();
  const position = body.getAttribute("position"),
    normal = body.getAttribute("normal");
  const crown = Math.min(0.012, h * 0.18),
    halfW = w / 2,
    halfD = d / 2;
  const scratch = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    const u = Math.max(0, 1 - (x / halfW) ** 2),
      v = Math.max(0, 1 - (z / halfD) ** 2);
    const t = y / bodyHeight + 0.5;
    const dx = ((-2 * crown * t * x) / (halfW * halfW)) * v;
    const dz = ((-2 * crown * t * z) / (halfD * halfD)) * u;
    const dy = 1 + (crown * u * v) / bodyHeight;
    // Inverse-transpose of the height deformation preserves the rounded
    // box's smooth normals; recomputing nonindexed normals would facet it.
    scratch
      .set(
        normal.getX(i) - (dx * normal.getY(i)) / dy,
        normal.getY(i) / dy,
        normal.getZ(i) - (dz * normal.getY(i)) / dy,
      )
      .normalize();
    normal.setXYZ(i, scratch.x, scratch.y, scratch.z);
    position.setY(i, y - 0.0075 + crown * t * u * v);
  }
  const x = w / 2 - 0.003,
    z = d / 2 - 0.003,
    radius = Math.min(0.033, w / 5, d / 5);
  const path = new THREE.CurvePath<THREE.Vector3>();
  const point = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  const line = (a: [number, number], b: [number, number]) =>
    path.add(new THREE.LineCurve3(point(...a), point(...b)));
  const turn = (a: [number, number], b: [number, number], c: [number, number]) =>
    path.add(new THREE.QuadraticBezierCurve3(point(...a), point(...b), point(...c)));
  line([-x + radius, -z], [x - radius, -z]);
  turn([x - radius, -z], [x, -z], [x, -z + radius]);
  line([x, -z + radius], [x, z - radius]);
  turn([x, z - radius], [x, z], [x - radius, z]);
  line([x - radius, z], [-x + radius, z]);
  turn([-x + radius, z], [-x, z], [-x, z - radius]);
  line([-x, z - radius], [-x, -z + radius]);
  turn([-x, -z + radius], [-x, -z], [-x + radius, -z]);
  const seam = nonIndexed(new THREE.TubeGeometry(path, 48, 0.0025, 4, true));
  const output = mergeGeometries([body, seam])!;
  body.dispose();
  seam.dispose();
  return output;
}

/** Small periodic, deterministic maps: a 4 cm textile repeat, mipmapped so
 * the subpixel weave averages out in catalogue views rather than shimmering.
 */
export function createCatalogueLinen(anisotropy: number) {
  const size = 128,
    count = size * size * 4;
  const colour = new Uint8Array(count),
    normals = new Uint8Array(count),
    roughness = new Uint8Array(count);
  const height = (x: number, y: number) =>
    0.45 * Math.sin((x * Math.PI) / 2) +
    0.45 * Math.sin((y * Math.PI) / 2) +
    0.12 * Math.cos(((x + y) * Math.PI) / 4);
  const n = new THREE.Vector3();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const variation = Math.sin((x * Math.PI) / 16) * Math.sin((y * Math.PI) / 32);
      const value = Math.round(247 + 3 * variation + height(x, y));
      colour.set([value, value, value, 255], i);
      const r = Math.round(239 + 6 * variation);
      roughness.set([r, r, r, 255], i);
      n.set(
        (height(x - 1, y) - height(x + 1, y)) * 0.2,
        (height(x, y - 1) - height(x, y + 1)) * 0.2,
        1,
      ).normalize();
      normals.set(
        [
          Math.round((n.x * 0.5 + 0.5) * 255),
          Math.round((n.y * 0.5 + 0.5) * 255),
          Math.round((n.z * 0.5 + 0.5) * 255),
          255,
        ],
        i,
      );
    }
  const map = (data: Uint8Array, srgb = false) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(25, 25);
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return texture;
  };
  const maps = { map: map(colour, true), normalMap: map(normals), roughnessMap: map(roughness) };
  const material = new THREE.MeshPhysicalMaterial({
    color: "#f5efe3",
    ...maps,
    normalScale: new THREE.Vector2(0.18, 0.18),
    roughness: 0.94,
    sheen: 0.6,
    sheenColor: "#f0e8d9",
    sheenRoughness: 0.8,
  });
  return { material, maps };
}
