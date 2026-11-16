import * as THREE from "three";
import { photoModeState } from "@/lib/pool/photoModeState";

/** Optical projection only. World positions, geometry, normals and shading
 * remain canonical. The existing opaque transmission pass owns visibility. */
export const FLAT_WATER_PROJECT = `
uniform bool poolLensActive;
uniform float poolLensWaterY;
uniform float poolLensIor;
uniform mat4 poolLensViewToWorld;
uniform vec3 poolLensCameraPosition;
vec4 poolFlatWaterClip(vec4 originalView) {
  vec3 point = (poolLensViewToWorld * originalView).xyz;
  float depth = poolLensWaterY - point.y;
  float height = poolLensCameraPosition.y - poolLensWaterY;
  if (depth <= 0.0001 || height <= 0.002) return projectionMatrix * originalView;
  vec2 horizontal = point.xz - poolLensCameraPosition.xz;
  float range = length(horizontal);
  if (range < 0.0001) return projectionMatrix * originalView;
  float low = 0.0, high = range;
  // Fermat/Snell at the flat interface. Bounded work per submerged vertex,
  // not a per-fragment ray march or a displacement of the configured mesh.
  for (int i = 0; i < 16; i++) {
    float air = (low + high) * 0.5;
    float wet = range - air;
    float error = air / sqrt(height * height + air * air)
      - poolLensIor * wet / sqrt(depth * depth + wet * wet);
    if (error > 0.0) high = air; else low = air;
  }
  vec2 interfaceXZ = poolLensCameraPosition.xz + horizontal * ((low + high) * 0.5 / range);
  vec3 interfacePoint = vec3(interfaceXZ.x, poolLensWaterY, interfaceXZ.y);
  vec4 virtualView = viewMatrix * vec4(interfacePoint, 1.0);
  // Preserve monotonic receiver depth instead of flattening every receiver
  // onto the water plane (which would cause z-fighting and lost occlusion).
  float airDistance = distance(poolLensCameraPosition, interfacePoint);
  virtualView.xyz *= (airDistance + distance(interfacePoint, point)) / max(airDistance, 0.0001);
  return projectionMatrix * virtualView;
}
`;

export function isPoolOpticalReceiver(object: THREE.Object3D) {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) {
    if (parent.name === "pool-basin" || parent.name === "sun-shelf-loungers"
      || parent.name === "pool-automatic-lighting" || parent.name === "pool-underwater-led"
      || parent.name === "pool-skimmers" || parent.name.startsWith("pool-access-internalSteps-")
      || parent.name.startsWith("pool-access-stainlessSteelLadder-")) return true;
  }
  return false;
}

/** A shared material cannot carry two projection scopes in one draw pass.
 * Leave such exceptional materials canonical in both colour and depth. */
export function poolOpticalMaterials(scene: THREE.Scene) {
  const receivers = new Set<THREE.Material>(), outside = new Set<THREE.Material>();
  scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const scope = isPoolOpticalReceiver(mesh) ? receivers : outside;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) scope.add(material);
  });
  outside.forEach(material => receivers.delete(material));
  return receivers;
}

type Entry = {
  material: THREE.Material;
  originalCompile: THREE.Material["onBeforeCompile"];
  originalKey: THREE.Material["customProgramCacheKey"];
  compile: THREE.Material["onBeforeCompile"];
  key: THREE.Material["customProgramCacheKey"];
  baseKey: string;
  active: boolean;
};

/** Scoped to basin meshes. No renderer monkey-patch: a scene's
 * outer target distinguishes Three's nested transmission pass from its main
 * pass, including when the main scene is itself rendered into a post-FX FBO. */
export class FlatWaterProjection {
  private owners = 0;
  private disposed = false;
  private camera: THREE.Camera | null = null;
  private enabled = false;
  private roots = new WeakMap<THREE.Camera, THREE.WebGLRenderTarget | null>();
  private materials = new Map<THREE.Material, Entry>();
  private meshes = new Map<THREE.Mesh, { original: THREE.Object3D["onBeforeRender"]; wrapped: THREE.Object3D["onBeforeRender"] }>();
  private originalSceneBefore: THREE.Scene["onBeforeRender"];
  private sceneBefore: THREE.Scene["onBeforeRender"];
  private water = { value: 0 };
  private ior: { value: number };
  private viewToWorld = { value: new THREE.Matrix4() };
  private cameraPosition = { value: new THREE.Vector3() };
  beforeCameraRender: (() => void) | null = null;

  constructor(private scene: THREE.Scene, ior: number) {
    this.ior = { value: ior };
    this.originalSceneBefore = scene.onBeforeRender;
    const owner = this;
    this.sceneBefore = function (...args) {
      owner.originalSceneBefore.apply(this, args);
      if (args[2] === owner.camera && args[1].overrideMaterial === null && !photoModeState.active) {
        // CameraRig may move after our useFrame subscription. Use the final
        // renderer-updated camera for both receiver and colour projection.
        owner.viewToWorld.value = args[2].matrixWorld;
        owner.cameraPosition.value.setFromMatrixPosition(args[2].matrixWorld);
        owner.beforeCameraRender?.();
      }
      owner.roots.set(args[2], args[0].getRenderTarget());
    };
  }

  retain() {
    this.owners++;
    if (!this.disposed) this.scene.onBeforeRender = this.sceneBefore;
  }

