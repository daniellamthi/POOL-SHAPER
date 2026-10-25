import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";

// Offline regression only: no delivery service, cloud writes, email or browser
// draft access. Uses the real canonical normaliser, summary and PDF generator.
const destination = process.argv[2];
assert(destination, "Pass an explicit local output directory");
const output = resolve("node_modules/.cache/bench-pdf-audit.mjs");
await build({
  input: "bench-pdf-api",
  output: { file: output, format: "esm" },
  platform: "node",
  resolve: { alias: { "@": resolve("src") } },
  external: ["react", "react/jsx-runtime", "jspdf", "qrcode"],
  plugins: [
    {
      name: "bench-pdf-api",
      resolveId(id) {
        if (id === "bench-pdf-api") return id;
      },
      load(id) {
        if (id !== "bench-pdf-api") return null;
        return `export { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS, DEFAULT_CUSTOMER } from "@/lib/pool/config";
        export { DEFAULT_MOSAIC_FINISH_ID } from "@/configurator/materials/interior-textures";
        export { createProjectId, toProjectConfiguration, parseProjectConfiguration, serializeProjectConfiguration } from "@/lib/pool/project";
        export { buildProjectSummary } from "@/lib/project-delivery/summary-model";
        export { buildProjectBook } from "@/lib/project-delivery/projectBook";`;
      },
    },
  ],
});
const api = await import(pathToFileURL(output));
const config = {
  projectType: "new",
  poolType: "in-ground",
  structure: "reinforced-concrete",
  shape: "rectangle",
  shapeSelected: true,
  customMode: "draw",
  controlPoints: api.DEFAULT_CONTROL_POINTS,
  system: "overflow",
  overflowType: "continuous",
  skimmerType: "slim",
  skimmerFinish: "white",
  finish: "liner",
  linerColor: "motionSandBeach179",
  mosaicFinish: api.DEFAULT_MOSAIC_FINISH_ID,
  copingMaterial: "travertine",
  equipment: [],
  customer: api.DEFAULT_CUSTOMER,
  uploads: [],
  ledColor: "#ffffff",
  ledIntensity: 0.26,
  copingStyle: "flush",
  copingEdge: "rounded",
  paving: "gres",
  pavingFormat: "60x120",
  dimensions: { ...api.DEFAULT_DIMENSIONS, length: 10, width: 4.5, depth: 1.5, sunShelfRun: 3.4 },
  features: ["sunShelf", "integratedBench", "sunShelfLoungers", "ledLighting", "stairLighting"],
  integratedBenchStations: 4,
  sunShelfLoungerCount: 3,
  sunShelfLoungerColor: "white",
  poolAccess: "internalSteps",
  internalStairType: "linear",
  sceneTime: "night",
};
const project = api.parseProjectConfiguration(
  api.serializeProjectConfiguration(
    api.toProjectConfiguration(api.createProjectId(), config, {
      areas: [],
      currentFinish: "liner",
      filtrationWorks: [],
      replaceCoping: null,
      copingMaterial: "",
      structureIssues: [],
      equipmentUpgrades: [],
    }),
  ),
);
const before = api.serializeProjectConfiguration(project);
await mkdir(destination, { recursive: true });
const receipt = [];
for (const locale of ["it", "en"]) {
  const model = api.buildProjectSummary(project, locale);
  assert.equal(model.compatibilityIssues.length, 0, `${locale}: no false compatible fixture`);
  const rows = JSON.stringify(model.sections);
  assert.match(
    rows,
    locale === "it"
      ? /Panca integrata · 4 postazioni · 16 bocchette/
      : /Integrated bench · 4 seats · 16 jets/,
  );
  assert.match(rows, /10 cm/);
  const pdf = await api.buildProjectBook({
    model,
    locale,
    publicRef: "QA-OFFLINE",
    // Deliberately non-live: this fixture is never represented as a saved project.
    shareUrl: "https://example.invalid/offline-qa",
    issuedAt: new Date("2026-10-24T12:00:00Z"),
  });
  const bytes = Buffer.from(pdf.output("arraybuffer"));
  assert(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
  const pageHeight = pdf.internal.pageSize.getHeight() * pdf.internal.scaleFactor;
  let anchors = 0;
  for (const [page, commands] of pdf.internal.pages.entries()) {
    if (!commands) continue;
    for (const command of commands) {
      // First Td anchors the text object; subsequent Td values are relative
      // offsets used by jsPDF for multiline right-aligned text.
      const match = command.match(/(?:^|\n)(-?[\d.]+) (-?[\d.]+) Td(?:\n|$)/);
      if (match) {
        anchors++;
        assert(
          Number(match[2]) >= 12 && Number(match[2]) <= pageHeight,
          `${locale}: page ${page} text anchor must stay inside the sheet`,
        );
      }
    }
  }
  assert(anchors > 30, "Text-position guard must inspect actual PDF commands");
  const file = resolve(destination, `bench-offline-${locale}.pdf`);
  await writeFile(file, bytes);
  receipt.push({
    locale,
    file,
    bytes: bytes.length,
    pages: pdf.getNumberOfPages(),
    textAnchors: anchors,
  });
}
assert.equal(
  api.serializeProjectConfiguration(project),
  before,
  "PDF does not mutate canonical selections",
);
console.log(
  JSON.stringify(
    {
      status: "PASS",
      scope: "offline canonical active-bench PDF; no captured 3D images or live export claim",
      receipt,
    },
    null,
    2,
  ),
);
