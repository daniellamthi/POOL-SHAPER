import { build } from "rolldown";
import { pathToFileURL } from "node:url";

const outputFile = "/tmp/pool-configurator-project-config-audit.mjs";
await build({
  input: "scripts/project-config-audit.ts",
  output: { file: outputFile, format: "esm" },
});
await import(`${pathToFileURL(outputFile).href}?audit=${Date.now()}`);
