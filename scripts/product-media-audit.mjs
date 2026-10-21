/** Photography acceptance replaces the retired configurator-capture contract. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const out = resolve("node_modules/.cache/product-photography");
await build({ input: ["src/lib/pool/product-photography.ts", "src/lib/i18n/index.tsx"], output: { dir: out, format: "esm" }, platform: "node", resolve: { alias: { "@": resolve("src") } }, external: ["react", "react/jsx-runtime"] });
const { productPhotographyRequirements: requirements, productPhotographs: photos } = await import(pathToFileURL(`${out}/product-photography.js`).href);
const { translateText } = await import(pathToFileURL(`${out}/index.js`).href);
for (const [it, en] of [["Rettilinea", "Straight"], ["Angolare", "Corner"]]) {
  assert.equal(translateText(it, "en"), en);
  assert.equal(translateText(en, "it"), it);
}
const source = await readFile("src/components/pool/wizard/product-media.tsx", "utf8");
const trays = await readFile("src/components/pool/wizard/StepTrays.tsx", "utf8");
const sourcePhotos = JSON.parse(await readFile("public/product-photos/sources.json", "utf8")).photos;
const prepared = JSON.parse(await readFile("public/product-photos/prepared-files.json", "utf8")).files;
assert.equal(requirements.length, 55, "Mapped actual current choices, not an assumed mosaic count");
assert.equal(new Set(requirements.map(r => r.optionId)).size, requirements.length);
assert.equal(new Set(requirements.map(r => r.mediaKey)).size, requirements.length);
assert.equal(requirements.filter(r => r.optionId.startsWith("linerColor=")).length, 6);
assert.equal(requirements.filter(r => r.optionId.startsWith("mosaicFinish=")).length, 9);
assert.deepEqual(Object.keys(photos).sort(), ["access-ladder", "equipment-loungers", "coping-prun", "paving-prun"].sort());
const checked = new Set(); let bytes = 0, checks = 0;
for (const requirement of requirements) {
  if (!requirement.photo) { assert(requirement.missing?.length > 20); checks++; continue; }
  const photo = requirement.photo;
  assert.equal(requirement.missing, null);
  assert(photo.source && photo.author && photo.license && photo.authorization);
  assert(["reference", "exact-sample"].includes(photo.match));
  assert(photo.alt.it.length > 40 && photo.alt.en.length > 40);
  assert(photo.note.it.length > 50 && photo.note.en.length > 50);
  assert(photo.focalPoint.every(v => v >= 0 && v <= 1));
  for (const variant of photo.variants) {
    assert(variant.src.startsWith("/product-photos/") && !/previews|data:|https?:/.test(variant.src));
    const buffer = await readFile(`public${variant.src}`);
    assert.equal(buffer.readUInt16BE(0), 0xffd8);
    assert(buffer.length < 160000 && variant.width <= 960);
    const dimensions = execFileSync("sips", ["--getProperty", "pixelWidth", "--getProperty", "pixelHeight", `public${variant.src}`], { encoding: "utf8" });
    assert.equal(Number(dimensions.match(/pixelWidth:\s*(\d+)/)[1]), variant.width);
    assert.equal(Number(dimensions.match(/pixelHeight:\s*(\d+)/)[1]), variant.height);
    const record = prepared.find(p => p.src === variant.src);
    assert(record);
    assert.equal(createHash("sha256").update(buffer).digest("hex"), record.sha256);
    if (variant.src.includes("prun")) assert.equal(record.sourceSHA256, createHash("sha256").update(await readFile("public/textures/coping/prun/basecolor.png")).digest("hex"));
    if (!checked.has(variant.src)) { checked.add(variant.src); bytes += buffer.length; }
    checks++;
  }
  if (photo.match === "reference") {
    const provenance = sourcePhotos.find(p => p.productKeys.includes(requirement.mediaKey));
    assert(provenance?.licenseVerified && provenance.sourcePage === photo.source);
    assert.equal(provenance.exactProduct, false);
  } else {
    assert(requirement.mediaKey.endsWith("prun"));
    const permission = await readFile(photo.source, "utf8");
    assert(permission.includes("owner-supplied") && permission.includes("permission"));
  }
}
assert(!source.includes("/product-previews/"), "Our 3D captures are never product photography or error fallback");
for (const contract of ['loading="lazy"', 'decoding="async"', 'srcSet=', 'sizes=', 'width=', 'height=', 'objectPosition', 'onError=', 'ImageOff', 'Foto indicativa', 'Reference photo', 'Campione fotografico', 'Photo sample', 'Foto non disponibile', 'Photo unavailable']) assert(source.includes(contract), contract);
assert(source.includes("media.alt[locale]") && source.includes("media.note[locale]"));
assert(trays.includes('image={ill("system-infinity")}'), "Traditional Infinity must not fall through to comfort-none");
assert(trays.includes('hasProductMedia(`coping-${option.id}`)') && trays.includes('hasProductMedia(`paving-${p.id}`)'));
// The photo task must not change the card's state/navigation/command icons.
assert.equal(execFileSync("git", ["diff", "--", "src/components/pool/wizard/ChoiceCard.tsx"], { encoding: "utf8" }), "");
const manifest = { checkedAt: "2026-10-15", totalOptions: requirements.length, approvedPhotoOptions: Object.keys(photos).length, note: "4/55 options use three authorized photographs. Other 51 are explicitly MISSING, not PASS. Existing raster/synthetic catalogue swatches remain unchanged and do not prove photographic rights.", requirements };
await mkdir("public/product-photos", { recursive: true });
const manifestPath = "public/product-photos/manifest.json";
const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
// An unchanged audit must not trigger Vite's public-asset full reload while a
// customer is using the live preview or an independent reviewer is testing it.
if (await readFile(manifestPath, "utf8").catch(() => null) !== manifestJson) await writeFile(manifestPath, manifestJson);
console.log(JSON.stringify({ status: "PASS_IMPLEMENTED_SUBSET", requirementCoverage: `${Object.keys(photos).length}/${requirements.length}`, missing: requirements.filter(r => !r.photo).length, uniquePhotographs: 3, files: checked.size, bytes, checks, manifest: "public/product-photos/manifest.json" }));
