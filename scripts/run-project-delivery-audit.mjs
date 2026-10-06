import { build } from "rolldown";
import { pathToFileURL } from "node:url";

const outputFile = "/tmp/pool-configurator-project-delivery-audit.mjs";
await build({
  input: "scripts/project-delivery-audit.ts",
  platform: "node",
  output: { file: outputFile, format: "esm", codeSplitting: false },
});
await import(`${pathToFileURL(outputFile).href}?audit=${Date.now()}`);
