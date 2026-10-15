/** Focused static check: mapped local previews, distinct product identities and provenance. */
import { readFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";
const source = await readFile("src/components/pool/wizard/product-media.tsx", "utf8");
const expected = ["skimmer-slim", "skimmer-high", "overflow-visible", "overflow-hidden", "access-ladder", "access-external", "comfort-sunShelf", "equipment-pellicano", "equipment-loungers", "equipment-sunShelfLoungers"];
const entries = [...source.matchAll(/"([\w-]+)":\s*\{\s*src:\s*"(\/product-previews\/[^\"]+)",\s*kind:\s*"3d-preview",\s*alt:\s*\{\s*it:\s*"([^\"]+)",\s*en:\s*"([^\"]+)"/g)];
assert.deepEqual(entries.map(entry => entry[1]).sort(), [...expected].sort());
assert.equal(new Set(entries.map(entry => entry[2])).size, expected.length, "Different products need different assets");
for (const [, key, path, it, en] of entries) {
  const file = `public${path}`;
  assert((await stat(file)).size > 1000, `${key}: nonempty asset`);
  const buffer = await readFile(file);
  assert.equal(buffer.readUInt16BE(0), 0xffd8, `${key}: JPEG`);
  assert(it.length > 35 && en.length > 35, `${key}: descriptive bilingual alternative`);
}
assert(source.includes('alt={`${label}: ${media.alt[locale]}`}'), "Alternative text identifies the media as 3D");
assert(source.includes('loading="lazy"'), "Previews load lazily");
assert(source.includes("configurazione scelta") && source.includes("selected configuration"), "Sample finishes are disclosed in both languages");
const provenance = await readFile("public/product-previews/PROVENANCE.md", "utf8");
for (const key of expected) assert(provenance.includes(`${key}.jpg`), `${key}: provenance`);
const captures = JSON.parse(await readFile("public/product-previews/capture-audit.json", "utf8")).results;
for (const key of expected) {
  const capture = captures.find(result => result.key === key);
  assert(capture && !/software|swiftshader|llvmpipe|unknown/i.test(capture.renderer), `${key}: actual GPU capture`);
  assert(capture.source.includes("Actual configurator geometry/materials/lighting"), `${key}: actual scene source`);
}
console.log(`PASS ${expected.length} distinct local 3D previews, bilingual alt, provenance and actual GPU capture.`);
