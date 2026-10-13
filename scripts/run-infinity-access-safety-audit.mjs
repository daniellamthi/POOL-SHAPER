import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unlink } from "node:fs/promises";

const file = join(process.cwd(), `.infinity-access-safety-audit-${process.pid}.mjs`);
try {
  await build({
    input: "scripts/infinity-access-safety-audit.ts",
    output: { file, format: "esm" },
    platform: "node",
    external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
    resolve: { alias: { "@": join(process.cwd(), "src") } },
  });
  await import(pathToFileURL(file).href);
} finally {
  await unlink(file).catch((error) => { if (error.code !== "ENOENT") throw error; });
}
