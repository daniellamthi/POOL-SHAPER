import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unlink } from "node:fs/promises";
const file = join(process.cwd(), `.internal-stair-position-audit-${process.pid}.mjs`);
try {
  await build({ input: "scripts/internal-stair-position-audit.ts", output: { file, format: "esm" }, platform: "node",
    external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
    resolve: { alias: { "@": join(process.cwd(), "src") } },
    plugins: [{ name: "no-network-stair-position-audit", resolveId(id) {
      if (id.endsWith("/projectDelivery.server")) return "\0unused-project-rpc";
    }, load(id) { if (id === "\0unused-project-rpc") return "export const loadSharedProjectFn = () => { throw new Error('Unexpected RPC in stair position audit'); };"; } }],
  });
  await import(pathToFileURL(file).href);
} finally { await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; }); }
