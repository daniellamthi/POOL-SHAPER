import fs from "node:fs";
import { parseEnv } from "node:util";
import { build } from "rolldown";
import { pathToFileURL } from "node:url";
if (fs.existsSync('.env.local')) Object.assign(process.env, parseEnv(fs.readFileSync('.env.local','utf8')));
const directory=fs.mkdtempSync('/private/tmp/pool-notification-worker-');
const file=directory+'/worker.mjs';
await build({input:'scripts/process-lead-notifications.ts',platform:'node',output:{file,format:'esm',codeSplitting:false}});
await import(pathToFileURL(file).href);
