/** Targeted state/export checks; no browser, renderer, or backend calls. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtureSource = ts.createSourceFile(
  "project-config-audit.ts",
  readFileSync(`${root}scripts/project-config-audit.ts`, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
// Reuse the existing valid project fixture without executing its full audit.
const fixtures = fixtureSource.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => statement.declarationList.declarations)
  .filter((declaration) => ["fullConfig", "fullRenovation"].includes(declaration.name.getText(fixtureSource)))
  .map((declaration) => `export const ${declaration.name.getText(fixtureSource)} = ${declaration.initializer.getText(fixtureSource)};`)
  .join("\n");
const entry = "\0fullscreen-state-review.ts";
const bundle = await rolldown({
  input: entry,
  platform: "node",
  resolve: { alias: { "@": `${root}src` } },
  plugins: [{
    name: "fullscreen-state-fixture",
    resolveId(id) { return id === entry ? entry : null; },
    load(id) {
      if (id !== entry) return null;
      return `
        import { DEFAULT_MOSAIC_FINISH_ID } from ${JSON.stringify(`${root}src/configurator/materials/interior-textures.ts`)};
        export { parseProjectConfiguration, serializeProjectConfiguration, PROJECT_SCHEMA_VERSION } from ${JSON.stringify(`${root}src/lib/pool/project.ts`)};
        export { buildProjectSummary } from ${JSON.stringify(`${root}src/lib/project-delivery/summary-model.ts`)};
        export { focusForAction, nextFocusRequest } from ${JSON.stringify(`${root}src/lib/pool/contextual-camera.ts`)};
        ${fixtures}
      `;
    },
  }],
});

try {
  const generated = await bundle.generate({ format: "esm" });
  const production = await import(`data:text/javascript;base64,${Buffer.from(generated.output[0].code).toString("base64")}`);
  const projectFor = (features, sceneTime = "day") => ({
    schemaVersion: production.PROJECT_SCHEMA_VERSION,
    projectId: "fullscreen-state-test",
    config: { ...production.fullConfig, features, sceneTime },
    renovation: production.fullRenovation,
  });
  const restore = (project) => production.parseProjectConfiguration(production.serializeProjectConfiguration(project));
  const benchRows = (project) => production.buildProjectSummary(project).sections
    .flatMap((section) => section.rows)
    .filter((row) => row.label === "Optional panca");

  const legacy = restore(projectFor(["hydromassage"]));
  assert(!legacy.config.features.includes("hydromassageBenchLighting"), "Legacy hydro projects keep bench LEDs off");
  assert.equal(benchRows(legacy).length, 0);

  const selected = restore(projectFor(["hydromassage", "hydromassageBenchLighting"], "night"));
  assert(selected.config.features.includes("hydromassageBenchLighting"), "Selected bench LEDs survive project restore");
  assert.equal(selected.config.sceneTime, "night");
  assert.equal(benchRows(selected).length, 1, "Bench-only lighting must appear in the summary/PDF model");
  assert.match(benchRows(selected)[0].value, /Micro-spot LED sulla panca idromassaggio/);

  const dormant = restore(projectFor(["hydromassageBenchLighting"]));
  assert(dormant.config.features.includes("hydromassageBenchLighting"), "A dormant option remains selected across restore");
  assert.equal(benchRows(dormant).length, 0, "Without hydromassage, the dormant lighting is absent from active summary/PDF rows");
  const restoredParent = restore({ ...dormant, config: { ...dormant.config, features: [...dormant.config.features, "hydromassage"] } });
  assert.equal(benchRows(restoredParent).length, 1, "Restoring the parent reactivates the retained bench-lighting selection");

  const unlitNight = restore(projectFor([], "night"));
  assert.deepEqual(unlitNight.config.features, [], "Night mode never adds lighting accessories");
  assert.equal(unlitNight.config.sceneTime, "night", "Night remains selectable without LEDs");
  const previousFocus = { focus: "HYDROMASSAGE", revision: 7 };
  const next = production.focusForAction({ type: "setSceneTime", value: "night", preserveCamera: true }, selected.config);
  assert.equal(production.nextFocusRequest(previousFocus, next), previousFocus, "Global day/night changes preserve the camera intent and revision");

  console.log("Fullscreen state: legacy/default-off, bench-only summary/PDF, dormant selection, night mode, and preserved camera intent passed.");
} finally {
  await bundle.close();
}
