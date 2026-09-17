import {
  createProjectId,
  parseProjectConfiguration,
  PROJECT_SCHEMA_VERSION,
  serializeProjectConfiguration,
  toProjectConfiguration,
  type ProjectConfiguration,
} from "../src/lib/pool/project";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { PoolConfig, RenovationConfig } from "../src/lib/pool/types";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const fullConfig: PoolConfig = {
  projectType: "new",
  poolType: "in-ground",
  structure: "reinforced-concrete",
  shape: "custom",
  shapeSelected: true,
  copingMaterial: "prun",
  customMode: "draw",
  controlPoints: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ],
  dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0.1 },
  system: "overflow",
  overflowType: "visible",
  skimmerFinish: "steel",
  skimmerType: "flush",
  finish: "mosaic",
  linerColor: "motionGreyRock798",
  mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
  features: ["ledLighting", "hydromassage", "externalStaircase"],
  ledColor: "#3fa8ff",
  poolAccess: "stainlessSteelLadder",
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

// 1. A full configuration can be serialized.
const projectId = createProjectId();
assert(
  typeof projectId === "string" && projectId.length > 0,
  "createProjectId must return a non-empty id",
);

const project = toProjectConfiguration(projectId, fullConfig, fullRenovation);
assert(
  project.schemaVersion === PROJECT_SCHEMA_VERSION,
  "schemaVersion must be stamped on the project",
);
const json = serializeProjectConfiguration(project);
assert(typeof json === "string" && json.length > 0, "serialization must produce a JSON string");

// 2 & 3. Serialization retains every important selection; round trip preserves values.
const roundTripped: ProjectConfiguration = parseProjectConfiguration(json);
assert(roundTripped.projectId === projectId, "projectId must survive the round trip");
assert(
  roundTripped.schemaVersion === PROJECT_SCHEMA_VERSION,
  "schemaVersion must survive the round trip",
);
assert(
  JSON.stringify(roundTripped.config) === JSON.stringify(fullConfig),
  "config must be byte-for-byte identical after round trip",
);
assert(
  JSON.stringify(roundTripped.renovation) === JSON.stringify(fullRenovation),
  "renovation must be byte-for-byte identical after round trip",
);

// 4. Hidden/Visible Overflow survives.
assert(roundTripped.config.system === "overflow", "system must survive");
assert(roundTripped.config.overflowType === "visible", "visible overflow must survive");
const hiddenOverflowProject = toProjectConfiguration(
  createProjectId(),
  { ...fullConfig, overflowType: "hidden" },
  fullRenovation,
);
const hiddenRoundTrip = parseProjectConfiguration(
  serializeProjectConfiguration(hiddenOverflowProject),
);
assert(hiddenRoundTrip.config.overflowType === "hidden", "hidden overflow must survive");

// 5. Coping material survives.
assert(roundTripped.config.copingMaterial === "prun", "coping material id must survive");

// 6. Interior finish survives.
assert(roundTripped.config.finish === "mosaic", "finish material must survive");
assert(
  roundTripped.config.mosaicFinish === DEFAULT_MOSAIC_FINISH_ID,
  "mosaic finish id must survive",
);
const linerProject = toProjectConfiguration(
  createProjectId(),
  { ...fullConfig, finish: "liner", linerColor: "motionBlackStone799" },
  fullRenovation,
);
const linerRoundTrip = parseProjectConfiguration(serializeProjectConfiguration(linerProject));
assert(linerRoundTrip.config.finish === "liner", "liner finish must survive");
assert(linerRoundTrip.config.linerColor === "motionBlackStone799", "liner colour must survive");

// 7. Pool Access survives.
assert(roundTripped.config.poolAccess === "stainlessSteelLadder", "pool access must survive");

// 8. RGB LED colour survives.
assert(roundTripped.config.ledColor === "#3fa8ff", "LED RGB colour must survive");
assert(roundTripped.config.features.includes("ledLighting"), "LED feature flag must survive");

// 9. Renovation-specific data survives where applicable.
assert(
  roundTripped.renovation.areas.length === fullRenovation.areas.length &&
    fullRenovation.areas.every((area) => roundTripped.renovation.areas.includes(area)),
  "renovation areas must survive",
);
assert(roundTripped.renovation.replaceCoping === true, "renovation replaceCoping must survive");
assert(
  roundTripped.renovation.copingMaterial === fullRenovation.copingMaterial,
  "renovation coping material free-text must survive",
);
assert(
  roundTripped.renovation.structureIssues.includes("leakage") &&
    roundTripped.renovation.structureIssues.includes("crack"),
  "renovation structure issues must survive",
);

// Malformed / mismatched-schema input must be rejected, not silently accepted.
let rejectedMissingField = false;
try {
  parseProjectConfiguration(
    JSON.stringify({ schemaVersion: PROJECT_SCHEMA_VERSION, projectId: "x" }),
  );
} catch {
  rejectedMissingField = true;
}
assert(
  rejectedMissingField,
  "parseProjectConfiguration must reject a project missing config/renovation",
);

let rejectedBadVersion = false;
try {
  parseProjectConfiguration(
    JSON.stringify({
      schemaVersion: 999,
      projectId: "x",
      config: fullConfig,
      renovation: fullRenovation,
    }),
  );
} catch {
  rejectedBadVersion = true;
}
assert(rejectedBadVersion, "parseProjectConfiguration must reject an unknown schemaVersion");

console.log(
  "Project configuration audit passed: full round trip, overflow/coping/finish/access/LED/renovation fields all verified.",
);
