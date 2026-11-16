import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Vector2, type Texture } from "three";
import type { SceneTimeOfDay } from "./PoolScene";
import { COAST_SEA_Y, coastalPhotoOrigin } from "./coastalLayout";

/** Distant photographic sky and an actual horizontal sea surface. No rocky
 * lower hemisphere is stretched into the foreground of the Infinity view. */
export function CoastalPhotoBackdrop({map,rotation,timeOfDay="day"}:{map:Texture;rotation:number;timeOfDay?:SceneTimeOfDay}) {
  const night = timeOfDay === "night";
  const sea = useMemo(() => ({ time: { value: 0 }, deep: { value: new Color(night ? "#102431" : "#345868") },
    horizon: { value: new Color(night ? "#253642" : "#98a9b6") }, photograph: { value: map },
    photoRotation: { value: new Vector2(Math.cos(rotation), Math.sin(rotation)) },
    photoOrigin: { value: new Vector2(coastalPhotoOrigin(rotation)[0], coastalPhotoOrigin(rotation)[2]) },
    photoGain: { value: night ? .12 : 1 } }), [night, map, rotation]);
  useFrame((_,dt) => { sea.time.value += Math.min(dt,.05); });
  return <group name="infinity-open-sea-environment">
    <mesh rotation={[0,rotation,0]} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[260,64,32]} />
      <meshBasicMaterial map={map} side={BackSide} depthWrite={false} toneMapped={false}
        color={night ? "#526579" : "#ffffff"}
        onBeforeCompile={shader => {
          shader.vertexShader = "varying vec3 vSkyRay;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
            "#include <begin_vertex>\n vSkyRay = transformed;");
          shader.fragmentShader = "varying vec3 vSkyRay;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
            vec3 skyDirection = normalize(vSkyRay);
            vec2 skyUv = vec2(0.5 + atan(skyDirection.z, skyDirection.x) / (2.0 * PI),
              0.5 + asin(max(0.015, skyDirection.y)) / PI);
            diffuseColor *= texture2D(map, skyUv);
          `);
        }} customProgramCacheKey={() => "infinity-open-sea-sky-v1"} />
    </mesh>
    <mesh name="infinity-open-sea" position={[0,COAST_SEA_Y,0]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[4000,4000]} />
      <shaderMaterial uniforms={sea} toneMapped={false}
        vertexShader={`varying vec3 seaWorld;void main(){seaWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(seaWorld,1.);}`}
        fragmentShader={`
          varying vec3 seaWorld;uniform float time;uniform vec3 deep;uniform vec3 horizon;
          uniform sampler2D photograph;uniform vec2 photoRotation;uniform vec2 photoOrigin;uniform float photoGain;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
          void main(){
            vec2 p=seaWorld.xz;vec3 view=normalize(cameraPosition-seaWorld);
            float dist=length(cameraPosition-seaWorld);
            float footprint=max(length(dFdx(p)),length(dFdy(p)));
            float fineAA=1.-smoothstep(.3,2.,footprint);
            float wave=noise(p*vec2(.45,2.8)+vec2(time*.03,-time*.17));
            float swell=noise(p*vec2(.07,.31)+vec2(0.,-time*.02));
            float fresnel=pow(1.-max(view.y,0.),3.);
            vec3 color=mix(deep,horizon,fresnel*.6);
            color*=.9+.16*swell+.06*(wave-.5)*fineAA;
            color+=horizon*pow(smoothstep(.55,.96,wave),3.)*.06*fineAA;
            color=mix(color,horizon,smoothstep(120.,1800.,dist));
            // The photographed open-water sector provides real distant wave
            // detail. Near water remains metric 3D; never sample the rocky
            // foreground or the photographed headland into the sea surface.
            vec2 rel=p-photoOrigin;
            vec3 ray=normalize(vec3(photoRotation.x*rel.x-photoRotation.y*rel.y,-3.,photoRotation.y*rel.x+photoRotation.x*rel.y));
            vec2 uv=vec2(.5+atan(ray.z,ray.x)/6.28318530718,.5+asin(ray.y)/3.14159265359);
            if(uv.x>.64) uv.x-=1.;
            float openWater=smoothstep(-.09,-.04,uv.x)*(1.-smoothstep(.34,.39,uv.x));
            // Bound the photo footprint to water only. The source cliff
            // foreground is not part of the sea and must never be projected.
            vec2 waterUv=vec2(.14+(uv.x-.14)*.65,max(.445,uv.y));
            color=mix(color,texture2D(photograph,waterUv).rgb*photoGain,openWater);
            gl_FragColor=vec4(color,1.);
            #include <colorspace_fragment>
          }`} />
    </mesh>
  </group>;
}
