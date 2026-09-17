/**
 * Proves the P6A durable-storage adapter (src/lib/lead/storage.ts)
 * against its own real code: the memory fallback's idempotency
 * behaviour directly, and the Supabase (PostgREST-over-fetch)
 * implementation's request/response handling via a stubbed
 * `global.fetch` -- no live Supabase project required (this
 * environment doesn't have one available for POOL-SHAPER; see the
 * P6A report).
 */
import {
  createProjectId,
  PROJECT_SCHEMA_VERSION,
  type ProjectConfiguration,
} from "../src/lib/pool/project";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { LeadSubmission } from "../src/lib/lead/types";
import { getLeadStore, LeadStorageError } from "../src/lib/lead/storage";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const project: ProjectConfiguration = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId: createProjectId(),
  config: {
    projectType: "new",
    poolType: "in-ground",
    structure: "reinforced-concrete",
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
    overflowType: "hidden",
    skimmerFinish: "white",
    skimmerType: "standard",
    finish: "liner",
    linerColor: "motionSandBeach179",
    mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
    features: [],
    ledColor: "#ffffff",
    poolAccess: "internalSteps",
    equipment: [],
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
  },
  renovation: {
    areas: [],
    currentFinish: "liner",
    filtrationWorks: [],
    replaceCoping: null,
    copingMaterial: "",
    structureIssues: [],
    equipmentUpgrades: [],
  },
};

function submission(requestId: string): LeadSubmission {
  return {
    requestId,
    projectId: project.projectId,
    schemaVersion: project.schemaVersion,
    createdAt: new Date().toISOString(),
    customer: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+44 20 7946 0000",
      projectLocation: "Verona, IT",
    },
    commercial: { timing: "asap", notes: "" },
    project,
    privacy: { accepted: true, marketingConsent: false },
    attachments: [],
  };
}

// --- getLeadStore() picks memory when no Supabase env is set. ---
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const memoryStore = getLeadStore();
assert(
  memoryStore.kind === "memory",
  "with no SUPABASE_URL/KEY, getLeadStore must fall back to memory",
);
console.log(
  "PASS — getLeadStore() falls back to the memory store when Supabase env vars are unset",
);

// --- C. Duplicate request (same idempotency key) -> no duplicate row. ---
const key = "qa-idempotency-key-1";
const first = await memoryStore.upsertLead(submission("req-1"), key);
assert(
  first.existing === null,
  "first upsert with a fresh idempotency key must not report an existing row",
);
const second = await memoryStore.upsertLead(submission("req-2"), key);
assert(
  second.existing !== null && second.existing.requestId === "req-1",
  "a second upsert with the SAME idempotency key must return the first row, not create a second one",
);
console.log(
  "PASS — C) duplicate idempotency key returns the existing lead instead of creating a second one",
);

await memoryStore.updateEmailStatus("req-1", "email_sent");
const third = await memoryStore.upsertLead(submission("req-3"), key);
assert(
  third.existing?.status === "email_sent",
  "the store must reflect the updated status on a repeated idempotency key",
);
console.log("PASS — updateEmailStatus is reflected on subsequent idempotency lookups");

// --- Supabase-backed store: env selection + request/response handling
//     via a stubbed fetch (no live project available in this
//     environment -- see the P6A report). ---
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
const supabaseStore = getLeadStore();
assert(
  supabaseStore.kind === "supabase",
  "with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set, getLeadStore must return the Supabase store",
);
console.log("PASS — getLeadStore() selects the Supabase store once env vars are configured");

const originalFetch = global.fetch;
try {
  // D. Storage unavailable (non-2xx from PostgREST) -> a truthful, typed error.
  global.fetch = (async () => new Response("db unreachable", { status: 503 })) as typeof fetch;
  let threw = false;
  try {
    await supabaseStore.upsertLead(submission("req-fail"), "key-fail");
  } catch (error) {
    threw = true;
    assert(
      error instanceof LeadStorageError && error.code === "STORAGE_UNAVAILABLE",
      "a failed Supabase insert must throw LeadStorageError('STORAGE_UNAVAILABLE'), not fail silently or fake success",
    );
  }
  assert(threw, "an unreachable store must throw, never return a fake success");
  console.log("PASS — D) storage unavailable surfaces a truthful STORAGE_UNAVAILABLE error");

  // Fresh insert -> PostgREST returns the inserted row.
  let lastRequest: { url: string; body: unknown } | null = null;
  global.fetch = (async (url: string, init?: RequestInit) => {
    lastRequest = { url, body: init?.body ? JSON.parse(init.body as string) : null };
    return new Response(JSON.stringify([{ request_id: "req-new", status: "pending" }]), {
      status: 201,
    });
  }) as typeof fetch;
  const insertResult = await supabaseStore.upsertLead(submission("req-new"), "key-new");
  assert(insertResult.stored === true, "a successful Supabase insert must report stored: true");
  assert(insertResult.existing === null, "a fresh insert must not report an existing row");
  assert(
    typeof lastRequest?.body === "object" &&
      (lastRequest.body as Record<string, unknown>)["project_configuration"] !== undefined,
    "the request body sent to Supabase must include the full canonical project_configuration",
  );
  console.log(
    "PASS — F) fresh Supabase insert reports stored: true and sends the full canonical project",
  );

  // Duplicate insert -> PostgREST's ignore-duplicates returns an empty
  // array; the store must then look the existing row up, not treat it
  // as a fresh lead.
  let call = 0;
  global.fetch = (async () => {
    call += 1;
    if (call === 1) return new Response(JSON.stringify([]), { status: 201 });
    return new Response(JSON.stringify([{ request_id: "req-original", status: "email_sent" }]), {
      status: 200,
    });
  }) as typeof fetch;
  const dupResult = await supabaseStore.upsertLead(submission("req-dup"), "key-dup");
  assert(
    dupResult.existing?.requestId === "req-original" && dupResult.existing.status === "email_sent",
    "a Supabase-side duplicate (ignore-duplicates, empty array) must resolve to the pre-existing row via the idempotency-key lookup",
  );
  console.log(
    "PASS — C, Supabase path) a duplicate idempotency key resolves to the existing row, never a new one",
  );
} finally {
  global.fetch = originalFetch;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

console.log("Lead storage audit complete.");
