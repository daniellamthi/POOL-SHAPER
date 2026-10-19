import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const source = process.argv[2] ?? "/Users/danielelamthi/.codex/attachments/2a5e5a21-bf0e-45e8-89bd-8fc1d4c9e22d";
const destination = join(process.cwd(), "public/textures/references/20261018");
await mkdir(destination, { recursive: true });
const sha256 = data => createHash("sha256").update(data).digest("hex");
const images = [];
for (let image = 1; image <= 8; image++) {
  const file = `image-${image}.jpeg`;
  const input = await readFile(join(source, file));
  let output;
  try { output = await readFile(join(destination, file)); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (output && sha256(output) !== sha256(input)) throw new Error(`Refusing to overwrite a different existing asset: ${file}`);
  if (!output) await copyFile(join(source, file), join(destination, file));
  images.push({ file, bytes: input.length, sha256: sha256(input), sourceImage: image,
    processing: "None: original JPEG copied byte-for-byte; safe sampling coordinates live in reference-finishes.ts" });
}
const manifest = {
  source: "Eight original photographs attached by the project owner on 2026-10-18",
  rights: "Supplied by owner for POOL-SHAPER. This records provenance, not an independently verified third-party licence or redistribution permission.",
  materialStatus: "Photographic colour references only. No measured albedo, normal, roughness, AO or height data supplied.",
  dimensionStatus: "Metric mapping and existing visualization board/slab dimensions are not certified commercial supplier formats.",
  images,
};
await writeFile(join(destination, "provenance.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ assets: images.length, totalBytes: images.reduce((sum, image) => sum + image.bytes, 0), originalBytesPreserved: true }));
