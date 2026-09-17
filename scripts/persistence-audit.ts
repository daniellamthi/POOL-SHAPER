/**
 * Proves the P4 autosave/resume contract against the real production
 * code (`src/lib/pool/persistence.ts` + `project.ts`), using a minimal
 * in-memory `localStorage` polyfill -- no browser required.
 */
import {
  createProjectId,
  PROJECT_SCHEMA_VERSION,
  type ProjectConfiguration,
} from "../src/lib/pool/project";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { PoolConfig, RenovationConfig } from "../src/lib/pool/types";
import { saveProjectDraft, loadProjectDraft, clearProjectDraft } from "../src/lib/pool/persistence";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

// --- Minimal localStorage polyfill (Node has no `window`/`localStorage`). ---
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}
const memoryStorage = new MemoryStorage();
// `persistence.ts` checks `typeof window` inside each function body, at
// call time -- so this polyfill just needs to exist before those calls
// run, not before the (statically hoisted) imports above.
(globalThis as unknown as { window: unknown }).window = { localStorage: memoryStorage };

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
    notes: "",
  },
  uploads: [
    {
      id: "u1",
      name: "site-photo.jpg",
      size: 204800,
      type: "image/jpeg",
      url: "blob:should-not-survive",
      category: "site",
    },
  ],
};

const fullRenovation: RenovationConfig = {
  areas: ["interiorFinish", "coping"],
  currentFinish: "liner",
  filtrationWorks: ["pump"],
  replaceCoping: true,
  copingMaterial: "Travertine, warm tone",
  structureIssues: [],
  equipmentUpgrades: ["heatPump"],
};

const projectId = createProjectId();
const project: ProjectConfiguration = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId,
  config: fullConfig,
  renovation: fullRenovation,
};

// --- A. Full canonical project saves/restores. ---
saveProjectDraft(project);
const restored = loadProjectDraft();
assert(restored !== null, "a saved draft must restore");
console.log("PASS — A) full canonical project saves/restores");

// --- B. projectId survives. ---
assert(restored!.projectId === projectId, "projectId must survive");
console.log("PASS — B) projectId survives");

// --- C. schemaVersion survives. ---
assert(restored!.schemaVersion === PROJECT_SCHEMA_VERSION, "schemaVersion must survive");
console.log("PASS — C) schemaVersion survives");

// --- D. Overflow variant survives. ---
assert(
  restored!.config.system === "overflow" && restored!.config.overflowType === "visible",
  "overflow variant must survive",
);
console.log("PASS — D) overflow variant survives");

// --- E. Coping survives. ---
assert(restored!.config.copingMaterial === "prun", "coping must survive");
console.log("PASS — E) coping survives");

// --- F. Liner/mosaic survives. ---
assert(
  restored!.config.finish === "mosaic" &&
    restored!.config.mosaicFinish === DEFAULT_MOSAIC_FINISH_ID,
  "liner/mosaic must survive",
);
console.log("PASS — F) liner/mosaic survives");

// --- G. Pool Access survives. ---
assert(restored!.config.poolAccess === "stainlessSteelLadder", "pool access must survive");
console.log("PASS — G) Pool Access survives");

// --- H. LED RGB survives. ---
assert(restored!.config.ledColor === "#3fa8ff", "LED RGB must survive");
console.log("PASS — H) LED RGB survives");

// --- I. Renovation survives. ---
assert(
  restored!.renovation.areas.includes("interiorFinish") &&
    restored!.renovation.areas.includes("coping") &&
    restored!.renovation.replaceCoping === true &&
    restored!.renovation.copingMaterial === fullRenovation.copingMaterial,
  "renovation data must survive",
);
console.log("PASS — I) renovation survives");

// Sanity: blob URLs are ephemeral and must not be persisted as if valid.
assert(
  restored!.config.uploads[0]?.url === null,
  "stale blob: URLs must be sanitised to null, never persisted as-is",
);
console.log("PASS — upload blob: URL sanitised (metadata kept, dead URL dropped)");

// --- J. Corrupted storage is rejected safely. ---
memoryStorage.setItem("pool-shaper:project-draft:v1", "{not valid json");
assert(loadProjectDraft() === null, "corrupted JSON must be rejected, not crash");
memoryStorage.setItem(
  "pool-shaper:project-draft:v1",
  JSON.stringify({ schemaVersion: 999, projectId: "x", config: {}, renovation: {} }),
);
assert(
  loadProjectDraft() === null,
  "an unsupported schemaVersion must be rejected, not silently accepted",
);
memoryStorage.setItem(
  "pool-shaper:project-draft:v1",
  JSON.stringify({ schemaVersion: PROJECT_SCHEMA_VERSION }),
);
assert(loadProjectDraft() === null, "a partial/incomplete record must be rejected");
console.log("PASS — J) corrupted/incompatible/partial storage all rejected safely (no crash)");

// --- K. Reset creates a new projectId and clears the draft. ---
// (createInitialState()/clearProjectDraft() are exercised together in the
// store; here we prove the persistence half: clearing actually clears.)
saveProjectDraft(project);
assert(loadProjectDraft() !== null, "sanity: draft must exist before clearing");
clearProjectDraft();
assert(loadProjectDraft() === null, "clearProjectDraft must remove the saved draft");
const secondProjectId = createProjectId();
assert(
  secondProjectId !== projectId,
  "a fresh project must get a new projectId, never reuse the old one",
);
console.log("PASS — K) clearing the draft removes it, and a fresh project gets a new projectId");

console.log("Persistence (P4) audit complete.");
