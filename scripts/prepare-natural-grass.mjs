/** Reproducible offline texture preparation. No network, AI, or runtime baking.
 * The normal/roughness are conservative authored approximations from this
 * photograph, NOT measured photogrammetry or certified botanical dimensions. */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { PNG } from "pngjs";

const original = process.argv[2];
assert(original, "Pass the locally downloaded, reviewed CC0 original as the only argument");
const source = readFileSync(original);
const sha256 = data => createHash("sha256").update(data).digest("hex");
assert.equal(sha256(source), "8f583d90b92e520aa523fed7ae0bef0d801b521d5ae7e02f1e44c20dc8d8b0c9", "Only the reviewed original may be processed");
const out = resolve("public/textures/grass/mowed-lawn-v1");
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "pool-grass-preparation-"));
// Preserve the photographic colour. Only resampling and JPEG compression.
execFileSync("/usr/bin/sips", ["-z", "1024", "1024", "-s", "format", "jpeg", "-s", "formatOptions", "74", original, "--out", join(out, "basecolor.jpg")], { stdio: "pipe" });
const detailSource = join(scratch, "detail-source.png");
execFileSync("/usr/bin/sips", ["-z", "256", "256", "-s", "format", "png", original, "--out", detailSource], { stdio: "pipe" });
const image = PNG.sync.read(readFileSync(detailSource));
const size = image.width;
const luminance = (x, y) => {
  const index = (((y + size) % size) * size + (x + size) % size) * 4;
  return (image.data[index] * .2126 + image.data[index + 1] * .7152 + image.data[index + 2] * .0722) / 255;
};
const packed = new PNG({ width: size, height: size });
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  // Fine shading only: do not turn baked sunlight into deep grass geometry.
  const dx = (luminance(x - 1, y) - luminance(x + 1, y)) * .45;
  const dy = (luminance(x, y - 1) - luminance(x, y + 1)) * .45;
  const magnitude = Math.hypot(dx, dy, 1);
  const i = (y * size + x) * 4;
  packed.data[i] = Math.round((dx / magnitude * .5 + .5) * 255);
  // OpenGL +Y, with the source's top-down image coordinates accounted for.
  packed.data[i + 1] = Math.round((-dy / magnitude * .5 + .5) * 255);
  packed.data[i + 2] = Math.round((.89 + .07 * (1 - luminance(x, y))) * 255);
  packed.data[i + 3] = 255;
}
writeFileSync(join(out, "normal-rg-roughness-b.png"), PNG.sync.write(packed));
const files = ["basecolor.jpg", "normal-rg-roughness-b.png"].map(name => {
  const data = readFileSync(join(out, name));
  return { name, bytes: data.length, sha256: sha256(data) };
});
const metadata = {
  source: "https://commons.wikimedia.org/wiki/File:Mowed_fresh_green_seamless_healthy_lawn_grass_turf_texture.jpg",
  author: "Sisters.seamless", license: "CC0-1.0", sourceSHA256: sha256(source),
  photograph: "Own-work photograph, 25 June 2020; made seamless by the author in GIMP.",
  calibration: "1 metre rendering footprint; visually estimated from blade scale, not a measured source scan.",
  processing: "1024px photographic RGB; 256px packed OpenGL normal XY and authored matte roughness. No generated albedo or geometry.",
  gpuEstimateBytes: (1024 * 1024 + 256 * 256) * 4 * 4 / 3,
  gpuEstimateNote: "RGBA8 including mipmaps, estimate only; not measured GPU allocation.",
  files,
};
writeFileSync(join(out, "provenance.json"), JSON.stringify(metadata, null, 2) + "\n");
console.log(JSON.stringify({ files, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), output: out }));
