import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CurvePath,
  LineCurve3,
  MeshStandardMaterial,
  RectAreaLight,
  TubeGeometry,
  Vector3,
} from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import type { PerimeterLightingPlan, PerimeterLightSide } from "@/lib/pool/perimeter-lighting";
import { calibratedLedColor, ledIntensityScale } from "@/lib/pool/led-optics";

// One pair of shared LTC lookup textures; no per-fitting shadow map or FBO.
RectAreaLightUniformsLib.init();

function PerimeterSide({
  side,
  night,
  colour,
  output,
}: {
  side: PerimeterLightSide;
  night: boolean;
  colour: string;
  output: number;
}) {
  const light = useRef<RectAreaLight>(null);
  const signature = JSON.stringify(side.points);
  const geometry = useMemo(() => {
    const path = new CurvePath<Vector3>();
    for (let i = 1; i < side.points.length; i++) {
      path.add(
        new LineCurve3(new Vector3(...side.points[i - 1]!), new Vector3(...side.points[i]!)),
      );
    }
    return new TubeGeometry(path, Math.max(2, side.points.length * 2), 0.007, 6, false);
    // Coordinates, not RGB or time-of-day, own this physical diffuser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const tint = useMemo(() => calibratedLedColor(colour), [colour]);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: "#eeeae2", roughness: 0.45 }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  material.emissive.copy(tint);
  material.emissiveIntensity = night ? 5 * output : 0;
  const first = side.points[0]!,
    last = side.points[side.points.length - 1]!;
  const x = (first[0] + last[0]) / 2,
    y = first[1],
    z = (first[2] + last[2]) / 2;
  const [inwardX, inwardZ] = side.inward;
  useLayoutEffect(() => {
    light.current?.lookAt(x + inwardX, y - 0.35, z + inwardZ);
  }, [x, y, z, inwardX, inwardZ]);
  return (
    <group name={`pool-perimeter-led-side-${side.id + 1}`}>
      <mesh name="perimeter-led-diffuser" geometry={geometry} material={material} />
      {/* Keep the light graph mounted by day. Only output changes on toggles. */}
      <rectAreaLight
        ref={light}
        position={[x, y, z]}
        color={tint}
        width={Math.hypot(last[0] - first[0], last[2] - first[2])}
        height={0.014}
        intensity={night ? 1600 * output : 0}
      />
    </group>
  );
}

export function PerimeterLights({
  plan,
  night,
  colour,
  intensity,
  onReady,
}: {
  plan: PerimeterLightingPlan;
  night: boolean;
  colour: string;
  intensity: number;
  onReady: (ready: boolean) => void;
}) {
  useLayoutEffect(() => {
    onReady(true);
    return () => onReady(false);
  }, [onReady]);
  const output = ledIntensityScale(intensity).output;
  return (
    <group
      name="pool-perimeter-lighting"
      userData={{ sides: plan.selected.map((side) => side.id), length: plan.length }}
    >
      {plan.selected.map((side) => (
        <PerimeterSide key={side.id} side={side} night={night} colour={colour} output={output} />
      ))}
    </group>
  );
}
