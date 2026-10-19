import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
// Owner-supplied product photographs. Crop/resize only; no synthetic furniture,
// background generation or material recolouring. Originals remain untouched.
const directory =
  process.argv[2] ??
  "/Users/danielelamthi/Downloads/FOTO PISCINE WELLNESS/foto/foto sito/Arredi e relax/ARREDI & CHAISE LONGUE/Lympha";
const temporary = mkdtempSync(join(tmpdir(), "lympha-photo-"));
for (const [id, name, x, y, w, h] of [
  ["immersed", "LT302-0001M1+AQM_cmyk copia.jpg", 350, 650, 2150, 1550],
  ["deck", "Firefly_elimina dietri i vasi e le piante 17697.png", 340, 450, 2100, 1150],
]) {
  const source = join(directory, name),
    crop = join(temporary, `${id}.jpg`),
    output = `public/product-previews/lympha-${id}.jpg`;
  execFileSync(
    "sips",
    [
      "--cropOffset",
      String(y),
      String(x),
      "--cropToHeightWidth",
      String(h),
      String(w),
      source,
      "--out",
      crop,
    ],
    { stdio: "pipe" },
  );
  execFileSync(
    "sips",
    [
      "--resampleWidth",
      "640",
      "--matchTo",
      "/System/Library/ColorSync/Profiles/sRGB Profile.icc",
      "--setProperty",
      "format",
      "jpeg",
      "--setProperty",
      "formatOptions",
      "82",
      crop,
      "--out",
      output,
    ],
    { stdio: "pipe" },
  );
  const bytes = readFileSync(output);
  console.log(
    JSON.stringify({
      output,
      bytes: bytes.length,
      originalSHA256: createHash("sha256").update(readFileSync(source)).digest("hex"),
      preparedSHA256: createHash("sha256").update(bytes).digest("hex"),
    }),
  );
}
