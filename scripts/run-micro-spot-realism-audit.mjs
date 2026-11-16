import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const file = join(process.cwd(), "node_modules/.cache/micro-spot-realism-audit.mjs");
await build({
  input: "scripts/micro-spot-realism-audit.ts",
  platform: "node",
  output: { file, format: "esm" },
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
await import(pathToFileURL(file).href);
