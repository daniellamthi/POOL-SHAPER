import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as catalog from "../src/lib/pool/config";
import { DEFAULT_CONTROL_POINTS, DEFAULT_CUSTOMER, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { PAVING, PREMIUM_ENVIRONMENTS } from "../src/lib/pool/presentation";
import { COPING_MATERIALS } from "../src/lib/pool/coping-materials";
import { EXTERIOR_PANEL_FINISHES } from "../src/lib/pool/above-ground";
import { messages } from "../src/lib/i18n/messages";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import { toProjectConfiguration, serializeProjectConfiguration } from "../src/lib/pool/project";
import { projectSnapshotFingerprint } from "../src/lib/project-delivery/client";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { buildProjectBook } from "../src/lib/project-delivery/projectBook";
import { translateText, formatNumber, formatNumericText } from "../src/lib/i18n";
import type { PoolConfig } from "../src/lib/pool/types";

assert.equal(translateText("Forma e dimensioni", "en"), "Shape and dimensions");
assert.equal(translateText("Shape and dimensions", "it"), "Forma e dimensioni");
assert.equal(translateText("Lettini per spiaggetta", "en"), "Sun shelf loungers");
assert.equal(translateText("Un lato senza bordo: l’acqua scompare verso il panorama.", "en"), "An edgeless side: the water disappears into the landscape.");
assert.equal(translateText("vasca asciutta", "en"), "dry pool");
assert.equal(translateText("Rivestimento · vasca asciutta", "en"), "Lining · dry pool");
assert.equal(translateText("Travertino", "en"), "Travertine");
assert.equal(translateText("Lunghezza", "en"), "Length");
assert.equal(translateText("Larghezza", "en"), "Width");
assert.equal(translateText("Motion Sand Beach 179", "en"), "Motion Sand Beach 179");
assert.equal(translateText("PW-1234-ABCDEF", "en"), "PW-1234-ABCDEF");
assert.equal(translateText("Campione mosaico 12", "en"), "Mosaic sample 12");
assert.equal(translateText("4 fari · 38.5 m²", "en"), "4 lights · 38.5 m²");
assert.equal(translateText("Scala interna integrata — Scala interna rettilinea", "en"), "Integrated internal stairs — Straight internal stairs");
assert.equal(translateText("Rettangolare · 8.00 × 4.00 m · prof. 1.50 m", "en"), "Rectangular · 8.00 × 4.00 m · depth 1.50 m");
assert.equal(translateText("8.00 × 4.00 m", "it"), "8,00 × 4,00 m");
assert.equal(formatNumericText("Motion 1.20 · PW-1234 · 48.0 m³", "it"), "Motion 1.20 · PW-1234 · 48,0 m³");
assert.equal(formatNumber(1234.5, "it", { minimumFractionDigits: 2 }), "1234,50");
assert.equal(formatNumber(1234.5, "en", { minimumFractionDigits: 2 }), "1234.50");

// Cover values passed as t(option.title/description), not only literal t() calls.
const authoredItalian = new Map(messages);
const authoredEnglish = new Set(messages.map(([, en]) => en));
const properOrNeutral = new Set(["Limestone Ivory", "Pietra di Prun", "WPC", "Outdoor Villa", "Indoor Wellness", "Chaise longue"]);
const englishCatalogueCopy = new Set([
  "Large-format porcelain stoneware in a warm greige concrete-effect matte finish, grout-free across the coping run.",
  "Natural slate with mineral cleavage layering, quartz veining and a matte, non-reflective surface.",
  "Wood-plastic composite decking",
  "Wood-plastic composite decking: a clean, uniform board grain, more controlled than real wood.",
]);
function assertCustomerCopy(source: string) {
  if (properOrNeutral.has(source) || /^Motion /.test(source) || englishCatalogueCopy.has(source)) return;
  assert.ok(authoredItalian.has(source) || authoredEnglish.has(source), `Missing authored catalogue/tray copy: ${source}`);
  const expected = authoredItalian.get(source);
  if (expected && expected !== source) assert.notEqual(translateText(source, "en"), source, `Italian copy remains visible: ${source}`);
}
let catalogCopyChecks = 0;
for (const entries of [catalog.PROJECT_TYPES, catalog.POOL_TYPES, catalog.POOL_STRUCTURES, catalog.CUSTOMER_STRUCTURES,
  catalog.POOL_SHAPES, catalog.POOL_FEATURES, catalog.EQUIPMENT, catalog.FINISHES, catalog.LINER_COLORS,
  catalog.SKIMMER_TYPES, catalog.SKIMMER_FINISHES, PAVING, COPING_MATERIALS, EXTERIOR_PANEL_FINISHES, PREMIUM_ENVIRONMENTS]) {
  for (const item of entries) for (const field of ["title", "description", "subtitle", "label", "note"] as const) {
    const source = (item as unknown as Record<string, unknown>)[field];
    if (typeof source === "string") { assertCustomerCopy(source); catalogCopyChecks++; }
  }
}
const ts = createRequire(`${process.cwd()}/package.json`)("typescript") as typeof import("typescript");
const trayFile = ts.createSourceFile("StepTrays.tsx", readFileSync("src/components/pool/wizard/StepTrays.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const trayCopy = new Set<string>();
function collectTrayCopy(node: import("typescript").Node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
    const source = node.text.replace(/\s+/g, " ").trim();
    if (source && /[A-Za-zÀ-ÿ]/.test(source) && (source.includes(" ") || /[àèéìòù’]/.test(source)) &&
      !/^[@/#]|^data:|\.\./.test(source) && !/^M\d/.test(source) &&
      !/(?:^|\s)(?:flex|grid|gap-|text-|bg-|border|rounded|absolute|relative|font-|w-|h-|size-|px-|py-|mt-|col-|items-|justify-|min-|max-|inset-|animate-|hidden|block|aspect-|overflow|stroke-)|<|>/.test(source)) trayCopy.add(source);
  }
  ts.forEachChild(node, collectTrayCopy);
}
collectTrayCopy(trayFile);
for (const source of trayCopy) assertCustomerCopy(source);

const base: PoolConfig = {
  projectType: "new", poolType: "in-ground", structure: "reinforced-concrete", shapeSelected: true,
  shape: "rectangle", customMode: "draw", controlPoints: DEFAULT_CONTROL_POINTS,
  dimensions: { ...DEFAULT_DIMENSIONS, length: 12, width: 5.2, depth: 1.5 },
  system: "skimmer", overflowType: "hidden", skimmerFinish: "white", skimmerType: "slim",
  finish: "liner", linerColor: "motionBlueSky602", mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
  copingMaterial: "travertine", ledColor: "#ffffff", ledIntensity: 0.6, sceneTime: "day",
  poolAccess: null, internalStairType: "linear", customer: DEFAULT_CUSTOMER, uploads: [],
  features: ["sunShelf", "sunShelfLoungers", "ledLighting"], sunShelfLoungerCount: 1,
  equipment: ["heatPump", "solarShower"],
};
const variants = [base,
  { ...base, shape: "l-shape", features: [], dimensions: { ...base.dimensions, lShapeRecessLength: 4, lShapeRecessWidth: 2 } },
  { ...base, system: "infinity", features: [] },
  { ...base, poolType: "above-ground", structure: "modular-steel-panels", features: [], poolAccess: "internalSteps", internalStairType: "corner" },
  { ...base, projectType: "renovation", features: [], system: "overflow", overflowType: "hidden" },
] satisfies PoolConfig[];
let pdfs = 0;
for (const config of variants) {
  const renovation = { areas: ["interiorFinish", "coping"] as const, currentFinish: "liner" as const,
    filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [],
    existing: { poolType: "in-ground" as const, structure: "reinforced-concrete" as const, system: "skimmer" as const, finish: "liner" as const } };
  const project = toProjectConfiguration("11111111-1111-4111-8111-111111111111", config, renovation);
  const snapshot = serializeProjectConfiguration(project);
  const fingerprint = projectSnapshotFingerprint(project);
  for (const locale of ["it", "en"] as const) {
    const summary = buildProjectSummary(project, locale);
    const text = [summary.headline, summary.subline, ...summary.sections.flatMap(section =>
      [section.title, ...section.rows.flatMap(row => [row.label, row.value, row.hint ?? ""])]),
      ...summary.technical.flatMap(row => [row.label, row.value, row.hint ?? ""]), ...summary.deferred].join("\n");
    if (locale === "en") assert.doesNotMatch(text, /\b(?:piscina|rivestimento|rettilinea|rientro|profondità|indicativo|posizionati|disposizione|consulente|calcolato|proposto|esistente|conservato)\b/i);
    const pdf = await buildProjectBook({ model: summary, locale, publicRef: "PW-1234-ABCDEF",
      shareUrl: "https://example.com/?p=PW-1234-ABCDEF", issuedAt: new Date("2026-10-15T12:00:00Z") });
    const body = pdf.output();
    assert.ok(body.includes(locale === "en" ? "The project" : "Il progetto"));
    assert.ok(body.includes(locale === "en" ? "Materials and finishes" : "Materiali e finiture"));
    assert.ok(body.includes(locale === "en" ? "15 October 2026" : "15 ottobre 2026"));
    if (locale === "en") assert.ok(!body.includes("Il tuo progetto, sempre con te"));
    assert.equal(serializeProjectConfiguration(project), snapshot, "locale must not modify the technical snapshot");
    assert.equal(projectSnapshotFingerprint(project), fingerprint, "locale must not make a saved project dirty");
    pdfs++;
  }
}
console.log(JSON.stringify({ status: "PASS", catalogCopyChecks, trayCopyChecks: trayCopy.size, variants: variants.length, localizedPdfs: pdfs, snapshotUnchanged: true, fingerprintUnchanged: true }));
