import * as THREE from "three";
import { FLAT_WATER_PROJECT, isPoolOpticalReceiver, poolOpticalMaterials } from "./flatWaterProjection";

/** Opaque first-hit depth, not an invented flat-floor depth. Captured only on
 * camera/geometry changes; moving light, colour and ripples do not recapture. */
export class WaterRefractionDepth {
  readonly target = new THREE.WebGLRenderTarget(1, 1, {
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
  readonly receiverUniforms = {
      poolLensActive: { value: false }, poolLensWaterY: { value: 0 }, poolLensIor: { value: 1.333 },
      poolLensViewToWorld: { value: new THREE.Matrix4() }, poolLensCameraPosition: { value: new THREE.Vector3() },
      poolReceiverVisible: { value: true },
  };
  readonly material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, toneMapped: false,
    uniforms: this.receiverUniforms,
    vertexShader: THREE.ShaderLib.depth.vertexShader
      .replace("#include <common>", `#include <common>\n${FLAT_WATER_PROJECT}\nvarying vec3 poolReceiverWorld;`)
      .replace("#include <project_vertex>", `#include <project_vertex>
        poolReceiverWorld = (poolLensViewToWorld * mvPosition).xyz;
        if (poolLensActive) gl_Position = poolFlatWaterClip(mvPosition);`),
    fragmentShader: `varying vec3 poolReceiverWorld;
      uniform bool poolReceiverVisible;
      #include <clipping_planes_pars_fragment>
      void main() {
        if (!poolReceiverVisible) discard;
        #include <clipping_planes_fragment>
        gl_FragColor = vec4(poolReceiverWorld, 1.0);
      }`,
  });
  readonly uniforms = {
    poolOpaqueDepth: { value: this.target.depthTexture },
    poolOpaqueWorldMap: { value: this.target.texture },
    poolDepthWorld: { value: false },
    poolDepthReady: { value: false },
    poolDepthInverseProjection: { value: new THREE.Matrix4() },
    poolDepthViewToWorld: { value: new THREE.Matrix4() },
    poolDepthTexel: { value: new THREE.Vector2(1, 1) },
    poolTransmissionTexel: { value: new THREE.Vector2(1, 1) },
  };
  private cameraWorld = new THREE.Matrix4();
  private projection = new THREE.Matrix4();
  private revision: string | undefined;
  private size = new THREE.Vector2();
  private disposed = false;
  private owners = 0;
  private opticalKey = "";

  constructor(private worldReceivers = true) {
    // Devices without float colour attachments keep the original depth-only
    // path and canonical projection; do not create an incomplete framebuffer.
    if (!worldReceivers) this.target.texture.type = THREE.UnsignedByteType;
  }

  retain() { this.owners++; }
  release() {
    this.owners--;
    queueMicrotask(() => { if (this.owners === 0) this.dispose(); });
  }

  invalidate() { this.uniforms.poolDepthReady.value = false; }

  validateCamera(camera: THREE.Camera) {
    // Controls/CameraRig can move after the capture subscription. In that
    // frame use the correctly projected calm image, not stale ripple depth.
    // Never start a nested render from Scene.onBeforeRender: it can overwrite
    // the outer pass's reflection state in the installed Three renderer.
    if (!this.cameraWorld.equals(camera.matrixWorld) || !this.projection.equals(camera.projectionMatrix)) this.invalidate();
  }

