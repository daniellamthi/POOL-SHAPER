import { build } from "rolldown";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
const file = join(tmpdir(), `pool-shaper-above-ground-audit-${process.pid}.mjs`);
await build({
  input: "scripts/above-ground-audit.ts",
  output: { file, format: "esm" },
  platform: "node",
  // This reducer/geometry suite never calls the browser's server-function RPC.
  // Isolate that boundary instead of resolving Vite-only TanStack virtual entries.
  plugins: [{ name: "isolate-unused-browser-rpc", resolveId(id) {
    if (id.endsWith("/projectDelivery.server")) return "\0unused-project-rpc";
  }, load(id) {
    if (id === "\0unused-project-rpc") return "export const loadSharedProjectFn = () => { throw new Error('Unexpected network RPC in above-ground unit test'); };";
  } }],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
await import(pathToFileURL(file).href);
