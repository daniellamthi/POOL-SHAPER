import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unlink } from "node:fs/promises";

const file = join(process.cwd(), `.technical-plan-audit-${process.pid}.mjs`);
await build({
  input: "scripts/technical-plan-audit.ts",
  output: { file, format: "esm" },
  platform: "node",
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
try {
  await import(pathToFileURL(file).href);
} finally {
  await unlink(file);
}
