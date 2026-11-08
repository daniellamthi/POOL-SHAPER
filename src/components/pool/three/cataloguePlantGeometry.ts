import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { ArchitecturalPlan } from "@/lib/pool/catalogue-architecture";

export interface CataloguePlantInstances {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  matrices: THREE.Matrix4[];
}

/** Borrow each source primitive once. Metric placement matrices can feed the
 * raster instance buffer or the equivalent ordinary geometry for tracing.
 */
export function createCataloguePlantInstances(source: THREE.Group, plan: ArchitecturalPlan) {
  source.updateMatrixWorld(true);
  const groups = new Map<string, CataloguePlantInstances>();
  for (const [name, placements, height] of [
    ["tree", plan.trees, 4],
    ["shrub", plan.shrubs, 0.85],
  ] as const) {
    if (!placements.length) continue;
    const plant = source.getObjectByName(name);
    if (!plant) throw new Error(`Missing catalogue plant: ${name}`);
    const bounds = new THREE.Box3().setFromObject(plant);
    const sourceHeight = bounds.max.y - bounds.min.y;
    placements.forEach(([u, v, size], index) => {
      const scale = (height * size) / sourceHeight;
      const placement = new THREE.Matrix4().compose(
        new THREE.Vector3(u, plan.ground - bounds.min.y * scale, v),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 2.399963),
        new THREE.Vector3(scale, scale, scale),
      );
      plant.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (Array.isArray(object.material)) throw new Error("Expected glTF primitive materials");
        const key = `${object.geometry.uuid}/${object.material.uuid}`;
        const group: CataloguePlantInstances = groups.get(key) ?? {
          geometry: object.geometry,
          material: object.material as THREE.MeshStandardMaterial,
          matrices: [],
        };
        group.matrices.push(new THREE.Matrix4().multiplyMatrices(placement, object.matrixWorld));
        groups.set(key, group);
      });
    });
  }
  return [...groups.values()];
}

/** The installed path tracer does not expand InstancedMesh matrices. Bake only
 * on Photo Mode entry, using the same placements. Decode quantized attributes
 * to floats BEFORE applying matrices; integer writes would corrupt positions.
 */
export function bakeCataloguePlantInstances(instances: CataloguePlantInstances[]) {
  const byMaterial = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
  // A tangent can be transformed once per placement only for a positive
  // uniform scale and rotation. Keep the existing post-expansion calculation
  // for a material batch containing nonuniform, sheared or mirrored transforms.
  const worldTangentMaterials = new Set<THREE.MeshStandardMaterial>();
  for (const { material, matrices } of instances) {
    if (matrices.some((matrix) => {
      const e = matrix.elements;
      const x = e[0] ** 2 + e[1] ** 2 + e[2] ** 2;
      const y = e[4] ** 2 + e[5] ** 2 + e[6] ** 2;
      const z = e[8] ** 2 + e[9] ** 2 + e[10] ** 2;
      const tolerance = Math.max(x, y, z) * 1e-10;
      return !(x > 0 && Number.isFinite(x + y + z) && matrix.determinant() > 0
        && e[3] === 0 && e[7] === 0 && e[11] === 0 && e[15] === 1
        && Math.abs(x - y) <= tolerance && Math.abs(x - z) <= tolerance
        && Math.abs(e[0] * e[4] + e[1] * e[5] + e[2] * e[6]) <= tolerance
        && Math.abs(e[0] * e[8] + e[1] * e[9] + e[2] * e[10]) <= tolerance
        && Math.abs(e[4] * e[8] + e[5] * e[9] + e[6] * e[10]) <= tolerance);
    })) worldTangentMaterials.add(material);
  }
  for (const entry of instances) {
    if (!entry.matrices.length) continue;
    const source = entry.geometry.clone();
    try {
      for (const name of ["position", "normal", "uv"]) {
        const attribute = source.getAttribute(name);
        const values = new Float32Array(attribute.count * attribute.itemSize);
        for (let i = 0; i < attribute.count; i++)
          for (let c = 0; c < attribute.itemSize; c++) {
            values[i * attribute.itemSize + c] =
              c === 0 ? attribute.getX(i) : c === 1 ? attribute.getY(i) : attribute.getZ(i);
          }
        source.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize));
      }
      // Preserve authored tangents. Missing tangents share the source topology
      // and UVs; avoid recomputing them for every expanded placement.
      if (!source.hasAttribute("tangent") && !worldTangentMaterials.has(entry.material))
        source.computeTangents();
      for (const matrix of entry.matrices) {
        const geometry = source.clone();
        geometry.applyMatrix4(matrix);
        const list = byMaterial.get(entry.material) ?? [];
        list.push(geometry);
        byMaterial.set(entry.material, list);
      }
    } finally {
      source.dispose();
    }
  }
  return [...byMaterial].map(([material, copies]) => {
    const geometry = mergeGeometries(copies);
    copies.forEach((copy) => copy.dispose());
    if (!geometry) throw new Error("Incompatible catalogue vegetation geometry");
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, material };
  });
}

export function createCataloguePlantBatches(source: THREE.Group, plan: ArchitecturalPlan) {
  return bakeCataloguePlantInstances(createCataloguePlantInstances(source, plan));
}
