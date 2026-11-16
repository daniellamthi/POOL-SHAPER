import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const file = join(process.cwd(), "node_modules/.cache/reference-finishes-audit.mjs");
await build({ input: "scripts/reference-finishes-audit.ts", output: { file, format: "esm" }, platform: "node",
  external: ["three", "three/*", "react", "react/jsx-runtime", "@react-three/fiber"],
  resolve: { alias: { "@": join(process.cwd(), "src") } } });
await import(pathToFileURL(file).href);
