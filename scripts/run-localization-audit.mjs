import { build } from "rolldown";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const file = resolve("node_modules/.cache/localization-audit.mjs");
await build({
  input: "scripts/localization-audit.ts",
  output: { file, format: "esm", codeSplitting: false },
  platform: "node",
  resolve: { alias: { "@": resolve("src") } },
  external: ["react", "react/jsx-runtime", "three"],
});
await import(pathToFileURL(file).href);