  capture(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, revision: string,
    optical?: { waterY: number; ior: number }) {
    if (this.disposed) return false;
    if (!this.worldReceivers) optical = undefined;
    gl.getDrawingBufferSize(this.size);
    const scale = Math.min(1, 1024 / Math.max(this.size.x, this.size.y));
    const width = Math.max(1, Math.round(this.size.x * scale));
    const height = Math.max(1, Math.round(this.size.y * scale));
    const resized = this.target.width !== width || this.target.height !== height;
    const opticalKey = optical ? `${optical.waterY}:${optical.ior}` : "legacy";
    if (!resized && this.uniforms.poolDepthReady.value && this.revision === revision
      && this.opticalKey === opticalKey
      && this.cameraWorld.equals(camera.matrixWorld) && this.projection.equals(camera.projectionMatrix)) return false;
    this.invalidate();
    if (resized) this.target.setSize(width, height);
    const hidden: THREE.Object3D[] = [];
    const callbacks = new Map<THREE.Mesh, THREE.Object3D["onBeforeRender"]>();
    const scopedMaterials = optical ? poolOpticalMaterials(scene) : null;
    this.receiverUniforms.poolLensWaterY.value = optical?.waterY ?? 0;
    this.receiverUniforms.poolLensIor.value = optical?.ior ?? 1.333;
    this.receiverUniforms.poolLensViewToWorld.value = camera.matrixWorld;
    this.receiverUniforms.poolLensCameraPosition.value.setFromMatrixPosition(camera.matrixWorld);
    scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !object.visible) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      // Ignore water, glazing, sky and additive beam volumes. They are not
      // the opaque first hit that Three's transmission colour buffer stores.
      if (materials.every(material => !material.depthWrite || material.transparent
        || (material as THREE.MeshPhysicalMaterial).transmission > 0)) {
        object.visible = false; hidden.push(object);
      }
      const original = mesh.onBeforeRender, active = !!optical && isPoolOpticalReceiver(mesh), captureMaterial = this.material, uniforms = this.receiverUniforms;
      callbacks.set(mesh, original);
      mesh.onBeforeRender = function (...args) {
        original.apply(this, args);
        const group = args[5] as { materialIndex?: number } | null;
        const selected = materials[group?.materialIndex ?? 0];
        uniforms.poolLensActive.value = active && !!selected && !!scopedMaterials?.has(selected);
        // The override must not turn a mixed mesh's transparent group into
        // an opaque occluder absent from the transmission colour pass.
        uniforms.poolReceiverVisible.value = !!selected && selected.depthWrite && !selected.transparent
          && !((selected as THREE.MeshPhysicalMaterial).transmission > 0);
        captureMaterial.uniformsNeedUpdate = true;
      };
    });
    const previous = gl.getRenderTarget();
    const override = scene.overrideMaterial;
    const shadowAutoUpdate = gl.shadowMap.autoUpdate;
    const xr = gl.xr.enabled;
    const background = scene.background, clear = gl.getClearColor(new THREE.Color()), alpha = gl.getClearAlpha();
    try {
      scene.overrideMaterial = this.material;
      scene.background = null;
      gl.shadowMap.autoUpdate = false; gl.xr.enabled = false;
      gl.setClearColor(0, 0);
      gl.setRenderTarget(this.target); gl.clear(); gl.render(scene, camera);
      this.cameraWorld.copy(camera.matrixWorld); this.projection.copy(camera.projectionMatrix);
      this.uniforms.poolDepthInverseProjection.value.copy(camera.projectionMatrixInverse);
      this.uniforms.poolDepthViewToWorld.value.copy(camera.matrixWorld);
      this.uniforms.poolDepthTexel.value.set(1 / width, 1 / height);
      this.uniforms.poolTransmissionTexel.value.set(1 / this.size.x, 1 / this.size.y);
      this.opticalKey = opticalKey;
      this.uniforms.poolDepthWorld.value = !!optical;
      this.revision = revision; this.uniforms.poolDepthReady.value = true;
      return true;
    } finally {
      scene.overrideMaterial = override; gl.shadowMap.autoUpdate = shadowAutoUpdate; gl.xr.enabled = xr;
      scene.background = background; gl.setClearColor(clear, alpha);
      gl.setRenderTarget(previous);
      hidden.forEach(object => { object.visible = true; });
      for (const [mesh, callback] of callbacks) mesh.onBeforeRender = callback;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.invalidate();
    // WebGLRenderer owns the target's attached depth texture and disposes it
    // with the target. Do not send a second disposal for that attachment.
    this.target.dispose(); this.material.dispose();
  }
}

