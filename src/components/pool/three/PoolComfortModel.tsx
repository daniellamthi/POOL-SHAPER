import { useEffect, useMemo, type ReactNode } from "react";
import type { FloorProfileModel } from "@/lib/pool/floor-profile";
import type { ComfortPlan } from "@/lib/pool/comfort-plan";
import { stairSolid } from "./PoolAccessModel";
import { BufferGeometry, Float32BufferAttribute } from "three";
import type { ComfortElementPlan } from "@/lib/pool/comfort-plan";

/** Union of shelf and treads: emit only exterior faces, never touching box faces.
 * The small rectilinear grid also retains metric UVs and a floor-following base. */
export function shelfStairGeometry(element: ComfortElementPlan, floor: FloorProfileModel) {
  const patches = [element, ...(element.landing ? [element.landing] : []), ...(element.steps ?? [])].map(part => ({
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
    quad([x0,floor.floorYAt(x0,z0),z0],[x1,floor.floorYAt(x1,z0),z0],
      [x1,floor.floorYAt(x1,z1),z1],[x0,floor.floorYAt(x0,z1),z1]);
    const edges: [number|undefined,[number,number],[number,number]][] = [
      [heights[i-1]?.[j],[x0,z0],[x0,z1]], [heights[i+1]?.[j],[x1,z1],[x1,z0]],
      [heights[i]?.[j-1],[x1,z0],[x0,z0]], [heights[i]?.[j+1],[x0,z1],[x1,z1]],
    ];
    for(const [neighbor,a,b] of edges) {
      if(neighbor!==undefined && neighbor>=y-1e-8) continue;
      const lowA=neighbor ?? floor.floorYAt(...a), lowB=neighbor ?? floor.floorYAt(...b);
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
}: {
  plan: ComfortPlan;
  floorProfile: FloorProfileModel;
  children: ReactNode;
}) {
  const geometries = useMemo(
    () =>
      plan.elements.map((element) => ({
        element,
        geometry: element.steps || floorProfile.shelfZone ? shelfStairGeometry(element, floorProfile) : stairSolid(
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
    </group>
  );
}
