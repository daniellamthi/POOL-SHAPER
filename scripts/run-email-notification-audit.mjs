import fs from "node:fs";
import { build } from "rolldown";
import { pathToFileURL } from "node:url";
const directory=fs.mkdtempSync('/private/tmp/pool-email-audit-');
const file=directory+'/audit.mjs';
await build({input:'scripts/email-notification-audit.ts',platform:'node',output:{file,format:'esm',codeSplitting:false}});
await import(pathToFileURL(file).href);
