/** Only licensed, visually checked photographs. Crop/resize/JPEG; no generated pixels. */
import { mkdir, mkdtemp, readFile, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const out = resolve("public/product-photos");
const sourceDirectory = process.argv.find(value => value.startsWith("--source-dir="))?.slice(13);
const prunOnly = process.argv.includes("--prun-only");
const sources = [
  {
    id: "inox-ladder", sourceFilename: "inox-ladder.jpg",
    url: "https://images.pexels.com/photos/9119739/pexels-photo-9119739.jpeg?cs=srgb&dl=pexels-pavel-danilyuk-9119739.jpg&fm=jpg",
    sha256: "2fab65d5650c6f00e74c471fce6934a81140674ab2e4e33321116bf78309e88e",
    original: { width: 6016, height: 4016 }, crop: { x: 0, y: 1500, width: 4800, height: 2400 },
  },
  {
    id: "outdoor-chaise", sourceFilename: "outdoor-chaise.jpg",
    url: "https://images.pexels.com/photos/15780455/pexels-photo-15780455.jpeg?cs=srgb&dl=pexels-alinaskazka-15780455.jpg&fm=jpg",
    sha256: "f1239163d4688bdfb93a79f6e212336ebaf5bc45f2395e89d5a3ed7028660972",
    original: { width: 3946, height: 5912 }, crop: { x: 0, y: 2600, width: 3946, height: 1973 },
  },
];
await mkdir(out, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "pool-photo-preparation-"));
const files = prunOnly ? JSON.parse(await readFile(join(out, "prepared-files.json"), "utf8")).files.filter(file => file.photoId !== "prun") : [];
for (const source of prunOnly ? [] : sources) {
  let original;
  if (sourceDirectory) original = await readFile(join(resolve(sourceDirectory), source.sourceFilename));
  else {
    const response = await fetch(source.url);
    assert(response.ok, `${source.id}: source HTTP ${response.status}`);
    original = Buffer.from(await response.arrayBuffer());
  }
  assert.equal(createHash("sha256").update(original).digest("hex"), source.sha256, `${source.id}: exact reviewed source bytes`);
  const sourcePath = join(temporary, `${source.id}-source.jpg`), croppedPath = join(temporary, `${source.id}-crop.jpg`);
  await writeFile(sourcePath, original);
  const { x, y, width, height } = source.crop;
  assert(x >= 0 && y >= 0 && x + width <= source.original.width && y + height <= source.original.height);
  execFileSync("sips", ["--cropOffset", String(y), String(x), "--cropToHeightWidth", String(height), String(width), sourcePath, "--out", croppedPath], { stdio: "pipe" });
  for (const outputWidth of [480, 960]) {
    const filename = `${source.id}-${outputWidth}.jpg`, path = join(out, filename);
    execFileSync("sips", ["--resampleWidth", String(outputWidth), "--setProperty", "format", "jpeg", "--setProperty", "formatOptions", "78", croppedPath, "--out", path], { stdio: "pipe" });
    const bytes = await readFile(path);
    assert.equal(bytes.readUInt16BE(0), 0xffd8, `${filename}: JPEG`);
    const dimensions = execFileSync("sips", ["--getProperty", "pixelWidth", "--getProperty", "pixelHeight", path], { encoding: "utf8" });
    const actualWidth = Number(dimensions.match(/pixelWidth:\s*(\d+)/)?.[1]), actualHeight = Number(dimensions.match(/pixelHeight:\s*(\d+)/)?.[1]);
    assert.equal(actualWidth, outputWidth); assert.equal(actualHeight, outputWidth / 2);
    const size = (await stat(path)).size;
    assert(size < 200000, `${filename}: bounded optimized delivery size`);
    files.push({ photoId: source.id, src: `/product-photos/${filename}`, width: actualWidth, height: actualHeight, bytes: size, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
}
// Reuse the exact owner-provided stone photograph, without upscaling or retouch.
const prunSource = resolve("public/textures/coping/prun/basecolor.png");
for (const width of [256, 365]) {
  const filename = `prun-${width}.jpg`, path = join(out, filename);
  const resize = width === 256 ? ["--resampleWidth", "256"] : [];
  execFileSync("sips", [...resize, "--setProperty", "format", "jpeg", "--setProperty", "formatOptions", "82", prunSource, "--out", path], { stdio: "pipe" });
  const bytes = await readFile(path);
  const dimensions = execFileSync("sips", ["--getProperty", "pixelWidth", "--getProperty", "pixelHeight", path], { encoding: "utf8" });
  files.push({ photoId: "prun", src: `/product-photos/${filename}`, width: Number(dimensions.match(/pixelWidth:\s*(\d+)/)[1]), height: Number(dimensions.match(/pixelHeight:\s*(\d+)/)[1]), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), sourceSHA256: createHash("sha256").update(await readFile(prunSource)).digest("hex") });
}
await writeFile(join(out, "prepared-files.json"), JSON.stringify({ preparedAt: new Date().toISOString(), processing: "Only crop, resize and JPEG quality 78. Original product geometry, appearance and colour are not retouched.", files }, null, 2));
console.log(JSON.stringify({ photos: sources.length + 1, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), output: out, temporarySources: temporary }));