  release() {
    this.owners--;
    // Restore callbacks synchronously before another mounted water owner can
    // wrap them. Only final disposal is deferred for StrictMode effect replay.
    if (this.owners === 0) this.detach();
    queueMicrotask(() => { if (this.owners === 0) this.dispose(); });
  }

  sync(camera: THREE.Camera, enabled: boolean, waterY: number) {
    if (this.disposed) return;
    this.camera = camera; this.enabled = enabled;
    this.water.value = waterY; this.viewToWorld.value = camera.matrixWorld;
    this.cameraPosition.value.setFromMatrixPosition(camera.matrixWorld);
    const liveMeshes = new Set<THREE.Mesh>(), liveMaterials = new Set<THREE.Material>();
    const scopedMaterials = poolOpticalMaterials(this.scene);
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!isPoolOpticalReceiver(mesh)) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!scopedMaterials.has(material)) continue;
        if (!(material as THREE.MeshStandardMaterial).isMeshStandardMaterial
          && !(material as THREE.MeshBasicMaterial).isMeshBasicMaterial) continue;
        if (material.customProgramCacheKey().includes("dual-normal-physical-water")) continue;
        liveMaterials.add(material);
        let entry = this.materials.get(material);
        let hooksChanged = !entry;
        if (!entry) {
          entry = { material, originalCompile: material.onBeforeCompile, originalKey: material.customProgramCacheKey,
            baseKey: material.customProgramCacheKey(), active: false, compile: material.onBeforeCompile, key: material.customProgramCacheKey };
          const current = entry;
          current.compile = (shader, renderer) => {
            current.originalCompile.call(material, shader, renderer);
            Object.assign(shader.uniforms, { poolLensWaterY: this.water, poolLensIor: this.ior, poolLensViewToWorld: this.viewToWorld, poolLensCameraPosition: this.cameraPosition,
              poolLensActive: { get value() { return current.active; } } });
            shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${FLAT_WATER_PROJECT}`)
              .replace("#include <project_vertex>", "#include <project_vertex>\nif (poolLensActive) gl_Position = poolFlatWaterClip(mvPosition);");
          };
          current.key = () => current.baseKey + "|flat-water-projection-v3";
          this.materials.set(material, current);
        }
        // React may update a material's own hooks when its finish changes.
        if (material.onBeforeCompile !== entry.compile) { entry.originalCompile = material.onBeforeCompile; hooksChanged = true; }
        if (material.customProgramCacheKey !== entry.key) {
          hooksChanged = true;
          entry.originalKey = material.customProgramCacheKey;
        }
        if (hooksChanged) {
          // The default key reads onBeforeCompile.toString(). Evaluate the
          // saved owner hook, not our wrapper, after a finish replaces it.
          const installed = material.onBeforeCompile;
          try { material.onBeforeCompile = entry.originalCompile; entry.baseKey = entry.originalKey.call(material); }
          finally { material.onBeforeCompile = installed; }
        }
        material.onBeforeCompile = entry.compile;
        material.customProgramCacheKey = entry.key;
        if (hooksChanged) material.needsUpdate = true;
      }
      liveMeshes.add(mesh);
      if (this.meshes.has(mesh)) return;
      const original = mesh.onBeforeRender, owner = this;
      const wrapped: THREE.Object3D["onBeforeRender"] = function (this: THREE.Object3D, ...args) {
        original.apply(this, args);
        const [renderer, scene, renderCamera, , material] = args;
        const entry = owner.materials.get(material);
        if (!entry) return; // Includes override depth/shadow materials.
        const active = owner.enabled && !photoModeState.active && renderCamera === owner.camera
          && scene.overrideMaterial === null && owner.roots.has(renderCamera)
          && (renderer.getRenderTarget() !== owner.roots.get(renderCamera)
            || material.transparent || (material as THREE.MeshPhysicalMaterial).transmission > 0);
        // Three resets its current-material binding on setRenderTarget, so
        // the first draw of each pass uploads this shared getter. No material
        // version/program change (and no shadow/cache invalidation) per pass.
        entry.active = active;
      };
      mesh.onBeforeRender = wrapped;
      this.meshes.set(mesh, { original, wrapped });
    });
    for (const [mesh, hooks] of this.meshes) if (!liveMeshes.has(mesh)) {
      if (mesh.onBeforeRender === hooks.wrapped) mesh.onBeforeRender = hooks.original;
      this.meshes.delete(mesh);
    }
    for (const [material, entry] of this.materials) if (!liveMaterials.has(material)) {
      if (material.onBeforeCompile === entry.compile) material.onBeforeCompile = entry.originalCompile;
      if (material.customProgramCacheKey === entry.key) material.customProgramCacheKey = entry.originalKey;
      material.needsUpdate = true;
      this.materials.delete(material);
    }
  }

  private detach() {
    if (this.scene.onBeforeRender === this.sceneBefore) this.scene.onBeforeRender = this.originalSceneBefore;
    for (const [mesh, hooks] of this.meshes) if (mesh.onBeforeRender === hooks.wrapped) mesh.onBeforeRender = hooks.original;
    for (const entry of this.materials.values()) {
      if (entry.material.onBeforeCompile === entry.compile) entry.material.onBeforeCompile = entry.originalCompile;
      if (entry.material.customProgramCacheKey === entry.key) entry.material.customProgramCacheKey = entry.originalKey;
      entry.material.needsUpdate = true;
    }
    this.meshes.clear(); this.materials.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.detach();
  }
}
