import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import * as THREE from "three";
import ts from "typescript";
import { PNG } from "pngjs";

let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
const source = readFileSync("src/components/pool/three/NaturalGrassMaterial.tsx", "utf8");
const studio = readFileSync("src/components/pool/three/StudioPaving.tsx", "utf8");
const provenance = JSON.parse(readFileSync("public/textures/grass/mowed-lawn-v1/provenance.json", "utf8"));
check(provenance.license === "CC0-1.0" && provenance.author === "Sisters.seamless", "Reviewed photographic source and CC0 attribution retained");
check(provenance.calibration.includes("not a measured source scan"), "Visual scale calibration is not misrepresented as measured scan data");
for (const file of provenance.files) {
  const bytes = readFileSync(`public/textures/grass/mowed-lawn-v1/${file.name}`);
  check(bytes.length === file.bytes && createHash("sha256").update(bytes).digest("hex") === file.sha256, `${file.name}: reproducible prepared bytes`);
}
const packed = PNG.sync.read(readFileSync("public/textures/grass/mowed-lawn-v1/normal-rg-roughness-b.png"));
check(packed.width === 256 && packed.height === 256, "Bounded 256px shared normal/roughness sampler");
let minimumRoughness = 255, maximumSlope = 0;
for (let i = 0; i < packed.data.length; i += 4) {
  minimumRoughness = Math.min(minimumRoughness, packed.data[i + 2]);
  maximumSlope = Math.max(maximumSlope, Math.hypot(packed.data[i] / 255 * 2 - 1, packed.data[i + 1] / 255 * 2 - 1));
}
check(minimumRoughness / 255 >= .88 && maximumSlope < .5, "Conservative matte roughness and small reconstructed normals");
check(provenance.files.reduce((sum, file) => sum + file.bytes, 0) < 900000, "Two optimized delivery textures stay below 900KB combined");

const hooks = [];
let cursor = 0, effects = [];
const equal = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]));
const useMemo = (factory, deps) => {
  const index = cursor++;
  if (!hooks[index] || !equal(hooks[index].deps, deps)) hooks[index] = { deps, value: factory() };
  return hooks[index].value;
};
const useEffect = (effect, deps) => {
  const index = cursor++;
  if (!hooks[index] || !equal(hooks[index].deps, deps)) {
    const previous = hooks[index];
    effects.push(() => { previous?.cleanup?.(); hooks[index] = { deps, cleanup: effect() }; });
  }
};
const textures = [new THREE.Texture(), new THREE.Texture()];
const context = { exports: {}, require: name => {
  if (name === "three") return THREE;
  if (name === "react") return { useMemo, useEffect, useCallback: (callback, deps) => useMemo(() => callback, deps) };
  if (name === "@react-three/fiber") return { useLoader: () => textures, useThree: selector => selector({ gl: { capabilities: { getMaxAnisotropy: () => 16 } } }) };
  if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
  if (name === "./exteriorLightMask") return { excludeSubmergedDirectLights: (shader, waterY) => { shader.uniforms.exteriorWaterY = { value: waterY }; } };
  throw Error(`Unexpected dependency: ${name}`);
} };
runInNewContext(ts.transpileModule(`${source}\nexports.configureNaturalGrass = configureNaturalGrass;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
const render = (active, waterY = -.08) => {
  cursor = 0; effects = [];
  const result = context.exports.NaturalGrassMaterial({ active, waterY });
  effects.forEach(effect => effect());
  return result;
};
const first = render(true);
check(first.type === "primitive" && first.props.attach === "material", "Only the existing ground material slot is occupied");
check(first.props.map !== textures[0] && first.props.normalMap !== textures[1], "Consumer owns cloned samplers, never mutates URL-cached originals");
check(first.props.map.colorSpace === THREE.SRGBColorSpace && first.props.normalMap.colorSpace === THREE.NoColorSpace, "Colour/non-colour decoding is correct");
check(first.props.map.repeat.x === 1 && first.props.map.repeat.y === 1, "Metre UVs use a dimension-independent physical calibration");
check(first.props.map.generateMipmaps && first.props.map.minFilter === THREE.LinearMipmapLinearFilter && first.props.map.anisotropy === 8, "Mipmaps and anisotropy are bounded");
let mapDisposals = 0, materialDisposals = 0;
first.props.map.addEventListener("dispose", () => { mapDisposals++; });
first.props.normalMap.addEventListener("dispose", () => { mapDisposals++; });
first.props.object.addEventListener("dispose", () => { materialDisposals++; });
check(render(false).type === "meshStandardMaterial", "Early construction retains its plain ground presentation");
const resumed = render(true);
check(resumed.props.map === first.props.map && resumed.props.normalMap === first.props.normalMap && resumed.props.object === first.props.object, "Back/Continue reuses the exact photographic maps and compiled material");
check(mapDisposals === 0 && materialDisposals === 0, "Phase navigation does not dispose retained lawn resources");
const shader = { uniforms: {}, fragmentShader: "#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>" };
context.exports.configureNaturalGrass(shader, -.08);
check(shader.uniforms.exteriorWaterY.value === -.08, "Submerged exterior-light exclusion remains connected");
check(!shader.fragmentShader.includes("#include <map_fragment>") && shader.fragmentShader.includes("textureGrad"), "Photograph uses gradient-stable non-mirrored stochastic sampling");
check(shader.fragmentShader.includes("grassDetail.b") && shader.fragmentShader.includes("grassDetail.rg"), "Normals and roughness sample the same photographic patch, in one packed texture");
check(!shader.fragmentShader.includes("vec3 mapN = texture2D( normalMap"), "Packed normal data replaces the original standard normal decode");
check(studio.includes("grassPrepared") && studio.includes("if (environment) setGrassPrepared(true)"), "Photographic resources are initialized on first garden reveal only");
check(studio.includes("<NaturalGrassMaterial active={environment} waterY={waterY}"), "The owner remains mounted across later construction stages");
check(studio.includes("position={[0, -0.012, 0]}") && studio.includes("offsetOutline(outer, -0.04)"), "Approved ground elevation and deck contact overlap preserved");
hooks.forEach(hook => hook.cleanup?.());
check(mapDisposals === 2 && materialDisposals === 1, "True unmount releases both owned maps and material exactly once");
console.log(JSON.stringify({ status: "PASS", checks, minimumRoughness: minimumRoughness / 255, maximumAuthoredSlope: maximumSlope, textureBytes: provenance.files.reduce((sum, file) => sum + file.bytes, 0), scope: "Asset/hash/shader/lifecycle contracts; visual and GPU performance gates remain separate" }));
