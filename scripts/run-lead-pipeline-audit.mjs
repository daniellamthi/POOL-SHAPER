import { build } from "rolldown";
import { pathToFileURL } from "node:url";

const outputFile = "/tmp/pool-configurator-lead-pipeline-audit.mjs";
await build({
  input: "scripts/lead-pipeline-audit.ts",
  output: { file: outputFile, format: "esm" },
  platform: "node",
});
await import(`${pathToFileURL(outputFile).href}?audit=${Date.now()}`);
