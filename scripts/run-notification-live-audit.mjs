import fs from "node:fs";
import { parseEnv } from "node:util";
import { build } from "rolldown";
import { pathToFileURL } from "node:url";
Object.assign(process.env,parseEnv(fs.readFileSync('.env.local','utf8')));
const directory=fs.mkdtempSync('/private/tmp/pool-notification-live-');
const file=directory+'/audit.mjs';
await build({input:'scripts/notification-live-audit.ts',platform:'node',output:{file,format:'esm',codeSplitting:false}});
await import(pathToFileURL(file).href);