export const WATER_DEPTH_REFRACTION = `
uniform sampler2D poolOpaqueDepth;
#ifdef WATER_METRIC_WAVES
uniform sampler2D poolOpaqueWorldMap;
uniform bool poolDepthWorld;
uniform vec2 poolTransmissionTexel;
#endif
uniform bool poolDepthReady;
uniform mat4 poolDepthInverseProjection;
uniform mat4 poolDepthViewToWorld;
uniform vec2 poolDepthTexel;
uniform float poolInterfaceY;
vec3 poolWaveNormal;
vec3 poolOpaqueWorld(vec2 uv) {
#ifdef WATER_METRIC_WAVES
  if (poolDepthWorld) {
    vec4 receiver = texture2D(poolOpaqueWorldMap, uv);
    return receiver.a > 0.999 ? receiver.xyz : vec3(0.0, poolInterfaceY + 1.0, 0.0);
  }
#endif
  float depth = texture2D(poolOpaqueDepth, uv).x;
  vec4 view = poolDepthInverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return (poolDepthViewToWorld * vec4(view.xyz / view.w, 1.0)).xyz;
}
bool poolWetReceiver(vec3 point) {
  vec2 uv = (point.xz - waterShoreBounds.xy) / waterShoreBounds.zw;
  return point.y < poolInterfaceY - 0.002
    && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))
    && texture2D(waterShoreline, uv).r > 0.0;
}
vec2 poolWaveTransmissionUv(vec2 uv, float ior) {
  if (!poolDepthReady || cameraPosition.y <= poolInterfaceY + 0.002) return uv;
  vec3 hit = poolOpaqueWorld(uv);
#ifdef WATER_METRIC_WAVES
  // Derivatives are taken before divergent depth/silhouette guards. They
  // invert the already-refracted receiver image, not a dry camera projection.
  vec3 dx = dFdx(hit), dy = dFdy(hit);
#endif
  float waterDepth = poolInterfaceY - hit.y;
  if (waterDepth <= 0.002 || waterDepth > 6.0 || !poolWetReceiver(hit)) return uv;
  vec3 view = normalize(cameraPosition - vWorldPosition);
  vec3 flatRay = refract(-view, vec3(0.0, 1.0, 0.0), 1.0 / ior);
  vec3 waveRay = refract(-view, normalize(poolWaveNormal), 1.0 / ior);
  // First-order Snell displacement about the unchanged flat-interface image.
  // A calm normal is identity; real stair/seat depth controls ripple movement.
  vec3 delta = (waveRay / max(abs(waveRay.y), 0.25) - flatRay / max(abs(flatRay.y), 0.25)) * waterDepth;
  vec2 shoreUv = (vWorldPosition.xz - waterShoreBounds.xy) / waterShoreBounds.zw;
  float shore = texture2D(waterShoreline, shoreUv).r * waterShoreScale;
  delta *= smoothstep(0.02, 0.12, shore) * min(1.0, shore / max(length(delta), 0.00001));
#ifdef WATER_METRIC_WAVES
  float xx = dot(dx, dx), yy = dot(dy, dy), xy = dot(dx, dy);
  float determinant = xx * yy - xy * xy;
  if (determinant <= 1e-14) return uv;
  vec2 rhs = vec2(dot(dx, delta), dot(dy, delta));
  vec2 pixels = vec2(yy * rhs.x - xy * rhs.y, xx * rhs.y - xy * rhs.x) / determinant;
  vec2 result = uv + pixels * poolTransmissionTexel;
  vec3 candidate = poolOpaqueWorld(result);
  if (distance(candidate, hit + delta) > max(0.025, length(delta) * 0.5)) return uv;
#else
  vec4 displaced = projectionMatrix * viewMatrix * vec4(hit + delta, 1.0);
  vec2 result = displaced.xy / displaced.w * 0.5 + 0.5;
#endif
  if (any(lessThan(result, poolDepthTexel)) || any(greaterThan(result, vec2(1.0) - poolDepthTexel))) return uv;
  // Never pull a dry edge, handrail or lounger into the transmitted image.
  // Neighbour checks conservatively expand the dry silhouette at this depth
  // buffer's sampling footprint instead of stretching its colour into water.
  if (!poolWetReceiver(poolOpaqueWorld(result))
    || !poolWetReceiver(poolOpaqueWorld(result + vec2(poolDepthTexel.x,0.0)))
    || !poolWetReceiver(poolOpaqueWorld(result - vec2(poolDepthTexel.x,0.0)))
    || !poolWetReceiver(poolOpaqueWorld(result + vec2(0.0,poolDepthTexel.y)))
    || !poolWetReceiver(poolOpaqueWorld(result - vec2(0.0,poolDepthTexel.y)))) return uv;
  return result;
}
`;
