import { BufferGeometry, Color, Float32BufferAttribute, MathUtils, PlaneGeometry } from "three";
import type { Outline } from "@/lib/pool/types";
import { clampInfinityEdgeDimensions, type RectangleInfinityZone } from "@/lib/pool/infinity-edge";
import type { CameraPose } from "@/lib/pool/camera";
import { outlineBounds } from "@/lib/pool/geometry";
import { createInfinityDeck } from "./infinityLandscape";

/** Architectural support outside the approved paving, open toward the sea.
 * Reuses the same actual outline/cutout; never changes the pool or its deck. */
export function createCoastalTerrace(outline: Outline, zone: RectangleInfinityZone, innerOffset: number, waterY = 0) {
  const geometry = createInfinityDeck(outline, zone, innerOffset, 20);
  const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv"), normals = geometry.getAttribute("normal");
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i) < -0.001 ? COAST_SEA_Y - 0.2 : -0.04;
    positions.setY(i, y);
    if (Math.abs(normals.getY(i)) > 0.5) uv.setXY(i, positions.getX(i), positions.getZ(i));
    else uv.setY(i, y);
  }
  // The support closes BELOW the existing receiver, never behind the glass.
  // Without it, the liner's lower back and the underside hang over the sea.
  const dims = clampInfinityEdgeDimensions(undefined);
  const top = waterY - dims.dropHeight - dims.catchBasinDepth - 0.08;
  const offset = dims.lipWidth + dims.catchBasinWidth + dims.wallThickness;
  const vertices = Array.from(positions.array), coords = Array.from(uv.array);
  const supported = zone.points.map((point, index) => {
    if (index !== 0 && index !== zone.points.length - 1) return point;
    const neighbour = zone.points[index === 0 ? 1 : index - 1]!;
    const dx = point[0] - neighbour[0], dz = point[1] - neighbour[1];
    const length = Math.hypot(dx, dz);
    return [point[0] + dx / length * innerOffset, point[1] + dz / length * innerOffset] as const;
  });
  for (let i=0;i<supported.length-1;i++) {
    const a=supported[i]!,b=supported[i+1]!,na=zone.pointNormals[i]!,nb=zone.pointNormals[i+1]!;
    const points=[[a[0]+na[0]*offset,top,a[1]+na[1]*offset],[b[0]+nb[0]*offset,top,b[1]+nb[1]*offset],
      [a[0]+na[0]*offset,COAST_SEA_Y-.2,a[1]+na[1]*offset],[b[0]+nb[0]*offset,COAST_SEA_Y-.2,b[1]+nb[1]*offset]];
    for(const k of [0,2,1,1,2,3]) { const p=points[k]!;vertices.push(...p);coords.push(p[0]!+p[2]!,p[1]!); }
  }
  // Close the short returns below the receiver as well: they must not
  // expose the basin liner when viewed from the exterior corner.
  for (const end of [0, zone.points.length - 1]) {
    const p = supported[end]!, n = zone.pointNormals[end]!;
    const points = [[p[0], top, p[1]], [p[0]+n[0]*offset, top, p[1]+n[1]*offset],
      [p[0], COAST_SEA_Y-.2, p[1]], [p[0]+n[0]*offset, COAST_SEA_Y-.2, p[1]+n[1]*offset]];
    for (const k of end === 0 ? [0,2,1,1,2,3] : [0,1,2,1,3,2]) {
      const v = points[k]!; vertices.push(...v); coords.push(v[0]!+v[2]!, v[1]!);
    }
  }
  geometry.setAttribute("position",new Float32BufferAttribute(vertices,3));
  geometry.setAttribute("uv",new Float32BufferAttribute(coords,2));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export const COAST_SEA_Y = -5;
// The projection floor is a photographic support plane, not the sea datum.
// Match the local site's existing outer grade instead of forcing the apron
// down to the old arbitrary -5 m skybox floor.
export const COAST_PHOTO_CAPTURE = { eyeY: 3, groundY: -1.8, height: 4.8, radius: 260 } as const;
// White Cliff Top: open sea with the headland to the right; the background
// and lighting rotate together with the selected Infinity edge.
export const COAST_PHOTO_YAW = (0.14 - 0.5) * Math.PI * 2 - Math.PI / 2;
/** Place the installation on the seaward terrace, not on the capture tripod.
 * The same origin is used by the dome and the real near-ground projection. */
