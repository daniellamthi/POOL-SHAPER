import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unlink } from "node:fs/promises";

const file = join(process.cwd(), `.parametric-comfort-audit-${process.pid}.mjs`);
try {
  await build({
    input: process.argv[2] === "camera" ? "scripts/parametric-camera-navigation-audit.ts" : "scripts/parametric-comfort-audit.ts",
    output: { file, format: "esm" }, platform: "node",
    external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
    resolve: { alias: { "@": join(process.cwd(), "src") } },
    plugins: [{ name: "no-network-state-audit", resolveId(id) {
      if (id.endsWith("/projectDelivery.server")) return "\0unused-project-rpc";
    }, load(id) {
      if (id === "\0unused-project-rpc") return "export const loadSharedProjectFn = () => { throw new Error('Unexpected RPC in parametric audit'); };";
    } }],
  });
  await import(pathToFileURL(file).href);
} finally { await unlink(file).catch(e => { if (e.code !== "ENOENT") throw e; }); }
