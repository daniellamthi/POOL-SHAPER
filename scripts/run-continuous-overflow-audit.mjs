import { build } from "rolldown";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const file = join(process.cwd(), "node_modules/.cache/continuous-overflow-audit.mjs");
await build({ input: "scripts/continuous-overflow-audit.ts", output: { file, format: "esm" }, platform: "node",
  external: ["react", "react/jsx-runtime", "three", "three/*", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
  plugins: [{ name: "no-cloud-during-local-audit",
    resolveId(id) { if (id === "@/lib/project-delivery/projectDelivery.server") return "\0no-cloud"; },
    load(id) { if (id === "\0no-cloud") return 'export async function loadSharedProjectFn(){throw new Error("Cloud calls forbidden in local audit");}'; },
  }],
});
await import(`${pathToFileURL(file).href}?audit=${Date.now()}`);
