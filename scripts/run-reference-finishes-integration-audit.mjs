import { build } from "rolldown";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const baseline = "b40924f7d1f6e61d79c5f586ec007dc3a33bf2de";
const sources = new Map(["coping", "materials", "project", "presentation"].map(kind => {
  const file = kind === "coping" ? "coping-materials.ts" : "materials.ts";
  const sourceFile = kind === "project" || kind === "presentation" ? `${kind}.ts` : file;
  let source = execFileSync("git", ["show", `${baseline}:src/lib/pool/${sourceFile}`], { encoding: "utf8" });
  if (kind === "presentation") source = source.replace('from "./coping-materials"', 'from "reference-baseline-coping"');
  return [join(process.cwd(), `src/lib/pool/reference-baseline-${kind}.audit.ts`), source];
}));
const output = join(process.cwd(), "node_modules/.cache/reference-finishes-integration-audit.mjs");
await build({ input: "scripts/reference-finishes-integration-audit.ts", platform: "node", output: { file: output, format: "esm" },
  external: ["react", "react/jsx-runtime", "three", "three/*", "@react-three/fiber", "@react-three/drei", "jspdf", "qrcode", "zod"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
  plugins: [{ name: "approved-materials-and-no-browser-rpc", resolveId(id) {
    if (["coping", "materials", "project", "presentation"].some(kind => id === `reference-baseline-${kind}`))
      return join(process.cwd(), `src/lib/pool/${id}.audit.ts`);
    if (id.endsWith("/projectDelivery.server")) return "\0no-cloud-rpc";
  }, load(id) {
    if (sources.has(id)) return sources.get(id);
    if (id === "\0no-cloud-rpc") return "export const loadSharedProjectFn = () => { throw new Error('Cloud RPC forbidden in local material contract tests'); };";
  } }],
});
await import(pathToFileURL(output).href);
