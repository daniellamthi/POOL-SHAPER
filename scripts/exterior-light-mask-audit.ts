import assert from "node:assert/strict";
import { Matrix3, PerspectiveCamera, Vector3, type WebGLProgramParametersWithUniforms } from "three";
import { excludeSubmergedDirectLights } from "../src/components/pool/three/exteriorLightMask";

const shader = { uniforms: {}, fragmentShader: "#include <lights_fragment_begin>" } as WebGLProgramParametersWithUniforms;
excludeSubmergedDirectLights(shader, -0.04);
assert.equal(shader.uniforms.exteriorWaterY?.value, -0.04);
assert(shader.fragmentShader.includes("directLight.color *= step(exteriorWaterY"));
assert(!shader.fragmentShader.includes("vec3 exteriorLightWorld"), "Unrolled light loops must not redeclare a shared local");
assert(shader.fragmentShader.includes("getDirectionalLightInfo"), "Daylight must remain in the original lighting chunk");
assert(shader.fragmentShader.includes("getSpotLightInfo"), "Above-ground spotlights retain the standard BRDF");
for (const position of [[12, 6, 8], [-8, 3, -12], [4, -3, 6]]) {
  const camera = new PerspectiveCamera();
  camera.position.set(position[0]!, position[1]!, position[2]!);
  camera.lookAt(0, -0.4, 0); camera.updateMatrixWorld();
  const inverseRotation = new Matrix3().setFromMatrix4(camera.matrixWorldInverse).transpose();
  for (const y of [-1, -0.2, 2, 9]) {
    const light = new Vector3(3, y, -2);
    const reconstructed = light.clone().applyMatrix4(camera.matrixWorldInverse).applyMatrix3(inverseRotation).add(camera.position);
    assert(Math.abs(reconstructed.y - y) < 1e-10);
    assert.equal(reconstructed.y >= -0.04, y >= -0.04, "Receiver mask classification must remain stable during orbit/reflection");
  }
}
console.log("Exterior light mask: injection, unrolled-loop safety and 12 camera/light classifications PASS");
