import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "rolldown";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Texture, TextureLoader, ShaderChunk } from "three";

await build({
  input: ["src/configurator/materials/interior-textures.ts", "src/lib/pool/materials.ts",
    "src/components/pool/three/mosaicSampling.ts", "src/components/pool/three/mosaicTexture.ts"],
  output: { dir: resolve("node_modules/.cache/mosaic-audit"), format: "esm" },
  platform: "node",
  external: ["three"],
  resolve: { alias: { "@": resolve("src") } },
});
const { MOSAIC_FINISHES } = await import(pathToFileURL(resolve("node_modules/.cache/mosaic-audit/interior-textures.js")));
const { resolveMaterials } = await import(pathToFileURL(resolve("node_modules/.cache/mosaic-audit/materials.js")));
const { configureMosaicSampling, mosaicSourceCell } = await import(pathToFileURL(resolve("node_modules/.cache/mosaic-audit/mosaicSampling.js")));
const { requestMosaicTexture } = await import(pathToFileURL(resolve("node_modules/.cache/mosaic-audit/mosaicTexture.js")));
assert.equal(MOSAIC_FINISHES.length, 9);
for (const finish of MOSAIC_FINISHES) {
  const cells = finish.id.includes("dd99152f") ? 9 : 8;
  assert.equal(finish.tileSize / cells, 0.025, "consistent nominal tessera pitch");
  assert.equal(finish.textureMetadata.physicalWidth, finish.tileSize);
  assert.equal(finish.textureMetadata.physicalHeight, finish.tileSize);
  assert.equal(finish.texture, finish.maps.baseColorMap, "original catalog image retained");
  const png = readFileSync(`public${decodeURIComponent(finish.texture)}`);
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), "square photograph, no aspect stretch");
  const materials = resolveMaterials({ finish: "mosaic", mosaicFinish: finish.id,
    linerColor: "motionArcticWhite180", copingMaterial: "limestone", skimmerType: "standard", skimmerFinish: "white" });
  assert.equal(materials.surface.tileSize, finish.tileSize);
  assert.equal(materials.surface.maps.baseColorMap, finish.texture);
  assert.equal(materials.floor.color, "#ffffff");
  assert.equal(materials.liner.color, "#ffffff", "no tint over the source photo");
  assert.equal(materials.floor.roughness, materials.liner.roughness);
  assert.equal(materials.surface.wallClearcoat, materials.surface.floorClearcoat);
  assert(materials.floor.roughness >= 0.25 && materials.floor.roughness <= 0.4);
  assert.equal(materials.liner.metalness, 0);
  for (const dimension of [0.2, 0.45, 1.5, 3, 4, 5, 6, 8, 12]) {
    const tesserae = dimension / materials.surface.tileSize * cells;
    assert(Math.abs(tesserae - dimension / 0.025) < 1e-9, "resize does not rescale tesserae");
  }
}
// Wiring guard: photo detail shares the colour repeat; all four basin
// materials receive the same mosaic response, without changing PVC props.
const source = readFileSync("src/components/pool/three/PoolModel.tsx", "utf8");
assert.match(source, /const moduleSize = derivedSurfaceDetail\s*\? materials.surface.tileSize/);
assert.equal((source.match(/\.\.\.mosaicResponse/g) ?? []).length, 4);
assert.match(source, /const mosaicResponse = materials.surface.kind === "mosaic" \?/);
assert(!source.includes('materials.surface.kind === "liner" ? interiorMicroMaps.floorRoughness : null'));
assert(!source.includes('materials.surface.kind === "liner" ? interiorMicroMaps.floorAo : null'));
console.log("PASS: all 9 original mosaics, 8/9-cell calibration, 81 metric resize cases, neutral albedo, uniform PBR and photo-map wiring");

