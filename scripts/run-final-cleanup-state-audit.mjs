import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unlink } from "node:fs/promises";

const file = join(process.cwd(), `.final-cleanup-state-audit-${process.pid}.mjs`);
try {
  await build({
    input: "scripts/final-cleanup-state-audit.ts",
    output: { file, format: "esm" },
    platform: "node",
    // The reducer suite never invokes browser RPC; fail explicitly if that changes.
    plugins: [{ name: "isolate-unused-browser-rpc", resolveId(id) {
      if (id.endsWith("/projectDelivery.server")) return "\0unused-project-rpc";
    }, load(id) {
      if (id === "\0unused-project-rpc") return "export const loadSharedProjectFn = () => { throw new Error('Unexpected network RPC in cleanup state audit'); };";
    } }],
    external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
    resolve: { alias: { "@": join(process.cwd(), "src") } },
  });
  await import(pathToFileURL(file).href);
} finally {
  await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; });
}
