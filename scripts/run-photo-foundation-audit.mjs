import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const file = join(process.cwd(), "node_modules/.cache/photo-foundation-audit.mjs");
await build({ input: "scripts/photo-foundation-audit.ts", output: { file, format: "esm" }, platform: "node",
  external: ["react", "react/jsx-runtime", "three", "three/*", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } } });
await import(pathToFileURL(file).href);
