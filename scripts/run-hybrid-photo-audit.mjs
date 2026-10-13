import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const file=join(process.cwd(),"node_modules/.cache/hybrid-photo-audit.mjs");
await build({input:"scripts/hybrid-photo-audit.ts",output:{file,format:"esm"},platform:"node",external:["three"],resolve:{alias:{"@":join(process.cwd(),"src")}}});
await import(pathToFileURL(file).href);
