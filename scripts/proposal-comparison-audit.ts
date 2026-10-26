import assert from "node:assert/strict";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { PoolConfig, RenovationConfig } from "../src/lib/pool/types";
import { toProjectConfiguration, parseProjectConfiguration } from "../src/lib/pool/project";
import {
  applyProposal,
  comparisonRows,
  designFingerprint,
  designSnapshot,
  emptyBoard,
  parseBoard,
} from "../src/lib/pool/proposal-comparison";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
const fullConfig: PoolConfig = {
  projectType: "new",
  poolType: "in-ground",
  structure: "reinforced-concrete",
  shape: "custom",
  shapeSelected: true,
  copingMaterial: "prun",
  paving: "prun",
  pavingFormat: "50x50",
  customMode: "draw",
  controlPoints: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ],
  dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0.1, floorProfile: "flat" },
  system: "overflow",
  overflowType: "visible",
  skimmerFinish: "steel",
  skimmerType: "flush",
  finish: "mosaic",
  linerColor: "motionGreyRock798",
  mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
  features: ["ledLighting", "hydromassage"],
  ledColor: "#3fa8ff",
  ledIntensity: 0.75,
  poolAccess: "stainlessSteelLadder",
  internalStairType: "corner",
  equipment: ["heatPump", "saltElectrolysis"],
  customer: {
    name: "Ada",
    surname: "Lovelace",
    company: "Analytical Engines Ltd",
    email: "ada@example.com",
    phone: "+44 20 7946 0000",
    city: "London",
    country: "United Kingdom",
    notes: "Prefers a quiet consultation slot.",
  },
  uploads: [
    {
      id: "u1",
      name: "site-photo.jpg",
      size: 204800,
      type: "image/jpeg",
      url: null,
      category: "site",
    },
  ],
};

const fullRenovation: RenovationConfig = {
  areas: ["interiorFinish", "coping", "structure"],
  currentFinish: "liner",
  filtrationWorks: ["pump", "overflow"],
  replaceCoping: true,
  copingMaterial: "Travertine, warm tone",
  structureIssues: ["leakage", "crack"],
  equipmentUpgrades: ["heatPump"],
};

const original = toProjectConfiguration("comparison-fixture", fullConfig, fullRenovation);
const originalJson = JSON.stringify(original);
const snapshot = designSnapshot(original);
assert.equal(snapshot.config.customer.email, "");
assert.deepEqual(snapshot.config.uploads, []);
snapshot.config.dimensions.length = 9;
assert.equal(original.config.dimensions.length, 8);
const normalized = parseProjectConfiguration(JSON.stringify(original));
assert.equal(designFingerprint(original), designFingerprint(normalized));
assert.equal(
  designFingerprint(original),
  designFingerprint({
    ...original,
    config: {
      ...original.config,
      customer: { ...original.config.customer, email: "new@example.com" },
      uploads: [],
    },
  }),
);
assert.notEqual(designFingerprint(original), designFingerprint(snapshot));
const updated = {
  ...original,
  config: {
    ...original.config,
    customer: { ...original.config.customer, email: "latest@example.com" },
  },
};
const applied = applyProposal(updated, snapshot);
assert.equal(applied.config.dimensions.length, 9);
assert.equal(applied.config.customer.email, "latest@example.com");
assert.strictEqual(applied.config.uploads, updated.config.uploads);
assert.throws(() => applyProposal(original, { ...snapshot, projectId: "other" }));
assert.throws(() =>
  applyProposal(original, {
    ...snapshot,
    config: { ...snapshot.config, projectType: "renovation" },
  }),
);
const proposal = {
  id: "one",
  name: "Travertino",
  project: snapshot,
  preview: null,
  createdAt: new Date().toISOString(),
};
const board = {
  ...emptyBoard(original.projectId),
  proposals: [proposal],
  previous: designSnapshot(original),
};
const roundtrip = parseBoard(JSON.stringify(board), original.projectId);
assert.equal(roundtrip.proposals[0]?.project.config.dimensions.length, 9);
assert.equal(roundtrip.previous?.config.dimensions.length, 8);
assert.equal(roundtrip.proposals[0]?.project.config.customer.email, "");
assert.deepEqual(roundtrip.proposals[0]?.project.config.uploads, []);
assert.equal(JSON.stringify(original), originalJson);
for (const malformed of [
  "{",
  JSON.stringify({ ...board, version: 2 }),
  JSON.stringify({ ...board, projectId: "other" }),
  JSON.stringify({ ...board, proposals: [proposal, proposal] }),
  JSON.stringify({
    ...board,
    proposals: [{ ...proposal, preview: "https://untrusted.example/image.jpg" }],
  }),
  JSON.stringify({
    ...board,
    proposals: [{ ...proposal, project: { ...snapshot, projectId: "other" } }],
  }),
  JSON.stringify({
    ...board,
    proposals: [1, 2, 3, 4].map((n) => ({ ...proposal, id: String(n) })),
  }),
])
  assert.throws(() => parseBoard(malformed, original.projectId));
for (const locale of ["it", "en"] as const) {
  const a = buildProjectSummary(original, locale);
  const b = buildProjectSummary(snapshot, locale);
  const rows = comparisonRows([a, b]);
  assert(rows.some((row) => row.different && row.key.startsWith("pool:")));
  assert(rows.some((row) => !row.different && row.key.startsWith("lighting:")));
  assert(comparisonRows([a, a]).every((row) => !row.different));
  assert(rows.every((row) => row.values.length === 2));
  const third = buildProjectSummary(
    {
      ...original,
      config: { ...original.config, ledType: "perimeter", ledPerimeterSides: [0, 2] },
    },
    locale,
  );
  assert(
    comparisonRows([a, b, third]).some((row) => row.different && row.key.startsWith("lighting:")),
  );
}
const restored = applyProposal(applied, roundtrip.previous!);
assert.equal(restored.config.dimensions.length, 8);
assert.equal(restored.config.customer.email, "latest@example.com");
console.log(
  "Proposal comparison PASS: isolation, normalization, immutable snapshots, contacts/attachments preserved, restore, malformed storage rejection, IT/EN and 2/3-column differences.",
);

const repeated = buildProjectSummary(original, "it");
const repeatedA = {
  ...repeated,
  sections: [
    {
      id: "comfort" as const,
      title: "Comfort",
      stepId: "access",
      rows: [
        { label: "Incluso", value: "Scala" },
        { label: "Incluso", value: "Panca" },
      ],
    },
  ],
};
const repeatedB = {
  ...repeatedA,
  sections: [
    {
      ...repeatedA.sections[0]!,
      rows: [
        { label: "Incluso", value: "Sun Shelf" },
        { label: "Incluso", value: "Panca" },
      ],
    },
  ],
};
const repeatedRows = comparisonRows([repeatedA, repeatedB]);
assert(repeatedRows[0]?.different, "Repeated labels must not overwrite earlier options");
assert(repeatedRows[0]?.values[0]?.includes("Scala"));
assert(repeatedRows[0]?.values[0]?.includes("Panca"));
const reordered = {
  ...repeatedA,
  sections: [{ ...repeatedA.sections[0]!, rows: [...repeatedA.sections[0]!.rows].reverse() }],
};
assert(
  !comparisonRows([repeatedA, reordered])[0]?.different,
  "Equivalent feature ordering is not a difference",
);
console.log(
  "Repeated comfort/equipment labels PASS: no lost choices, order-independent comparison.",
);