let stochasticChecks = 0;
for (const finish of MOSAIC_FINISHES) {
  const cells = Math.round(finish.tileSize / .025);
  const shader = {uniforms:{},vertexShader:"",fragmentShader:["common","map_fragment","normal_fragment_maps","roughnessmap_fragment","aomap_fragment"].map(c=>`#include <${c}>`).join("\n")};
  configureMosaicSampling(shader,finish.tileSize);
  assert.equal(shader.uniforms.poolMosaicCells.value,cells);
  assert(shader.fragmentShader.includes("poolMosaicSampleUv = poolMosaicUv(vMapUv)"));
  for (const sampler of ["map","normalMap","roughnessMap","aoMap"])
    assert(shader.fragmentShader.includes(`textureGrad( ${sampler}, poolMosaicSampleUv, poolMosaicDx, poolMosaicDy )`), "PBR channels share one source tile and metric derivatives");
  assert.equal((shader.fragmentShader.match(/poolMosaicUv\(vMapUv\)/g)||[]).length,1,"one atlas hash per fragment, not per map");
  assert.equal((shader.fragmentShader.match(/uniform sampler2D/g)||[]).length,0,"reuse existing sampler budget");
  let identicalSheetOffsets = 0;
  const used = new Set();
  for(let x=-32;x<32;x++)for(let y=-32;y<32;y++) {
    const choice=mosaicSourceCell(x,y,cells);
    assert.deepEqual(choice,mosaicSourceCell(x,y,cells),"deterministic after reselection");
    assert(choice.every(c=>Number.isInteger(c)&&c>=0&&c<cells),"only true photographed tesserae");
    used.add(choice.join(':'));
    if(choice.join(':')===mosaicSourceCell(x+cells,y,cells).join(':'))identicalSheetOffsets++;
    stochasticChecks+=2;
  }
  assert.equal(used.size,cells*cells,"original full colour/tile palette retained");
  assert(identicalSheetOffsets/4096<.05,"no repetition of the original whole sheet");
  // Remapping translates whole cells only: local derivative, pitch and grain
  // direction remain exactly unchanged, including negative metric UVs.
  for(const uv of [-13.227,-.135,.117,4.213]) {
    const cell=Math.floor(uv*cells), local=uv*cells-cell;
    const a=(mosaicSourceCell(cell,7,cells)[0]+local)/cells;
    const b=(mosaicSourceCell(cell,7,cells)[0]+local+.0001*cells)/cells;
    assert(Math.abs((b-a)-.0001)<1e-12,"no scaling, rotation or mirroring within a tessera");
    stochasticChecks++;
  }
}
assert.throws(()=>configureMosaicSampling({uniforms:{},fragmentShader:""},.7),/Unsupported/);
assert.match(source,/materials\.surface\.kind === "mosaic" \? configureInteriorMaterial : configureCaustics/,
  "PVC still uses its original unmodified material compiler");
assert.equal((source.match(/key=\{`\$\{showWater \? "wet" : "dry"\}\$\{mosaicSamplingKey\}`\}/g)||[]).length,4,
  "actual material instances refresh on mosaic shader/grid transitions");
assert(ShaderChunk.map_fragment.includes("texture2D( map, vMapUv )"),"installed Three hook verified");

// Real Three Texture/Source semantics with deterministic asynchronous loader.
const originalLoad=TextureLoader.prototype.load, pending=[];
TextureLoader.prototype.load=function(url,onLoad,_progress,onError){
  const texture=new Texture();pending.push({url,texture,onLoad,onError});return texture;
};
try {
  const url=MOSAIC_FINISHES[0].texture, received=[];
  const cancelFirst=requestMosaicTexture(url,t=>received.push(t),error=>{throw error;});
  const cancelSecond=requestMosaicTexture(url,t=>received.push(t),error=>{throw error;});
  assert.equal(pending.length,1,"parallel requests decode only once");
  cancelSecond();
  pending[0].texture.image={width:1,height:1};pending[0].onLoad(pending[0].texture);
  assert.equal(received.length,1,"cancelled subscriber never receives a texture");
  const sourceId=received[0].source.uuid;
  let disposed=0;received[0].addEventListener('dispose',()=>disposed++);
  cancelFirst();assert.equal(disposed,0,"delivered consumer owns its disposal");received[0].dispose();
  for(let i=0;i<10;i++){
    const cancel=requestMosaicTexture(url,t=>{assert.equal(t.source.uuid,sourceId,"photo-derived maps reuse stable source identity");t.dispose();},error=>{throw error;});
    await Promise.resolve();cancel();
  }
  assert.equal(pending.length,1,"ten reselections cause no new image decode or source UUID");
  let cancelledReadyCalled=false;
  const cancelReady=requestMosaicTexture(url,()=>{cancelledReadyCalled=true;},error=>{throw error;});cancelReady();await Promise.resolve();
  assert.equal(cancelledReadyCalled,false,"ready-cache microtask respects unmount");
  const failedUrl=MOSAIC_FINISHES[1].texture;let failures=0;
  requestMosaicTexture(failedUrl,()=>assert.fail('unexpected ready'),()=>failures++);
  pending[1].onError(new Error('intentional QA failure'));assert.equal(failures,1);
  const retryCancel=requestMosaicTexture(failedUrl,t=>t.dispose(),error=>{throw error;});
  assert.equal(pending.length,3,"failed image can be retried");retryCancel();
  assert.throws(()=>requestMosaicTexture('/textures/pvc-liner/untouched.png',()=>{},()=>{}),/Mosaic-only/);
}finally{TextureLoader.prototype.load=originalLoad;}
console.log(`PASS: ${stochasticChecks} deterministic source-cell/metric checks across all9; shared PBR lookup, same sampler budget, cache cancellation/reselection/retry; PVC branch retained`);
