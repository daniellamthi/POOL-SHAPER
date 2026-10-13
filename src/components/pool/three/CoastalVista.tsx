import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ShaderMaterial } from "three";
import type { RectangleInfinityZone } from "@/lib/pool/infinity-edge";
import type { Theme } from "@/lib/theme";
import { COAST_SEA_Y, coastFrame, createCoastalHeadland, createDistantIsland } from "./coastalLayout";

const noiseGLSL=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
`;
/** Four environment draws; ocean animates one uniform, no reflection pass or texture upload. */
export function CoastalVista({zone,theme}:{zone:RectangleInfinityZone;theme:Theme}) {
  const f=coastFrame(zone),sea=useRef<ShaderMaterial>(null);
  const meshes=useMemo(()=>[createCoastalHeadland(-1),createCoastalHeadland(1),createDistantIsland()],[]);
  useEffect(()=>()=>meshes.forEach(g=>g.dispose()),[meshes]);
  const uniforms=useMemo(()=>({time:{value:0},deep:{value:new Color(theme==="dark"?"#152a35":"#286176")},sky:{value:new Color(theme==="dark"?"#2d4149":"#94b4c6")}}),[theme]);
  useFrame((_,dt)=>{uniforms.time.value+=Math.min(dt,.05)*.16;});
  return <group name="infinity-coastal-vista" position={[f.x,0,f.z]} rotation={[0,Math.atan2(f.nx,f.nz),0]}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,COAST_SEA_Y,0]}>
      <planeGeometry args={[4000,4000]}/>
      <shaderMaterial ref={sea} uniforms={uniforms} toneMapped
        vertexShader={`varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`}
        fragmentShader={`${noiseGLSL}
        uniform float time;uniform vec3 deep;uniform vec3 sky;varying vec3 world;
        void main(){
          vec2 p=world.xz;vec3 view=normalize(cameraPosition-world);
          float distanceToEye=length(cameraPosition-world);
          float aa=1.-smoothstep(.18,1.1,max(length(dFdx(p)),length(dFdy(p))));
          float wave=noise(vec2(p.x*.43,p.y*2.9-time))* .6+noise(vec2(p.x*1.8+time,p.y*5.4))*.4;
          float fresnel=.02+.98*pow(1.-max(view.y,0.),5.);
          vec3 c=mix(deep,sky,fresnel*.5);
          c*=.86+.22*wave*aa;
          float glint=pow(smoothstep(.58,.94,wave),4.)*aa;
          c+=vec3(.14,.17,.18)*glint;
          c=mix(c,sky*.63,smoothstep(100.,1000.,distanceToEye)*.24);
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}/>
    </mesh>
    {meshes.slice(0,2).map((g,i)=><mesh key={i} geometry={g}>
      <meshStandardMaterial vertexColors roughness={.91} metalness={0} envMapIntensity={.65}
        onBeforeCompile={s=>{
          s.vertexShader="varying vec3 rockPosition;\n"+s.vertexShader;
          s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nrockPosition=position;");
          s.fragmentShader="varying vec3 rockPosition;\n"+noiseGLSL+s.fragmentShader;
          s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
            vec2 p=rockPosition.xz+rockPosition.y*vec2(.8,.35);
            float fissure=noise(p*3.4)*.6+noise(p*9.1)*.4;
            float aa=1.-smoothstep(.12,.8,length(fwidth(p)));
            diffuseColor.rgb*=mix(.94,.65+fissure*.6,aa);`);
        }} customProgramCacheKey={()=>"coastal-cliff-pbr-v1"}/>
    </mesh>)}
    <mesh geometry={meshes[2]!} position={[35,0,210]}><meshStandardMaterial color={theme==="dark"?"#263840":"#7a909b"} roughness={1} envMapIntensity={.7}/></mesh>
  </group>;
}
