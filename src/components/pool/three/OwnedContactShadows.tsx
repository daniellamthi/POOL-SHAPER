/**
 * ContactShadows algorithm from @react-three/drei 10.7.8, with explicit
 * ownership cleanup for its six off-screen resources. Visual parameters,
 * depth/blur shaders and render passes are unchanged.
 *
 * MIT License
 * Copyright (c) 2020 react-spring
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { HorizontalBlurShader, VerticalBlurShader } from "three-stdlib";

type Props = Omit<ThreeElements["group"], "scale" | "color" | "ref"> & {
  scale?: number | [number, number];
  frames?: number;
  opacity?: number;
  width?: number;
  height?: number;
  blur?: number;
  near?: number;
  far?: number;
  resolution?: number;
  smooth?: boolean;
  color?: THREE.ColorRepresentation;
  depthWrite?: boolean;
  renderOrder?: number;
};

function createContactShadowResources(
  resolution: number,
  width: number,
  height: number,
  color: THREE.ColorRepresentation,
) {
  const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution);
  const renderTargetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
  renderTargetBlur.texture.generateMipmaps = renderTarget.texture.generateMipmaps = false;
  const planeGeometry = new THREE.PlaneGeometry(width, height).rotateX(Math.PI / 2);
  const blurPlane = new THREE.Mesh(planeGeometry);
  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.depthTest = depthMaterial.depthWrite = false;
  depthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms = { ...shader.uniforms, ucolor: { value: new THREE.Color(color) } };
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `uniform vec3 ucolor;
           void main() {
          `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "vec4( vec3( 1.0 - fragCoordZ ), opacity );",
      "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );",
    );
  };
  // The installed shader objects have exactly these three runtime fields.
  // Copy them explicitly: older stdlib typings allow undefined `defines`.
  const horizontalBlurMaterial = new THREE.ShaderMaterial({
    uniforms: HorizontalBlurShader.uniforms,
    vertexShader: HorizontalBlurShader.vertexShader,
    fragmentShader: HorizontalBlurShader.fragmentShader,
  });
  const verticalBlurMaterial = new THREE.ShaderMaterial({
    uniforms: VerticalBlurShader.uniforms,
    vertexShader: VerticalBlurShader.vertexShader,
    fragmentShader: VerticalBlurShader.fragmentShader,
  });
  verticalBlurMaterial.depthTest = horizontalBlurMaterial.depthTest = false;
  return [
    renderTarget,
    planeGeometry,
    depthMaterial,
    blurPlane,
    horizontalBlurMaterial,
    verticalBlurMaterial,
    renderTargetBlur,
  ] as const;
}

function releaseContactShadowResources(resources: ReturnType<typeof createContactShadowResources>) {
  const [
    renderTarget,
    planeGeometry,
    depthMaterial,
    ,
    horizontalBlurMaterial,
    verticalBlurMaterial,
    renderTargetBlur,
  ] = resources;
  renderTarget.dispose();
  renderTargetBlur.dispose();
  planeGeometry.dispose();
  depthMaterial.dispose();
  horizontalBlurMaterial.dispose();
  verticalBlurMaterial.dispose();
}

export function OwnedContactShadows({
  scale = 10,
  frames = Infinity,
  opacity = 1,
  width = 1,
  height = 1,
  blur = 1,
  near = 0,
  far = 10,
  resolution = 512,
  smooth = true,
  color = "#000000",
  depthWrite = false,
  renderOrder,
  ...props
}: Props) {
  const ref = useRef<THREE.Group>(null);
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const shadowCamera = useRef<THREE.OrthographicCamera>(null);
  width = width * (Array.isArray(scale) ? scale[0] : scale || 1);
  height = height * (Array.isArray(scale) ? scale[1] : scale || 1);
  const resources = useMemo(
    () => createContactShadowResources(resolution, width, height, color),
    [resolution, width, height, color],
  );
  const [
    renderTarget,
    planeGeometry,
    depthMaterial,
    blurPlane,
    horizontalBlurMaterial,
    verticalBlurMaterial,
    renderTargetBlur,
  ] = resources;
  useEffect(() => () => releaseContactShadowResources(resources), [resources]);
  const blurShadows = (amount: number) => {
    blurPlane.visible = true;
    blurPlane.material = horizontalBlurMaterial;
    horizontalBlurMaterial.uniforms["tDiffuse"]!.value = renderTarget.texture;
    horizontalBlurMaterial.uniforms["h"]!.value = (amount * 1) / 256;
    gl.setRenderTarget(renderTargetBlur);
    gl.render(blurPlane, shadowCamera.current!);
    blurPlane.material = verticalBlurMaterial;
    verticalBlurMaterial.uniforms["tDiffuse"]!.value = renderTargetBlur.texture;
    verticalBlurMaterial.uniforms["v"]!.value = (amount * 1) / 256;
    gl.setRenderTarget(renderTarget);
    gl.render(blurPlane, shadowCamera.current!);
    blurPlane.visible = false;
  };
  let count = 0;
  useFrame(() => {
    if (ref.current && shadowCamera.current && (frames === Infinity || count < frames)) {
      count++;
      const initialBackground = scene.background;
      const initialOverrideMaterial = scene.overrideMaterial;
      ref.current.visible = false;
      scene.background = null;
      scene.overrideMaterial = depthMaterial;
      gl.setRenderTarget(renderTarget);
      gl.render(scene, shadowCamera.current);
      blurShadows(blur);
      if (smooth) blurShadows(blur * 0.4);
      gl.setRenderTarget(null);
      ref.current.visible = true;
      scene.overrideMaterial = initialOverrideMaterial;
      scene.background = initialBackground;
    }
  });
  return (
    <group rotation-x={Math.PI / 2} {...props} ref={ref}>
      <mesh
        {...(renderOrder === undefined ? {} : { renderOrder })}
        geometry={planeGeometry}
        scale={[1, -1, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial
          transparent
          map={renderTarget.texture}
          opacity={opacity}
          depthWrite={depthWrite}
        />
      </mesh>
      <orthographicCamera
        ref={shadowCamera}
        args={[-width / 2, width / 2, height / 2, -height / 2, near, far]}
      />
    </group>
  );
}
