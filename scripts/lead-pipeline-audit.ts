/**
 * Exercises the P3 lead pipeline directly against its own production code
 * (schema + server function), without going through the 3D wizard or the
 * browser RPC transport -- neither is what this pass needs to prove.
 */
import {
  createProjectId,
  PROJECT_SCHEMA_VERSION,
  type ProjectConfiguration,
} from "../src/lib/pool/project";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { PoolConfig, RenovationConfig } from "../src/lib/pool/types";
import { leadSubmissionInputSchema } from "../src/lib/lead/schema";
import { formatLeadEmail } from "../src/lib/lead/formatLeadEmail";
import type { LeadSubmission } from "../src/lib/lead/types";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const fullConfig: PoolConfig = {
  projectType: "new",
  poolType: "in-ground",
  structure: null, // intentionally null -> should surface as "da definire"
  shape: "rectangle",
  shapeSelected: true,
  copingMaterial: "prun",
  customMode: "draw",
  controlPoints: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ],
  dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0 },
  system: "overflow",
  overflowType: "visible",
  skimmerFinish: "white",
  skimmerType: "standard",
  finish: "liner",
  linerColor: "motionSandBeach179",
  mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
  features: ["ledLighting", "hydromassage"],
  ledColor: "#3fa8ff",
  poolAccess: "internalSteps",
  equipment: ["heatPump"],
  customer: {
    name: "Ada",
    surname: "Lovelace",
    company: "",
    email: "ada@example.com",
    phone: "+44 20 7946 0000",
    city: "London",
    country: "United Kingdom",
    notes: "",
  },
  uploads: [],
};

const fullRenovation: RenovationConfig = {
  areas: [],
  currentFinish: "liner",
  filtrationWorks: [],
  replaceCoping: null,
  copingMaterial: "",
  structureIssues: [],
  equipmentUpgrades: [],
};

const project: ProjectConfiguration = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId: createProjectId(),
  config: fullConfig,
  renovation: fullRenovation,
};

function validLeadInput(overrides: Record<string, unknown> = {}) {
  return {
    customer: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+44 20 7946 0000",
      projectLocation: "Verona, IT (QA fixture -- not a real lead)",
    },
    commercial: { timing: "threeToSixMonths", notes: "QA fixture, safe test data." },
    privacy: { accepted: true, marketingConsent: false },
    website: "",
    idempotencyKey: crypto.randomUUID(),
    project,
    ...overrides,
  };
}

// --- A. Empty/invalid payload -> rejected ---
{
  const result = leadSubmissionInputSchema.safeParse({});
  assert(!result.success, "empty payload must be rejected");
  console.log("PASS — A) empty payload rejected");
}

// --- B. Invalid email -> rejected ---
{
  const result = leadSubmissionInputSchema.safeParse(
    validLeadInput({ customer: { ...validLeadInput().customer, email: "not-an-email" } }),
  );
  assert(!result.success, "invalid email must be rejected");
  console.log("PASS — B) invalid email rejected");
}

// --- C. Missing privacy acceptance -> rejected ---
{
  const result = leadSubmissionInputSchema.safeParse(
    validLeadInput({ privacy: { accepted: false, marketingConsent: false } }),
  );
  assert(!result.success, "missing privacy acceptance must be rejected");
  console.log("PASS — C) missing privacy acceptance rejected");
}

// --- D. Invalid ProjectConfiguration -> rejected ---
{
  const badProject = {
    ...project,
    schemaVersion: 99,
    config: { ...project.config, system: "bogus" },
  };
  const result = leadSubmissionInputSchema.safeParse(validLeadInput({ project: badProject }));
  assert(!result.success, "invalid/tampered ProjectConfiguration must be rejected");
  console.log("PASS — D) invalid ProjectConfiguration rejected");
}

// --- E. Valid payload -> accepted by the schema (server-side gate) ---
let validParsed: ReturnType<typeof leadSubmissionInputSchema.safeParse>;
{
  const result = leadSubmissionInputSchema.safeParse(validLeadInput());
  assert(
    result.success,
    `valid payload must be accepted by the schema: ${JSON.stringify("error" in result ? result.error.issues : null)}`,
  );
  validParsed = result;
  console.log("PASS — E) valid payload accepted by server-side schema");
}

// --- Payload survives with every canonical field intact ---
if (validParsed.success) {
  const parsedProject = validParsed.data.project as unknown as ProjectConfiguration;
  assert(parsedProject.projectId === project.projectId, "projectId must survive validation");
  assert(parsedProject.config.dimensions.length === 8, "dimensions must survive validation");
  assert(parsedProject.config.system === "overflow", "system must survive validation");
  assert(
    parsedProject.config.overflowType === "visible",
    "overflow variant must survive validation",
  );
  assert(parsedProject.config.copingMaterial === "prun", "coping must survive validation");
  assert(
    parsedProject.config.finish === "liner" &&
      parsedProject.config.linerColor === "motionSandBeach179",
    "liner/mosaic must survive validation",
  );
  assert(
    parsedProject.config.poolAccess === "internalSteps",
    "pool access must survive validation",
  );
  assert(parsedProject.config.ledColor === "#3fa8ff", "LED colour must survive validation");
  assert(parsedProject.config.features.includes("ledLighting"), "features must survive validation");
  assert(parsedProject.config.equipment.includes("heatPump"), "equipment must survive validation");
  console.log("PASS — full canonical ProjectConfiguration intact after server-side validation");
}

// --- Human-readable commercial email content ---
{
  const submission: LeadSubmission = {
    requestId: crypto.randomUUID(),
    projectId: project.projectId,
    schemaVersion: project.schemaVersion,
    createdAt: new Date().toISOString(),
    customer: validLeadInput().customer as LeadSubmission["customer"],
    commercial: validLeadInput().commercial as LeadSubmission["commercial"],
    project,
    privacy: { accepted: true, marketingConsent: false },
    attachments: [],
  };
  const { subject, text } = formatLeadEmail(submission);
  assert(subject.includes("Ada Lovelace"), "email subject must include the customer name");
  assert(text.includes(project.projectId), "email body must include the project id");
  assert(
    text.includes("Sfioro con griglia"),
    "email body must include the human-readable system line",
  );
  assert(text.includes("Travertino") === false, "sanity: unrelated coping name must not appear");
  assert(text.includes("Pietra di Prun"), "email body must include the coping material title");
  assert(
    text.includes("Verifica della soluzione strutturale"),
    "email must surface the deferred structural item (structure=null)",
  );
  assert(
    text.includes("Dimensionamento della potenza di riscaldamento"),
    "email must surface the deferred heating item (heatPump selected)",
  );
  console.log("PASS — human-readable commercial email includes every required field, not raw JSON");
}

console.log("Lead pipeline audit complete.");
console.log(
  "NOTE: submitLead.server.ts's handler (rate-limit, idempotency, Resend call) " +
    "isn't exercised by this script -- it imports @tanstack/react-start/server, " +
    "which resolves virtual specifiers (#tanstack-router-entry) only inside Vite's " +
    "plugin pipeline, and needs a live TanStack Start request context " +
    "(AsyncLocalStorage) that only exists inside a real HTTP request. Verified " +
    "separately: the handler correctly requires that context (confirmed via " +
    "Vite's own ssrLoadModule) and the RPC endpoint (/_serverFn/<id>) is reachable " +
    "and CSRF/origin-protected as expected; its body is a seroval-encoded frame " +
    "produced by TanStack Start's own client, not hand-constructable JSON.",
);