export function coastalPhotoOrigin(rotation: number): [number, number, number] {
  const heading = rotation - COAST_PHOTO_YAW;
  return [-Math.sin(heading) * 14, COAST_PHOTO_CAPTURE.eyeY, -Math.cos(heading) * 14];
}
export function coastalPhotoRotation(zone:RectangleInfinityZone) {
  return Math.atan2(zone.normal[0],zone.normal[1])+COAST_PHOTO_YAW;
}
export function coastalPhotoSun(zone:RectangleInfinityZone,distance:number):[number,number,number] {
  const azimuth=(.625-.5)*Math.PI*2-coastalPhotoRotation(zone);
  const elevation=(.63-.5)*Math.PI;
  return [Math.cos(azimuth)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Math.sin(azimuth)*Math.cos(elevation)*distance];
}
export function coastFrame(zone: RectangleInfinityZone) {
  return { x: (zone.start[0]+zone.end[0])/2, z: (zone.start[1]+zone.end[1])/2,
    nx: zone.normal[0], nz: zone.normal[1] };
}
export function coastalCamera(
  outline: Outline,
  zone: RectangleInfinityZone,
  waterY: number,
  aspect: number,
  fov: number,
  coping?: { outset: number; y: number },
): CameraPose & { fov: number } {
  const f = coastFrame(zone);
  const local = outline.map(([x, z]) => ({
    u: (x - f.x) * f.nz - (z - f.z) * f.nx,
    v: (x - f.x) * f.nx + (z - f.z) * f.nz,
  }));
  const width = Math.max(...local.map((p) => p.u)) - Math.min(...local.map((p) => p.u));
  const length = -Math.min(...local.map((p) => p.v));
  const safeAspect = Math.max(0.25, aspect);
  const halfHorizontal = Math.atan(Math.tan((fov * Math.PI) / 360) * safeAspect);
  // POOL -> INFINITY EDGE -> LANDSCAPE. The pool must read whole, so fit its
  // NEAR wall (where it appears widest) with 0.8m either side, from a
  // standoff behind it that stays inside the seven-metre photographic-site
  // apron -- backing away further exposes the underside of the site.
  const standoff = MathUtils.clamp((width + 1.6) / 2 / Math.tan(halfHorizontal), 2.8, 6.5);
  const neededHorizontal = 2 * Math.atan((width + 1.6) / (2 * standoff));
  const fittedFov = Math.min(
    78,
    Math.max(fov, (2 * Math.atan(Math.tan(neededHorizontal / 2) / safeAspect) * 180) / Math.PI),
  );
  const halfVertical = (fittedFov * Math.PI) / 360;
  // Keep a low architectural eye line towards the vanishing edge. The metric
  // framing floor still lifts the eye when needed to retain the real rim.
  const outset = coping?.outset ?? 0;
  const bottomAngle = Math.atan(0.72 * Math.tan(halfVertical));
  const nearDistance = standoff - outset;
  const halfWidth = Math.max(...local.map(p => Math.abs(p.u))) + outset;
  const requiredDepth = halfWidth / (0.96 * Math.cos(bottomAngle) * Math.tan(halfVertical) * safeAspect);
  const height = Math.max(1.6, standoff * Math.tan(0.75 * halfVertical),
    (coping?.y ?? waterY) - waterY + Math.sqrt(Math.max(0, requiredDepth ** 2 - nearDistance ** 2)));
  const distance = length + standoff;
  const y = waterY + height;
  // Aim at the overflow crest where framing permits. Portrait framing must
  // not turn into a steeper top-down view to centre a wide Infinity side.
  const pitch = Math.max(Math.min(0.62 * halfVertical, Math.atan2(height, distance)), ...local.map(p =>
    Math.atan2(y - (coping?.y ?? waterY), distance + p.v - (coping?.outset ?? 0))
      - bottomAngle));
  return {
    fov: fittedFov,
    position: [f.x - f.nx * distance, y, f.z - f.nz * distance],
    target: [f.x, y - Math.tan(pitch) * distance, f.z],
  };
}
export function coastNoise(x:number,z:number) {
  const hash=(a:number,b:number)=>{const h=Math.sin(a*127.1+b*311.7)*43758.5453;return h-Math.floor(h);};
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return MathUtils.lerp(MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}
/** Retain the installed near grade; the distant selected half-space descends to sea. */
export function coastalGrade(geometry:BufferGeometry, zone:RectangleInfinityZone, outline?:Outline) {
  const f=coastFrame(zone),p=geometry.getAttribute("position"),bounds=outline ? outlineBounds(outline) : null;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i),v=(x-f.x)*f.nx+(z-f.z)*f.nz;
    let y=MathUtils.lerp(p.getY(i),COAST_SEA_Y-1.2,MathUtils.smoothstep(v,4.5,15));
    if(bounds) {
      const outside=Math.hypot(Math.max(bounds.minX-x,x-bounds.maxX,0),Math.max(bounds.minZ-z,z-bounds.maxZ,0));
      // Keep the installed pool, deck and receiving-trough support untouched.
      // Settle the outer rock only; at the edge its photographic UV and world
      // height coincide with the backdrop, so no transparency fade is needed.
      const end=5.6+0.12*(coastNoise(x*.7,z*.7)-.5);
      y=MathUtils.lerp(y,COAST_PHOTO_CAPTURE.groundY+.002,MathUtils.smoothstep(outside,2.3,end));
    }
    p.setY(i,y);
  }
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

