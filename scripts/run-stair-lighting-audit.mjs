import { build } from "rolldown";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const directory = fs.mkdtempSync("/private/tmp/pool-stair-lighting-audit-");
const file = directory + "/audit.mjs";
await build({ input: "scripts/stair-lighting-audit.ts", platform: "node", output: { file, format: "esm", codeSplitting: false } });
await import(pathToFileURL(file).href);
