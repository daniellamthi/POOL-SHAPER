import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { MINERAL_ATLAS, mineralAtlasPlan, toLinear, toSrgb } from "./lib/legacy-mineral-atlas.mjs";

const output = "public/textures/coping/derived-mineral-v3";
const hash = data => createHash("sha256").update(data).digest("hex");
const inputs = [
  { id: "ardesia", maps: ["basecolor", "normal"], size: [512, 249],
    source: "ShareTextures Dark Olive Slatefloor, existing CC0-derived source in public/textures/coping/ardesia; see ../CREDITS.md", license: "CC0 1.0" },
  { id: "prun", maps: ["basecolor"], size: [365, 547],
    source: "Owner-supplied Prun photograph, existing unchanged source in public/textures/coping/prun; see ../prun/README.md", license: "User supplied for this project; no external redistribution license asserted" },
];
const provenance = { version: "source-derived-periodic-mineral-v3", generator: "node scripts/bake-legacy-minerals.mjs", layout: MINERAL_ATLAS,
  method: "Original grain, integer-pixel translation only; albedo sRGB to linear-light weighted blend to sRGB; normal data blended linearly without color transfer or invented relief. No AI. No new material specification.",
  physicalScale: "Atlas covers exactly twice each original texture dimension at unchanged source texels per metre; runtime UV repeat is multiplied by 0.5, with original moduleSize/aspect retained.",
  images: [] };
mkdirSync(output, { recursive: true });
for (const input of inputs) for (const map of input.maps) {
  const sourcePath = `public/textures/coping/${input.id}/${map}.png`, original = readFileSync(sourcePath), source = PNG.sync.read(original);
  if (source.width !== input.size[0] || source.height !== input.size[1]) throw new Error(`Unexpected source dimensions ${sourcePath}`);
  const atlas = new PNG({ width: source.width * 2, height: source.height * 2 });
  const colour = map === "basecolor", linear = Array.from({ length: 256 }, (_, i) => toLinear(i));
  let singleSourcePixels = 0;
  for (let y = 0; y < atlas.height; y++) for (let x = 0; x < atlas.width; x++) {
    const plan = mineralAtlasPlan(source.width, source.height, (x + .5) / source.width, (y + .5) / source.height);
    const rgb = [0, 0, 0];
    if (plan.filter(sample => sample.weight > 0).length === 1) singleSourcePixels++;
    for (const { point, weight } of plan) {
      if (weight === 0) continue;
      const sx = Math.round(point[0]), sy = Math.round(point[1]);
      if (sx < 0 || sx >= source.width || sy < 0 || sy >= source.height) throw new Error("Source window escaped original pixels");
      const index = (sy * source.width + sx) * 4;
      for (let channel = 0; channel < 3; channel++) rgb[channel] += (colour ? linear[source.data[index + channel]] : source.data[index + channel]) * weight;
    }
    const index = (y * atlas.width + x) * 4;
    for (let c = 0; c < 3; c++) atlas.data[index + c] = colour ? toSrgb(rgb[c]) : Math.round(rgb[c]);
    atlas.data[index + 3] = 255;
  }
  const bytes = PNG.sync.write(atlas, { colorType: 2 }), path = `${output}/${input.id}-${map}.png`;
  writeFileSync(path, bytes);
  provenance.images.push({ id: input.id, map, sourcePath, sourceSha256: hash(original), sourceDimensions: [source.width, source.height], source: input.source,
    license: input.license, path, width: atlas.width, height: atlas.height, bytes: bytes.length, sha256: hash(bytes),
    singleSourcePixels, decodedRgbaBytes: atlas.width * atlas.height * 4 });
}
writeFileSync(`${output}/provenance.json`, JSON.stringify(provenance, null, 2) + "\n");
console.log(JSON.stringify({ status: "GENERATED", images: provenance.images.map(({ id, map, width, height, bytes, singleSourcePixels }) => ({ id, map, width, height, bytes, singleSourcePixels })) }));
