import { build } from "rolldown";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const existingDetailAudit = process.argv[2] === "detail-existing";
const infinityWaterlineAudit = process.argv[2] === "infinity-waterline";
const benchLightingAudit = process.argv[2] === "bench-lighting";
const candidateC = process.argv.includes("--candidate-c");
const candidateE = process.argv.includes("--candidate-e");
const candidateF = process.argv.includes("--candidate-f");
const candidateG = process.argv.includes("--candidate-g");
const candidateH = process.argv.includes("--candidate-h");
const candidateI = process.argv.includes("--candidate-i");
const candidateK = process.argv.includes("--candidate-k");
const candidateL = process.argv.includes("--candidate-l");
const candidateM = process.argv.includes("--candidate-m");
const candidateO = process.argv.includes("--candidate-o");
const candidateQ = process.argv.includes("--candidate-q");
if ([candidateC, candidateE, candidateF, candidateG, candidateH, candidateI, candidateK, candidateL, candidateM, candidateO, candidateQ].filter(Boolean).length > 1) throw new Error("Choose one preserved camera candidate");
const file = join(process.cwd(), `node_modules/.cache/${existingDetailAudit ? "detail-camera-existing" : infinityWaterlineAudit ? "infinity-waterline-regression" : benchLightingAudit ? "bench-lighting-regression" : "premium-camera-regression"}${candidateC ? "-candidate-c" : candidateE ? "-candidate-e" : candidateF ? "-candidate-f" : candidateG ? "-candidate-g" : candidateH ? "-candidate-h" : candidateI ? "-candidate-i" : candidateK ? "-candidate-k" : candidateL ? "-candidate-l" : candidateM ? "-candidate-m" : candidateO ? "-candidate-o" : candidateQ ? "-candidate-q" : process.argv.includes("--scene-j") ? "-scene-j" : ""}.mjs`);
await build({
  input: existingDetailAudit ? "scripts/detail-camera-audit.ts" : infinityWaterlineAudit ? "scripts/infinity-waterline-regression.ts" : benchLightingAudit ? "scripts/bench-lighting-regression.ts" : "scripts/premium-camera-regression.ts",
  output: { file, format: "esm" },
  platform: "node",
  plugins: [{
    name: "offline-camera-loader",
    resolveId(id) { if (id === "@/lib/project-delivery/projectDelivery.server") return "\0offline-camera-loader"; },
    load(id) {
      if (candidateQ && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-q-before-r-20261015.ts"), "utf8");
      if (candidateO && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-o-before-q-20261015.ts"), "utf8");
      if (candidateM && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-m-before-o-20261015.ts"), "utf8");
      if (candidateL && id === join(process.cwd(), "src/components/pool/three/architecturalPlan.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/architectural-plan-l-before-m-20261015.ts"), "utf8");
      if (candidateK && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-k-before-l-20261015.ts"), "utf8");
      if (candidateK && id === join(process.cwd(), "src/lib/pool/contextual-camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/contextual-camera-k-before-l-20261015.ts"), "utf8");
      if (candidateC && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-c-before-d-20261015.ts"), "utf8");
      if (candidateE && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-e-before-f-20261015.ts"), "utf8");
      if (candidateF && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-f-before-g-20261015.ts"), "utf8");
      if (candidateG && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-g-before-h-20261015.ts"), "utf8");
      if (candidateH && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-h-before-i-20261015.ts"), "utf8");
      if (candidateI && id === join(process.cwd(), "src/lib/pool/camera.ts"))
        return readFileSync(join(process.cwd(), "docs/fullscreen-qa-evidence/premium-live-cameras/camera-i-before-j-20261015.ts"), "utf8");
      if (id === "\0offline-camera-loader") return 'export async function loadSharedProjectFn(){throw new Error("Cloud access is outside this camera regression");}';
    },
  }],
  external: ["react", "react/jsx-runtime", "three", "three/*", "typescript", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
await import(pathToFileURL(file).href);
