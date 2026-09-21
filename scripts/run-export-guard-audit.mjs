import { build } from "rolldown";
import { pathToFileURL } from "node:url";

const outputFile = "/tmp/pool-configurator-export-guard-audit.mjs";
await build({
  input: "scripts/export-guard-audit.ts",
  output: { file: outputFile, format: "esm" },
});
await import(`${pathToFileURL(outputFile).href}?audit=${Date.now()}`);
