import fs from "node:fs";
import { parseEnv } from "node:util";
import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
Object.assign(process.env, parseEnv(fs.readFileSync(".env.local", "utf8")));
if (process.env.SUPABASE_URL !== "https://waetxxqdlsuanqescuye.supabase.co") throw new Error("Wrong POOL-SHAPER backend target");
const dir = fs.mkdtempSync("/private/tmp/pool-renovation-cloud-");
const file = join(dir, "audit.mjs");
await build({ input: "scripts/renovation-cloud.ts", platform: "node",
  resolve: { alias: { "@": join(process.cwd(), "src") } }, output: { file, format: "esm", codeSplitting: false } });
await import(pathToFileURL(file).href);
