/** Rendering-scale gravity ripples, not a hydraulic/structural simulation.
 * ShapeGeometry UVs are metres. A bounded millimetric normal envelope,
 * shorter wavelengths and gravity-wave phase rates prevent the
 * previous metre-wide, minute-long drift from looking like a flat sheet. */
export const CALM_POOL_WAVES = [
  { k: [5.1, 2.4], height: 0.0078, phase: 0 },
  { k: [-2.1, 6.3], height: 0.0054, phase: 0.6 },
  { k: [10.8, -3.6], height: 0.0024, phase: 2.2 },
  { k: [15.6, 11.1], height: 0.0009, phase: 0.9 },
] as const;
const frequencies=CALM_POOL_WAVES.map(wave=>Math.sqrt(9.81*Math.hypot(...wave.k)));
const phase=(index:number,time:number)=>((frequencies[index]!*time+CALM_POOL_WAVES[index]!.phase)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
/** Reuse a single vector; bounded phases avoid float jitter in long sessions. */
export function writeCalmWavePhases(target:{set:(x:number,y:number,z:number,w:number)=>unknown},time:number) {
  target.set(phase(0,time),phase(1,time),phase(2,time),phase(3,time));
}
const glsl=(value:number)=>value.toFixed(6);
export const CALM_POOL_WAVE_SLOPE = CALM_POOL_WAVES.map((wave,index)=>{
  const k=`vec2(${glsl(wave.k[0])},${glsl(wave.k[1])})`;
  return `${k}*${glsl(wave.height)}*cos(dot(p,${k})-waterWavePhase.${"xyzw"[index]})`;
}).join(" +\n");
