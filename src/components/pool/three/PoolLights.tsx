import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { accessPlacement } from "./PoolAccessModel";
import { planPoolLighting, POOL_LUMINAIRE, type LightingExclusion, type PoolLightPosition } from "@/lib/pool/lighting";
import type { Outline, PoolAccess } from "@/lib/pool/types";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import type { PoolVerticalLayout } from "@/lib/pool/vertical-layout";
import { calibratedLedColor, ledCandela, LED_OPTICS } from "@/lib/pool/led-optics";

// Presentation dimming is independent of the design lumen budget and layout.
export const POOL_LED_PRESENTATIONS = LED_OPTICS.presentations;

function RecessedPoolLight({ position, floorY, powered, presentation, revision, colour, intensity, diffuser, glow, occlusion }: {
  position: PoolLightPosition; floorY: number; powered: boolean;
  presentation: keyof typeof POOL_LED_PRESENTATIONS; revision: string;
  colour: THREE.Color; intensity: number;
  diffuser: THREE.DataTexture;
  glow: THREE.DataTexture;
  occlusion: boolean;
}) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(0, -(position.y - floorY) * LED_OPTICS.targetFloorFraction, position.throwDistance * LED_OPTICS.targetThrowFraction);
    return object;
  }, [position.y, position.throwDistance, floorY]);
  useLayoutEffect(() => {
    if (light.current) light.current.shadow.needsUpdate = true;
  }, [revision, target, occlusion]);
  const level = POOL_LED_PRESENTATIONS[presentation];
  return (
    <group name="pool-underwater-led" position={[position.x, position.y, position.z]} rotation={[0, position.rotation, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.002]} castShadow>
        <cylinderGeometry args={[0.128, 0.118, 0.028, 40]} />
        <meshStandardMaterial color="#69777b" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.022]} castShadow>
        <torusGeometry args={[0.116, 0.009, 10, 48]} />
        <meshStandardMaterial color={POOL_LUMINAIRE.trim === "steel" ? "#cbd1d2" : "#e9e9e3"} metalness={POOL_LUMINAIRE.trim === "steel" ? 1 : 0} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0, 0.019]}>
        <ringGeometry args={[0.1, 0.108, 40]} />
        <meshStandardMaterial color="#333f42" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.017]}>
        <circleGeometry args={[0.1, 40]} />
        <meshPhysicalMaterial color="#aabfc3" roughness={0.18} clearcoat={0.8} clearcoatRoughness={0.12} emissive={colour} emissiveIntensity={powered ? level.emission : 0} />
      </mesh>
      {[-1, 1].map(sign => (
        <mesh key={sign} position={[sign * 0.116, 0, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.0015, 10]} />
          <meshStandardMaterial color="#798487" roughness={0.4} metalness={0.9} />
        </mesh>
      ))}
      <primitive object={target} />
      {powered ? (
        // Soft core glow, coincident with the spotlight origin below -- the
        // glass itself visibly lighting up, not a halo floating in front of
        // the fixture. Additive so it only ever brightens, never occludes.
        <mesh position={[0, 0, LED_OPTICS.sourceOffset + 0.0005]}>
          <circleGeometry args={[LED_OPTICS.glowRadius, 24]} />
          <meshBasicMaterial
            map={glow}
            color={colour}
            opacity={level.glow}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
      {powered ? <spotLight
        ref={light}
        position={[0, 0, LED_OPTICS.sourceOffset]}
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
      /> : null}
    </group>
  );
}

export function PoolLights({ outline, layout, skimmers, access, showWater, presentation = "day", ledColor = "#ffffff" }: {
  outline: Outline; layout: PoolVerticalLayout; skimmers: SkimmerPlan;
  access: PoolAccess | null; showWater: boolean;
  presentation?: keyof typeof POOL_LED_PRESENTATIONS;
  ledColor?: string;
}) {
  // A shared optical distribution, not a visible beam mesh. The upper lobe is
  // shielded so submerged LEDs do not light the dry deck or produce point
  // highlights on the air-facing water surface. No animated texture uploads.
  const diffuser = useMemo(() => {
    const size = LED_OPTICS.diffuserSize;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const transmission = THREE.MathUtils.smoothstep(LED_OPTICS.upperCutoff - y / (size - 1), 0, LED_OPTICS.upperFeather);
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.round(transmission * 255);
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
  const { plan, shadowIndex, convexQuad } = useMemo(() => {
    const exclusions: LightingExclusion[] = skimmers.positions.map(p => ({ kind: "skimmer", x: p.x, z: p.z, radius: 0.65 }));
    let accessPoint: { x: number; z: number } | null = null;
    if (access) {
      const riseCount = Math.max(3, Math.ceil((layout.copingY - layout.floorY) / 0.25));
      const run = access === "internalSteps" ? (riseCount - 1) * 0.3 : 0.55;
      const width = access === "internalSteps" ? 1.15 : 0.62;
      const placement = accessPlacement(outline, run, width);
      if (placement) {
        accessPoint = placement;
        const nx = Math.sin(placement.rotation), nz = Math.cos(placement.rotation);
        const polygon: Outline = [[-width / 2, -0.05], [width / 2, -0.05], [width / 2, run + 0.1], [-width / 2, run + 0.1]].map(([x, z]) => [placement.x + nz * x! + nx * z!, placement.z - nx * x! + nz * z!] as const);
        exclusions.push({ kind: "access", polygon, clearance: 0.2 });
      }
    }
    const plan = planPoolLighting({ outline, waterY: layout.waterY, floorY: layout.floorY, exclusions });
    // In a convex rectangle the basin walls cannot occlude one another. Keep
    // the dominant access shadow; distant fill lights are intentionally soft.
    // Non-rectangular outlines retain full occlusion for re-entrant corners.
    let shadowIndex = -1, nearest = Infinity;
    if (accessPoint) plan.positions.forEach((p, i) => {
      const distance = Math.hypot(p.x - accessPoint.x, p.z - accessPoint.z);
      if (distance < nearest) { nearest = distance; shadowIndex = i; }
    });
    const turns = outline.map((a, i) => {
      const b = outline[(i + 1) % outline.length]!, c = outline[(i + 2) % outline.length]!;
      return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    });
    const convexQuad = outline.length === 4 && (turns.every(v => v > 0) || turns.every(v => v < 0));
    return { plan, shadowIndex, convexQuad };
  }, [outline, layout, skimmers, access]);
  const revision = `${outline.map(p => p.join(",")).join(";")}|${layout.waterY}|${layout.floorY}|${access}|${showWater}`;
  const colour = useMemo(() => calibratedLedColor(ledColor), [ledColor]);
  const intensity = ledCandela(plan.surfaceArea, plan.count, POOL_LUMINAIRE.lumens, presentation);
  return (
    <group name="pool-automatic-lighting" userData={{ lightingPlan: plan, luminaire: POOL_LUMINAIRE }}>
      {plan.positions.map((position, i) => <RecessedPoolLight key={i} position={position} floorY={layout.floorY} powered={showWater} presentation={presentation} revision={revision} colour={colour} intensity={intensity} diffuser={diffuser} glow={glow} occlusion={!convexQuad || i === shadowIndex} />)}
    </group>
  );
}
