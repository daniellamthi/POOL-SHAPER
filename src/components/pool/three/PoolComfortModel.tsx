import { StainlessSteelMaterial } from "./StainlessSteelMaterial";
import { useEffect, useMemo, type ReactNode } from "react";
import type { FloorProfileModel } from "@/lib/pool/floor-profile";
import type { ComfortPlan } from "@/lib/pool/comfort-plan";
import { stairSolid } from "./PoolAccessModel";
import { BufferGeometry, Float32BufferAttribute, Object3D } from "three";
import { HYDRO_DIMENSIONS } from "@/lib/pool/comfort-plan";
import type { ComfortElementPlan } from "@/lib/pool/comfort-plan";
import { INTEGRATED_BENCH } from "@/lib/pool/integrated-bench";
import { benchMicroSpotBeam, MICRO_SPOT_OPTICS, microSpotPresentation, type MicroSpotBeam } from "@/lib/pool/micro-spot-optics";

/** Union of shelf and treads: emit only exterior faces, never touching box faces.
 * The small rectilinear grid also retains metric UVs and a floor-following base. */
export function shelfStairGeometry(element: ComfortElementPlan, floor: FloorProfileModel) {
  const baseY = (x: number, z: number) => floor.floorYAt(x, z) - (element.kind === "integratedBench" ? INTEGRATED_BENCH.floorOverlap : 0);
  const patches = [...(element.tiers ?? [element]), ...(element.landing ? [element.landing] : []), ...(element.steps ?? [])].map(part => ({
    minX: Math.min(...part.footprint.map(p => p[0])), maxX: Math.max(...part.footprint.map(p => p[0])),
    minZ: Math.min(...part.footprint.map(p => p[1])), maxZ: Math.max(...part.footprint.map(p => p[1])),
    y: part.topY,
  }));
  const snap = (value:number) => Math.round(value * 1e8) / 1e8;
  const xs = [...new Set(patches.flatMap(p => [snap(p.minX), snap(p.maxX)]))].sort((a,b) => a-b);
  const zs = [...new Set(patches.flatMap(p => [snap(p.minZ), snap(p.maxZ)]))].sort((a,b) => a-b);
  if(floor.shelfZone) {
    const values=floor.axis==="x"?xs:zs, cut=snap(floor.shelfZone.slopeStart);
    if(cut>values[0]! && cut<values[values.length-1]! && !values.includes(cut)) {
      values.push(cut); values.sort((a,b)=>a-b);
    }
  }
  const heights = xs.slice(1).map((_,i) => zs.slice(1).map((_,j) =>
    patches.find(p => (xs[i]!+xs[i+1]!)/2 > p.minX && (xs[i]!+xs[i+1]!)/2 < p.maxX &&
      (zs[j]!+zs[j+1]!)/2 > p.minZ && (zs[j]!+zs[j+1]!)/2 < p.maxZ)?.y));
  const vertices: number[] = [];
  type V = [number,number,number];
  const quad = (a:V,b:V,c:V,d:V) => vertices.push(...a,...b,...c,...a,...c,...d);
  const levels=[...new Set(patches.map(p=>p.y))].sort((a,b)=>b-a);
  for(let i=0;i<xs.length-1;i++) for(let j=0;j<zs.length-1;j++) {
    const y=heights[i]?.[j]; if(y===undefined) continue;
    const x0=xs[i]!,x1=xs[i+1]!,z0=zs[j]!,z1=zs[j+1]!;
    quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0]);
    quad([x0,baseY(x0,z0),z0],[x1,baseY(x1,z0),z0],
      [x1,baseY(x1,z1),z1],[x0,baseY(x0,z1),z1]);
    const edges: [number|undefined,[number,number],[number,number]][] = [
      [heights[i-1]?.[j],[x0,z0],[x0,z1]], [heights[i+1]?.[j],[x1,z1],[x1,z0]],
      [heights[i]?.[j-1],[x1,z0],[x0,z0]], [heights[i]?.[j+1],[x0,z1],[x1,z1]],
    ];
    for(const [neighbor,a,b] of edges) {
      if(neighbor!==undefined && neighbor>=y-1e-8) continue;
      const lowA=neighbor ?? baseY(...a), lowB=neighbor ?? baseY(...b);
      const polygon:V[]=[ [a[0],y,a[1]],
        ...levels.filter(level=>level<y-1e-8 && level>lowA+1e-8).map(level=>[a[0],level,a[1]] as V),
        [a[0],lowA,a[1]],[b[0],lowB,b[1]],
        ...levels.filter(level=>level<y-1e-8 && level>lowB+1e-8).reverse().map(level=>[b[0],level,b[1]] as V),
        [b[0],y,b[1]] ];
      const center:V=[(a[0]+b[0])/2,(y+(lowA+lowB)/2)/2,(a[1]+b[1])/2];
      polygon.forEach((point,k)=>vertices.push(...center,...point,...polygon[(k+1)%polygon.length]!));
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const normal=geometry.getAttribute("normal"), uv:number[]=[];
  for(let i=0;i<vertices.length/3;i++) {
    const x=vertices[i*3]!,y=vertices[i*3+1]!,z=vertices[i*3+2]!;
    uv.push(Math.abs(normal.getY(i))>0.9 ? x : Math.abs(normal.getX(i))>0.5 ? z : x,
      Math.abs(normal.getY(i))>0.9 ? z : y);
  }
  geometry.setAttribute("uv",new Float32BufferAttribute(uv,2));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Closed, floor-following comfort solids. The supplied material is the same
 * liner/mosaic + caustics material used by the integrated stairs. */
export function PoolComfortModel({
  plan,
  floorProfile,
  children,
  showJets = true,
  showBenchLighting = false,
  night = false,
  ledColor,
  ledIntensity,
}: {
  plan: ComfortPlan;
  floorProfile: FloorProfileModel;
  children: ReactNode;
  showJets?: boolean;
  /** Optional LED micro-spots, independent from the hydromassage jets. */
  showBenchLighting?: boolean;
  /** Night scene: the hydromassage micro-spots glow softly. */
  night?: boolean;
  ledColor?: string | undefined;
  ledIntensity?: number | undefined;
}) {
  const geometries = useMemo(
    () =>
      plan.elements.map((element) => ({
        element,
        geometry: element.kind === "integratedBench" || element.tiers?.length || element.steps || floorProfile.shelfZone ? shelfStairGeometry(element, floorProfile) : stairSolid(
          element.footprint,
          element.topY,
          { x: 0, z: 0, rotation: 0 },
          floorProfile,
        ),
      })),
    [plan.elements, floorProfile],
  );
  useEffect(() => () => geometries.forEach(({ geometry }) => geometry.dispose()), [geometries]);

  return (
    <group name="pool-comfort">
      {geometries.map(({ element, geometry }) => (
        <mesh
          key={element.kind}
          name={`pool-comfort-${element.kind}`}
          geometry={geometry}
          castShadow
          receiveShadow
        >
          {children}
        </mesh>
      ))}
      {showJets &&
        plan.elements.flatMap((element) =>
          (element.jets ?? []).map((jet, index) => (
            <HydroJet key={`${element.kind}-jet-${index}`} jet={jet} />
          )),
        )}
      {showJets && showBenchLighting &&
        plan.elements.flatMap((element) =>
          (element.spots ?? []).map((spot, index) => (
            <HydroSpot key={`${element.kind}-spot-${index}`} spot={spot} night={night} ledColor={ledColor} ledIntensity={ledIntensity}
              beam={benchMicroSpotBeam(spot, element, floorProfile)} />
          )),
        )}
    </group>
  );
}

/** Miniature version of the main pool fitting: recessed tapered body, rolled
 * satin trim, dark seal and a clear lens. No large decorative halo. The short
 * shadow-free beam lights only the nearby tread/footwell at night. */
export function HydroSpot({
  spot,
  night,
  ledColor,
  ledIntensity,
  beam,
}: {
  spot: NonNullable<ComfortElementPlan["spots"]>[number];
  night: boolean;
  ledColor?: string | undefined;
  ledIntensity?: number | undefined;
  beam?: MicroSpotBeam;
}) {
  const d = HYDRO_DIMENSIONS.spotDiameter;
  const rotY = Math.atan2(spot.dir[0], spot.dir[1]);
  const light = useMemo(() => microSpotPresentation(night, ledColor, ledIntensity), [night, ledColor, ledIntensity]);
  const aim = beam?.target ?? MICRO_SPOT_OPTICS.target;
  const target = useMemo(() => {
    const object = new Object3D();
    object.position.set(aim[0], aim[1], aim[2]);
    return object;
  }, [aim[0], aim[1], aim[2]]);
  return (
    <group name="pool-hydro-spot" position={[spot.x, spot.y, spot.z]} rotation={[0, rotY, 0]}>
      <mesh name="micro-spot-recessed-body" position={[0, 0, MICRO_SPOT_OPTICS.bodyCenter]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[d * 0.44, d * 0.48, MICRO_SPOT_OPTICS.bodyDepth, 24]} />
        <StainlessSteelMaterial finish="brushed" color="#9aa3a6" />
      </mesh>
      <mesh name="micro-spot-trim" position={[0, 0, MICRO_SPOT_OPTICS.trimCenter]}>
        <torusGeometry args={[d / 2 - MICRO_SPOT_OPTICS.trimTube, MICRO_SPOT_OPTICS.trimTube, 8, 32]} />
        <StainlessSteelMaterial finish="satin" />
      </mesh>
      <mesh name="micro-spot-seal" position={[0, 0, 0.0009]}>
        <ringGeometry args={[d * MICRO_SPOT_OPTICS.lensRadiusRatio, d * 0.43, 32]} />
        <meshStandardMaterial color="#333f42" roughness={0.5} />
      </mesh>
      <mesh name="micro-spot-lens" position={[0, 0, MICRO_SPOT_OPTICS.lensCenter]}>
        <circleGeometry args={[d * MICRO_SPOT_OPTICS.lensRadiusRatio, 32]} />
        <meshPhysicalMaterial color="#aabfc3" roughness={0.18} clearcoat={0.8} clearcoatRoughness={0.12}
          emissive={light.colour} emissiveIntensity={light.emission} />
      </mesh>
      <primitive object={target} />
      {/* Retain the light graph. Day/OFF writes zero intensity; mounting the
          same fitting at night recompiles every lit material in the scene. */}
        <spotLight name="micro-spot-footwell-light" position={[0, 0, MICRO_SPOT_OPTICS.lensCenter + MICRO_SPOT_OPTICS.emitterEpsilon]}
          target={target} color={light.colour} intensity={light.output} distance={beam?.range ?? MICRO_SPOT_OPTICS.range}
          angle={MICRO_SPOT_OPTICS.angle} penumbra={1} decay={2} castShadow={false} />
    </group>
  );
}

/** Flush stainless nozzle set into the seat riser: chrome bezel + dark orifice.
 * Protrusion is a few mm so it never z-fights with the liner face. */
function HydroJet({ jet }: { jet: NonNullable<ComfortElementPlan["jets"]>[number] }) {
  const d = jet.diameter ?? HYDRO_DIMENSIONS.jetDiameter;
  const rotY = Math.atan2(jet.dir[0], jet.dir[1]);
  return (
    <group name="pool-hydro-jet" position={[jet.x, jet.y, jet.z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, 0.0025]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[d / 2, d / 2, 0.005, 24]} />
        <StainlessSteelMaterial finish="satin" />
      </mesh>
      <mesh position={[0, 0, 0.0056]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[d * 0.26, d * 0.26, 0.002, 16]} />
        <meshStandardMaterial color="#2a2f31" metalness={0} roughness={0.6} />
      </mesh>
    </group>
  );
}
