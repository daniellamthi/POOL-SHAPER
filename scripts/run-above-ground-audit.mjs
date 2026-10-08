import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const file = join("/private/tmp", `pool-shaper-above-ground-audit-${process.pid}.mjs`);
await build({
  input: "scripts/above-ground-audit.ts",
  output: { file, format: "esm" },
  platform: "node",
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
await import(pathToFileURL(file).href);
