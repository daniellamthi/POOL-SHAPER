import { build } from "rolldown";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
const file = join(tmpdir(), `pool-shaper-renovation-audit-${process.pid}.mjs`);
await build({
  input: "scripts/renovation-audit.ts", platform: "node",
  resolve: { alias: { "@": join(process.cwd(), "src") } },
  // Offline reducer audit: the browser-only cloud loader is never invoked here.
  plugins: [{
    name: "offline-project-loader",
    resolveId(id) { if (id === "@/lib/project-delivery/projectDelivery.server") return "\0offline-project-loader"; },
    load(id) { if (id === "\0offline-project-loader") return 'export async function loadSharedProjectFn() { throw new Error("Cloud loader is not part of the offline reducer audit"); }'; },
  }],
  output: { file, format: "esm", codeSplitting: false },
});
await import(pathToFileURL(file).href);
