import { build } from "rolldown";
import { pathToFileURL } from "node:url";
const outputFile = "/tmp/pool-site-photo-camera-audit.mjs";
await build({
  input: "scripts/site-photo-camera-audit.ts",
  platform: "node",
  output: { file: outputFile, format: "esm" },
});
await import(`${pathToFileURL(outputFile).href}?audit=${Date.now()}`);
