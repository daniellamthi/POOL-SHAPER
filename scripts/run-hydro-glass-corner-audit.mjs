import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const file = join(process.cwd(), "node_modules/.cache/hydro-glass-corner-audit.mjs");
await build({
  input: "scripts/hydro-glass-corner-audit.ts",
  output: { file, format: "esm" },
  platform: "node",
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
await import(pathToFileURL(file).href);
