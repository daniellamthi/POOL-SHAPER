import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const file = join(process.cwd(), "node_modules/.cache/paving-layout-audit.mjs");
await build({ input: "scripts/paving-layout-audit.ts", output: { file, format: "esm" }, platform: "node",
  plugins: [{ name: "isolate-unused-browser-rpc", resolveId(id) {
    if (id.endsWith("/projectDelivery.server")) return "\0unused-project-rpc";
  }, load(id) {
    if (id === "\0unused-project-rpc") return "export const loadSharedProjectFn = () => { throw new Error('Unexpected network RPC in paving unit test'); };";
  } }],
  external: ["react", "react/jsx-runtime", "three", "three/*", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } } });
await import(pathToFileURL(file).href);
