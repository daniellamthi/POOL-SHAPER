import { StainlessSteelMaterial } from "./StainlessSteelMaterial";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type SceneLightingPlan } from "@/lib/pool/lighting-plan";
export { planSceneLighting } from "@/lib/pool/lighting-plan";
import { POOL_LUMINAIRE, type PoolLightPosition } from "@/lib/pool/lighting";
import type { PoolVerticalLayout } from "@/lib/pool/vertical-layout";
import type { FloorProfileModel } from "@/lib/pool/floor-profile";
import {
  calibratedLedColor,
  ledCandela,
  ledIntensityScale,
  LED_OPTICS,
} from "@/lib/pool/led-optics";

// Presentation dimming is independent of the design lumen budget and layout.
export const POOL_LED_PRESENTATIONS = LED_OPTICS.presentations;

/**
 * The beam itself: the lit column of water leaving the lens.
 *
 * A three.js SpotLight is analytic -- it shades surfaces and renders nothing
 * in between. With a submerged luminaire that reads badly: a lit lens, then
 * metres of untouched water, then a bright patch on the liner, which the eye
 * refuses to connect. This supplies the missing middle term.
 *
 * Shape matters more than brightness here. The volume is a frustum whose
 * narrow end is the lens aperture and which opens along the lens normal, so
 * the first lit slice sits hard against the glass and the light visibly
 * travels outward. An earlier version used a sphere centred on the fixture:
 * that is a halo around the lamp, not light leaving it, and no amount of
 * tuning makes a halo read as a beam.
 */
const SCATTER_VERTEX = `
varying vec3 vWorld;
varying vec3 vOriginW;
varying vec3 vAxisW;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  // The emission point and the beam axis, in world space, taken straight from
  // the mesh's own matrix. The mesh is parented to the fixture and offset to
  // the lens centre, so this IS the lens: the shader cannot invent an origin
  // of its own, and the beam can only ever start on the glass.
  vOriginW = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vAxisW = normalize((modelMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SCATTER_FRAGMENT = `
uniform vec3 beamColor;
uniform float density;
uniform float beamLength;
uniform float startRadius;
uniform float endRadius;
uniform float extinction;
uniform float gain;
uniform float waterLevel;
uniform float floorLevel;
varying vec3 vWorld;
varying vec3 vOriginW;
varying vec3 vAxisW;

/** Single-scattering density of the lit water at a world point. */
float beamDensity(vec3 p) {
  vec3 rel = p - vOriginW;
  float z = dot(rel, vAxisW);
  if (z < 0.0 || z > beamLength) return 0.0;
  float u = z / beamLength;
  float radius = length(rel - vAxisW * z);
  float coneRadius = mix(startRadius, endRadius, u);
  // Gaussian cross-section: a real beam has no rim, so there is no edge to
  // alias and no silhouette to give the volume away as geometry.
  float k = radius / max(coneRadius * 0.62, 1e-4);
  float radial = exp(-k * k);
  // Absorption in the water, times the geometric dilution of an opening cone.
  // Both are 1 at the glass, which is what makes the beam unmistakably
  // brightest where it leaves the lens.
  float along = exp(-u * extinction) * (startRadius / max(coneRadius, 1e-4));
  // Dissolve the far end instead of stopping on a disc.
  float tail = 1.0 - smoothstep(0.7, 1.0, u);
  // A submerged luminaire lights water, not the air above it or the ground
  // below the liner.
  float submerged = 1.0 - smoothstep(waterLevel - 0.06, waterLevel, p.y);
  float aboveFloor = smoothstep(floorLevel - 0.02, floorLevel + 0.06, p.y);
  return radial * along * tail * submerged * aboveFloor;
}

const int STEPS = 24;