/** Original asymmetric coastal headlands. Cliff terraces replace radial hill domes. */
export function createCoastalHeadland(side:-1|1) {
  const g=new PlaneGeometry(72,112,112,144);g.rotateX(-Math.PI/2);
  const p=g.getAttribute("position"),colors:number[]=[];
  const limestone=new Color("#958975"),scrub=new Color("#4b5038"),fracture=new Color("#625c50");
  for(let i=0;i<p.count;i++) {
    const a=p.getX(i)+42,z=p.getZ(i)+49;
    const bend=side===-1 ? 7+z*.035+2*Math.sin(z*.065) : 10+z*.045+3*Math.sin(z*.043+1.1);
    const edge=bend+3.4*(coastNoise(z*.12,side*4)-.5)+.7*(coastNoise(z*.7,side)-.5);
    const inland=a-edge;
    const envelope=MathUtils.smoothstep(z,-3,10)*(1-MathUtils.smoothstep(z,68,104));
    const cliff=MathUtils.smoothstep(inland,-2,4);
    const shoulder=MathUtils.smoothstep(inland,2.5,14);
    const strata=1.5*coastNoise(a*.33,z*.27)+.5*coastNoise(a*.9,z*.8);
    const peak=(center:number,width:number)=>Math.exp(-(((z-center)/width)**2));
    const ridge=side===-1
      ? 1.8+5.5*peak(17,11)+9*peak(51,17)+3*peak(79,8)
      : 2+3.4*peak(12,9)+7.5*peak(38,13)+5*peak(75,12);
    const height=ridge*cliff+shoulder*(1.2+1.8*coastNoise(a*.065,z*.05));
    const y=COAST_SEA_Y-1+(height+strata*cliff)*envelope;
    p.setXYZ(i,side*a,y,z);
    const vegetation=MathUtils.smoothstep(inland,3,10)*MathUtils.smoothstep(coastNoise(a*.36,z*.31),.35,.66);
    const c=limestone.clone().lerp(scrub,vegetation*.9).lerp(fracture,coastNoise(a*1.5,z*1.7)*.35);
    c.multiplyScalar(.85+.3*coastNoise(a*.95,z*1.05));colors.push(c.r,c.g,c.b);
  }
  // Mirroring X reverses winding; correct it rather than enabling double-sided rock.
  if(side===-1){const index=g.getIndex()!;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}}
  g.setAttribute("color",new Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function createDistantIsland() {
  const g=new PlaneGeometry(55,20,64,16);g.rotateX(-Math.PI/2);const p=g.getAttribute("position");
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),shore=Math.max(0,1-(x/28)**2-(z/11)**2);
    p.setY(i,COAST_SEA_Y-.4+shore*(2.1+1.3*coastNoise(x*.17,z*.2)));
  }
  g.computeVertexNormals();return g;
}
