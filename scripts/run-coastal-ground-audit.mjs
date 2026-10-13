import { build } from "rolldown";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
const file = join(tmpdir(), `pool-shaper-coastal-ground-audit-${process.pid}.mjs`);
await build({
  input: "scripts/coastal-ground-audit.ts",
  output: { file, format: "esm" },
  platform: "node",
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
await import(pathToFileURL(file).href);