void main() {
  // The volume is INTEGRATED along the view ray. The previous version shaded
  // the hull and derived its cross-section profile from the hull vertex's own
  // radius -- which is, by construction, exactly the cone radius, so the
  // profile evaluated to zero at every fragment and the beam drew nothing at
  // all. What remained visible was only the analytic spotlight's patch on the
  // liner, i.e. light with no visible origin: it read as starting at the pool
  // floor because the floor was the only lit thing in the frame.
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float tEntry = length(vWorld - ro);

  // Closest approach between the view ray and the beam axis. Marching a fixed
  // window centred there samples the bright core at every distance and every
  // viewing angle -- a uniform march over the whole length would step straight
  // past the narrow, brightest part next to the glass.
  vec3 w0 = ro - vOriginW;
  float b = dot(rd, vAxisW);
  float d = dot(rd, w0);
  float e = dot(vAxisW, w0);
  float denom = 1.0 - b * b;
  float tMid = denom > 1e-4 ? (b * e - d) / denom : max(0.0, -d);
  tMid = max(tMid, tEntry);

  float sinAngle = sqrt(max(1e-4, denom));
  vec3 pMid = ro + rd * tMid;
  float zMid = clamp(dot(pMid - vOriginW, vAxisW), 0.0, beamLength);
  float coneMid = mix(startRadius, endRadius, zMid / beamLength);
  float halfWindow = clamp(2.6 * coneMid / sinAngle, 0.05, beamLength * 2.0);

  float t0 = max(tEntry, tMid - halfWindow);
  float t1 = tMid + halfWindow;
  float stepLength = (t1 - t0) / float(STEPS);
  float accumulated = 0.0;
  for (int i = 0; i < STEPS; i++) {
    accumulated += beamDensity(ro + rd * (t0 + (float(i) + 0.5) * stepLength));
  }

  float a = clamp(density * accumulated * stepLength * gain, 0.0, 1.0);
  if (a <= 0.002) discard;
  gl_FragColor = vec4(beamColor * a, a);
}
`;

function RecessedPoolLight({
  position,
  floorY,
  powered,
  presentation,
  revision,
  colour,
  intensity,
  dimmer,
  diffuser,
  glow,
  scatterGeometry,
  scatterMaterial,
  occlusion,
}: {
  position: PoolLightPosition;
  floorY: number;
  powered: boolean;
  presentation: keyof typeof POOL_LED_PRESENTATIONS;
  revision: string;
  colour: THREE.Color;
  intensity: number;
  dimmer: { output: number; emission: number };
  diffuser: THREE.DataTexture;
  glow: THREE.DataTexture;
  scatterGeometry: THREE.CylinderGeometry;
  scatterMaterial: THREE.ShaderMaterial;
  occlusion: boolean;
}) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(
      0,
      -(position.y - floorY) * LED_OPTICS.targetFloorFraction,
      position.throwDistance * LED_OPTICS.targetThrowFraction,
    );
    return object;
  }, [position.y, position.throwDistance, floorY]);
  // The scattering volume is aimed exactly like the spotlight: both tilt
  // from the wall normal by the same small angle, into the basin.
  const beamTilt = Math.atan2(
    (position.y - floorY) * LED_OPTICS.targetFloorFraction,
    Math.max(0.1, position.throwDistance * LED_OPTICS.targetThrowFraction),
  );
  useLayoutEffect(() => {
    if (light.current) light.current.shadow.needsUpdate = true;
  }, [revision, target, occlusion]);
  const level = POOL_LED_PRESENTATIONS[presentation];
  return (
    <group
      name="pool-underwater-led"
      position={[position.x, position.y, position.z]}
      rotation={[0, position.rotation, 0]}
    >
      <group scale={[POOL_LUMINAIRE.diameter / 0.256, POOL_LUMINAIRE.diameter / 0.256, 1]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.002]} castShadow>
        <cylinderGeometry args={[0.128, 0.118, 0.028, 40]} />
        <StainlessSteelMaterial finish="brushed" color="#9aa3a6" />
      </mesh>
      <mesh position={[0, 0, 0.022]} castShadow>
        <torusGeometry args={[0.116, 0.009, 10, 48]} />
        {POOL_LUMINAIRE.trim === "steel" ? (
          <StainlessSteelMaterial finish="satin" />
        ) : (
          <meshStandardMaterial color="#e9e9e3" metalness={0} roughness={0.34} />
        )}
      </mesh>
      <mesh position={[0, 0, 0.019]}>
        <ringGeometry args={[0.1, 0.108, 40]} />
        <meshStandardMaterial color="#333f42" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.017]}>
        <circleGeometry args={[0.1, 40]} />
        <meshPhysicalMaterial
          color="#aabfc3"
          roughness={0.18}
          clearcoat={0.8}
          clearcoatRoughness={0.12}
          emissive={colour}
          emissiveIntensity={powered ? level.emission * dimmer.emission : 0}
        />
      </mesh>
      {[-1, 1].map((sign) => (
        <mesh key={sign} position={[sign * 0.116, 0, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.0015, 10]} />
          <StainlessSteelMaterial finish="satin" />
        </mesh>
      ))}
      </group>
      <primitive object={target} />
      {powered ? (
        // Bright core on the glass itself, at the lens centre -- the same
        // point the spotlight and the scattering volume below use.
        // `renderOrder` matters as much as the blending here: an additive
        // mesh that writes no depth and is sorted front-to-back with the rest
        // of the opaque list gets painted first and then completely painted
        // over by the liner behind it. Drawing last within the opaque pass
        // keeps it visible in both the main image and the water's refraction.
        <mesh
          position={[0, 0, LED_OPTICS.lensCenter + 0.0004]}
          renderOrder={LED_OPTICS.glowRenderOrder}
        >
          <circleGeometry args={[LED_OPTICS.glowRadius * POOL_LUMINAIRE.diameter / 0.256, 24]} />
          <meshBasicMaterial
            map={glow}
            color={colour}
            opacity={level.glow * dimmer.emission}
            // Opaque-list for the same reason as the beam volume: a
            // `transparent` glow is invisible through the water surface.
            transparent={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
      {powered ? (
        // The lit water immediately in front of the lens. Anchored at the
        // lens centre so the beam is visually continuous from the glass
        // outward -- this is what closes the gap between the fixture and the
        // surfaces it illuminates.
        <group position={[0, 0, LED_OPTICS.lensCenter]} rotation={[beamTilt, 0, 0]}>
          <mesh
            name="led-beam-scatter"
            geometry={scatterGeometry}
            renderOrder={LED_OPTICS.beamRenderOrder}
          >
            <primitive object={scatterMaterial} attach="material" />
          </mesh>
        </group>
      ) : null}
      {powered ? (
        <spotLight
          ref={light}
          position={[0, 0, LED_OPTICS.lensCenter + LED_OPTICS.emitterEpsilon]}
          target={target}
          color={colour}
          map={diffuser}
          intensity={intensity}
          angle={LED_OPTICS.angle}
          penumbra={LED_OPTICS.penumbra}
          decay={LED_OPTICS.decay}
          distance={position.throwDistance * LED_OPTICS.rangeMultiplier}
          castShadow={occlusion}
          shadow-mapSize={[LED_OPTICS.shadowSize, LED_OPTICS.shadowSize]}
          shadow-camera-near={0.08}
          shadow-bias={-0.0001}
          shadow-normalBias={0.012}
          shadow-autoUpdate={false}
        />
      ) : null}
    </group>
  );
}

export function PoolLights({
  lighting,
  layout,
  floorProfile,
  showWater,
  presentation = "day",
  ledColor = "#ffffff",
  ledIntensity,
}: {
  lighting: SceneLightingPlan;
  layout: PoolVerticalLayout;
  /** Geometry Pass A: per-fixture local floor for the beam aim and the
   * shared scatter-volume floor cutoff. */
  floorProfile: FloorProfileModel;
  showWater: boolean;
  presentation?: keyof typeof POOL_LED_PRESENTATIONS;
  ledColor?: string;
  /** 0..1 dimmer, resolved upstream. */
  ledIntensity: number;
}) {
  // A shared optical distribution, not a visible beam mesh. The upper lobe is
  // shielded so submerged LEDs do not light the dry deck or produce point
  // highlights on the air-facing water surface. No animated texture uploads.
  const diffuser = useMemo(() => {
    const size = LED_OPTICS.diffuserSize;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const transmission = THREE.MathUtils.smoothstep(
        LED_OPTICS.upperCutoff - y / (size - 1),
        0,
        LED_OPTICS.upperFeather,
      );
      for (let x = 0; x < size; x++) {
        // Caustics, baked into the projector rather than added as a second
        // pass: the beam crosses a rippled surface on its way out, so the
        // pattern it lays on the liner is faintly banded. Because it modulates
        // the spotlight's own map it is tinted by the lamp's colour for free,
        // costs no extra light, no extra draw and no per-frame work.
        const u = (x / (size - 1) - 0.5) * Math.PI * 4;
        const v = (y / (size - 1) - 0.5) * Math.PI * 4;
        const ripple =
          1 +
          LED_OPTICS.causticDepth *
            (Math.sin(u * 1.7 + Math.cos(v * 1.1)) * Math.sin(v * 1.3 + Math.cos(u * 0.9)));
        const i = (y * size + x) * 4;
        const level = Math.round(THREE.MathUtils.clamp(transmission * ripple, 0, 1) * 255);
        data[i] = data[i + 1] = data[i + 2] = level;
        data[i + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => diffuser.dispose(), [diffuser]);
  // Soft radial falloff (no hard edge) for the lens core glow -- generated
  // once, tinted per-fixture via the mesh's own colour at render time.
  const glow = useMemo(() => {
    const size = 32;
    const data = new Uint8Array(size * size * 4);
    const centre = (size - 1) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - centre, y - centre) / centre;
        const alpha = Math.pow(Math.max(0, 1 - d), 2.2);
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(alpha * 255);
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => glow.dispose(), [glow]);
  // One geometry + one material shared by every fixture in the pool.
  // A frustum, not a sphere: its narrow end IS the lens aperture and it
  // opens along +Z (the lens normal), so the lit water starts on the glass.
  // The hull is only the volume's bounding shell now -- the fragment shader
  // integrates the beam along the view ray, so the mesh never has to be the
  // beam. Padded past the Gaussian cross-section so the soft edge is not
  // clipped, and closed so there is a front face from every angle.
  const scatterGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(
      LED_OPTICS.beamEndRadius * LED_OPTICS.beamHullPad,
      LED_OPTICS.beamStartRadius * (POOL_LUMINAIRE.diameter / 0.256) * LED_OPTICS.beamHullPad,
      LED_OPTICS.beamLength,
      32,
      1,
      false,
    );
    // Narrow end to the origin, then aim the axis down +Z.
    geometry.translate(0, LED_OPTICS.beamLength / 2, 0);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }, []);
  useEffect(() => () => scatterGeometry.dispose(), [scatterGeometry]);
  const scatterMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SCATTER_VERTEX,
        fragmentShader: SCATTER_FRAGMENT,
        uniforms: {
          beamColor: { value: new THREE.Color(1, 1, 1) },
          density: { value: 0 },
          beamLength: { value: LED_OPTICS.beamLength },
          startRadius: { value: LED_OPTICS.beamStartRadius * (POOL_LUMINAIRE.diameter / 0.256) },
          endRadius: { value: LED_OPTICS.beamEndRadius },
          extinction: { value: LED_OPTICS.beamExtinction },
          gain: { value: LED_OPTICS.beamGain },
          waterLevel: { value: 0 },
          floorLevel: { value: 0 },
        },
        // NOT `transparent`. three.js builds the water surface's refraction
        // from an opaque-only pass (`renderTransmissionPass` renders
        // `opaqueObjects` and nothing else), so anything flagged transparent
        // is simply absent from what you see through the water. That is why
        // the beam and the lit lens vanished the moment the camera looked in
        // from above the surface, leaving only the opaque floor patch the
        // analytic spotlight had shaded -- the light appeared to start at the
        // pool floor because the floor was the only lit thing that survived.
        // With `transparent: false` the volume joins the opaque list, is
        // drawn into the transmission target, and still blends additively:
        // `WebGLState.setMaterial` only forces NoBlending for NormalBlending
        // materials. `depthWrite: false` keeps it from occluding anything,
        // and additive blending is order-independent, so opaque front-to-back
        // sorting is harmless.
        transparent: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        // Front faces only: the shader marches forward from the fragment it
        // shades, so exactly one entry point per pixel is what it wants. Back
        // faces would double every contribution and would be clipped by the
        // liner where the hull dips below the floor.
        side: THREE.FrontSide,
      }),
    [],
  );
  useEffect(() => () => scatterMaterial.dispose(), [scatterMaterial]);
  const { plan, shadowIndex, convexQuad } = lighting;
  const revision = `${plan.positions.map((p) => `${p.x},${p.y},${p.z}`).join(";")}|${showWater}`;
  const colour = useMemo(() => calibratedLedColor(ledColor), [ledColor]);
  // One dimmer factor for the whole luminaire. Changing it only rewrites
  // uniforms and light parameters on the existing objects -- no geometry, no
  // material, no light is rebuilt, so dragging the slider costs nothing.
  const dimmer = ledIntensityScale(ledIntensity);
  const intensity = ledCandela(
    plan.surfaceArea,
    plan.count,
    POOL_LUMINAIRE.lumens,
    presentation,
    dimmer.output,
  );
  // The scattering volume is driven by the same calibrated colour as the
  // beam, so lens, water and lit surfaces always agree.
  scatterMaterial.uniforms["beamColor"]!.value.copy(colour);
  scatterMaterial.uniforms["density"]!.value = showWater
    ? POOL_LED_PRESENTATIONS[presentation].scatter * dimmer.output
    : 0;
  scatterMaterial.uniforms["waterLevel"]!.value = layout.waterY;
  // One shared uniform serves every beam; a genuinely per-fixture cutoff
  // would need a shader rewrite. Using the SHALLOWEST local floor among the
  // row (the highest, i.e. least-negative, floorYAt across the fixtures)
  // guarantees no beam ever renders through any local floor -- the accepted
  // trade-off is that a fixture further into the slope may read as stopping
  // very slightly short of its own true (deeper) local floor.
  scatterMaterial.uniforms["floorLevel"]!.value =
    floorProfile.sloped && plan.positions.length > 0
      ? Math.max(...plan.positions.map((p) => floorProfile.floorYAt(p.x, p.z)))
      : layout.floorY;
  return (
    <group
      name="pool-automatic-lighting"
      userData={{ lightingPlan: plan, luminaire: POOL_LUMINAIRE }}
    >
      {plan.positions.map((position, i) => (
        <RecessedPoolLight
          key={i}
          position={position}
          floorY={floorProfile.floorYAt(position.x, position.z)}
          powered={showWater}
          presentation={presentation}
          revision={revision}
          colour={colour}
          intensity={intensity}
          dimmer={dimmer}
          diffuser={diffuser}
          glow={glow}
          scatterGeometry={scatterGeometry}
          scatterMaterial={scatterMaterial}
          occlusion={!convexQuad || i === shadowIndex}
        />
      ))}
    </group>
  );
}
