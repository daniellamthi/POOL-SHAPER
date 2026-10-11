import { build } from 'rolldown';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory=await mkdtemp(join(tmpdir(),'pool-backend-security-'));
const outputFile=join(directory,'audit.mjs');
await build({input:'scripts/backend-security-audit.ts',platform:'node',output:{file:outputFile,format:'esm',codeSplitting:false}});
await import(pathToFileURL(outputFile).href);
