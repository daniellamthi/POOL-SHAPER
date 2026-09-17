/**
 * P6B: proves the real attachment architecture (policy + derivation +
 * Supabase-backed storage adapter, stubbed fetch -- no live project
 * available in this environment, same pattern as lead-storage-audit.ts)
 * and the renovation commercial funnel (shared schema/email pipeline,
 * not a second one) against their own production code.
 */
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  checkAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_PROJECT,
} from "../src/lib/lead/attachmentPolicy";
import { deriveAttachments } from "../src/lib/lead/deriveAttachments";
import { AttachmentStorageError, getAttachmentStore } from "../src/lib/lead/attachmentStorage";
import {
  createProjectId,
  PROJECT_SCHEMA_VERSION,
  type ProjectConfiguration,
} from "../src/lib/pool/project";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { PoolConfig, RenovationConfig, UploadedFile } from "../src/lib/pool/types";
import { leadSubmissionInputSchema } from "../src/lib/lead/schema";
import { formatLeadEmail } from "../src/lib/lead/formatLeadEmail";
import type { LeadSubmission } from "../src/lib/lead/types";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

// ---------------------------------------------------------------------
// Mission A: attachment policy
// ---------------------------------------------------------------------

{
  const ok = checkAttachment({ name: "site-photo.jpg", type: "image/jpeg", size: 1024 });
  assert(ok.ok, "an allowed JPG must be accepted");
  console.log("PASS — A) allowed image accepted");
}

{
  const ok = checkAttachment({ name: "plan.pdf", type: "application/pdf", size: 2048 });
  assert(ok.ok, "an allowed PDF must be accepted");
  console.log("PASS — A) allowed PDF accepted");
}

{
  const bad = checkAttachment({
    name: "malware.exe",
    type: "application/octet-stream",
    size: 1024,
  });
  assert(!bad.ok, "an invalid extension must be rejected");
  console.log("PASS — A) invalid extension rejected");
}

{
  const bad = checkAttachment({ name: "photo.jpg", type: "application/x-msdownload", size: 1024 });
  assert(!bad.ok, "a mismatched/invalid declared MIME type must be rejected");
  console.log("PASS — A) invalid MIME type rejected");
}

{
  const bad = checkAttachment({
    name: "huge.png",
    type: "image/png",
    size: MAX_ATTACHMENT_BYTES + 1,
  });
  assert(!bad.ok, "a file over the max size must be rejected");
  console.log("PASS — A) oversized file rejected");
}

{
  const bad = checkAttachment({ name: "empty.png", type: "image/png", size: 0 });
  assert(!bad.ok, "an empty file must be rejected");
  console.log("PASS — A) empty file rejected");
}

{
  // Executables, arbitrary SVG/HTML must never pass, even with a
  // spoofed extension-adjacent name.
  for (const name of ["script.svg", "page.html", "run.sh", "archive.zip"]) {
    const bad = checkAttachment({ name, type: "text/plain", size: 1024 });
    assert(!bad.ok, `${name} must be rejected -- not on the allowlist`);
  }
  console.log("PASS — A) SVG/HTML/executable-adjacent files rejected");
}

console.log(
  `PASS — A) allowlist is exactly [${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}], max ${MAX_ATTACHMENTS_PER_PROJECT} attachments/project`,
);

// ---------------------------------------------------------------------
// Mission A: deriveAttachments -- only real, server-validated uploads
// survive into a lead, never raw client claims.
// ---------------------------------------------------------------------

const fullConfig: PoolConfig = {
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
  overflowType: "visible",
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
  uploads: [
    {
      id: "1",
      name: "photo.jpg",
      size: 1024,
      type: "image/jpeg",
      url: null,
      category: "site",
      uploadStatus: "uploaded",
      storagePath: "proj/uuid-photo.jpg",
    },
    {
      id: "2",
      name: "pending.jpg",
      size: 1024,
      type: "image/jpeg",
      url: null,
      category: "site",
      uploadStatus: "pending",
    },
    {
      id: "3",
      name: "failed.jpg",
      size: 1024,
      type: "image/jpeg",
      url: null,
      category: "site",
      uploadStatus: "failed",
      uploadError: "network error",
    },
    {
      id: "4",
      name: "tampered.exe",
      size: 1024,
      type: "application/octet-stream",
      url: null,
      category: "site",
      uploadStatus: "uploaded",
      storagePath: "proj/uuid-tampered.exe",
    },
  ] satisfies UploadedFile[],
};

const emptyRenovation: RenovationConfig = {
  areas: [],
  currentFinish: "liner",
  filtrationWorks: [],
  replaceCoping: null,
  copingMaterial: "",
  structureIssues: [],
  equipmentUpgrades: [],
};

const newPoolProject: ProjectConfiguration = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId: createProjectId(),
  config: fullConfig,
  renovation: emptyRenovation,
};

{
  const derived = deriveAttachments(newPoolProject);
  assert(
    derived.length === 1,
    `only the single real 'uploaded' entry must survive, got ${derived.length}`,
  );
  assert(derived[0]!.name === "photo.jpg", "the surviving attachment must be the uploaded photo");
  assert(
    !derived.some((a) => a.name === "tampered.exe"),
    "a tampered/non-allowlisted upload claiming uploadStatus=uploaded must still be re-rejected server-side",
  );
  console.log(
    "PASS — deriveAttachments only includes real, server-validated uploads and re-checks policy defensively",
  );
}

// ---------------------------------------------------------------------
// Mission A: attachment storage adapter -- never a fake success.
// ---------------------------------------------------------------------

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
{
  const store = getAttachmentStore();
  assert(
    store.kind === "unavailable",
    "with no Supabase env, the attachment store must be unavailable",
  );
  let threw = false;
  try {
    await store.upload(
      { name: "a.jpg", type: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) },
      { projectId: "p1" },
    );
  } catch (error) {
    threw = true;
    assert(
      error instanceof AttachmentStorageError && error.code === "STORAGE_NOT_CONFIGURED",
      "an unconfigured store must throw AttachmentStorageError('STORAGE_NOT_CONFIGURED'), never fake success",
    );
  }
  assert(threw, "upload() must reject, not silently resolve, when storage isn't configured");
  console.log(
    "PASS — STORAGE-NOT-CONFIGURED: no credentials -> controlled rejection, never fake success",
  );
}

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
const originalFetch = global.fetch;
try {
  const store = getAttachmentStore();
  assert(
    store.kind === "supabase",
    "with Supabase env set, the store must be the Supabase adapter",
  );

  // Successful upload: list returns few existing files, upload succeeds.
  let uploadRequest: { url: string; headers: Record<string, string> } | null = null;
  global.fetch = (async (url: string, init?: RequestInit) => {
    if (url.includes("/object/list/")) {
      return new Response(JSON.stringify([{ name: "existing.jpg" }]), { status: 200 });
    }
    uploadRequest = {
      url,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
    };
    return new Response(JSON.stringify({ Key: "ok" }), { status: 200 });
  }) as typeof fetch;

  const uploaded = await store.upload(
    { name: "site photo.jpg", type: "image/jpeg", bytes: new Uint8Array([1, 2, 3, 4]) },
    { projectId: "proj-abc" },
  );
  assert(uploaded.storagePath.startsWith("proj-abc/"), "storage path must be scoped by projectId");
  assert(
    !uploaded.storagePath.includes("site photo.jpg"),
    "the raw original filename must not be reused verbatim as the object name (non-guessable path)",
  );
  assert(uploadRequest !== null, "a real upload request must be made against Supabase Storage");
  assert(
    (uploadRequest as unknown as { url: string }).url.includes("pool-shaper-attachments"),
    "the upload must target the pool-shaper-attachments bucket",
  );
  assert(
    (uploadRequest as unknown as { headers: Record<string, string> }).headers[
      "authorization"
    ]?.includes("test-service-role-key"),
    "the request must be authorized with the service-role key server-side",
  );
  console.log(
    "PASS — successful upload targets the correct bucket, scoped path, and authorization",
  );

  // Max-count enforcement: list returns MAX_ATTACHMENTS_PER_PROJECT entries.
  global.fetch = (async (url: string) => {
    if (url.includes("/object/list/")) {
      const entries = Array.from({ length: MAX_ATTACHMENTS_PER_PROJECT }, (_, i) => ({
        name: `f${i}.jpg`,
      }));
      return new Response(JSON.stringify(entries), { status: 200 });
    }
    throw new Error("upload should not be attempted once the project is at capacity");
  }) as typeof fetch;
  let capacityThrew = false;
  try {
    await store.upload(
      { name: "one-too-many.jpg", type: "image/jpeg", bytes: new Uint8Array([1]) },
      { projectId: "proj-full" },
    );
  } catch (error) {
    capacityThrew = true;
    assert(
      error instanceof AttachmentStorageError && error.code === "TOO_MANY_ATTACHMENTS",
      "exceeding the per-project cap must throw AttachmentStorageError('TOO_MANY_ATTACHMENTS')",
    );
  }
  assert(capacityThrew, "upload() must reject once the per-project attachment cap is reached");
  console.log("PASS — max-attachments-per-project is enforced before any bytes are uploaded");
} finally {
  global.fetch = originalFetch;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// ---------------------------------------------------------------------
// Mission B: renovation funnel shares the exact same schema/email pipeline.
// ---------------------------------------------------------------------

const renovationConfig: PoolConfig = {
  ...fullConfig,
  projectType: "renovation",
  finish: "mosaic",
  uploads: [],
};

const renovationDetails: RenovationConfig = {
  areas: ["interiorFinish", "filtration", "structure"],
  currentFinish: "liner",
  filtrationWorks: ["pump", "skimmers"],
  replaceCoping: false,
  copingMaterial: "",
  structureIssues: ["crack", "waterproofing"],
  equipmentUpgrades: ["heatPump"],
};

const renovationProject: ProjectConfiguration = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId: createProjectId(),
  config: renovationConfig,
  renovation: renovationDetails,
};

function validRenovationInput(overrides: Record<string, unknown> = {}) {
  return {
    customer: {
      name: "Grace Hopper",
      email: "grace@example.com",
      phone: "+1 555 0100",
      projectLocation: "Milano, IT (QA fixture -- not a real lead)",
    },
    commercial: { timing: "asap", notes: "QA fixture, safe test data." },
    privacy: { accepted: true, marketingConsent: false },
    website: "",
    idempotencyKey: crypto.randomUUID(),
    project: renovationProject,
    ...overrides,
  };
}

{
  const result = leadSubmissionInputSchema.safeParse(validRenovationInput());
  assert(
    result.success,
    `a valid renovation project must be accepted by the SAME schema used for new-pool leads: ${JSON.stringify(
      "error" in result ? result.error.issues : null,
    )}`,
  );
  const parsed = result.data.project as unknown as ProjectConfiguration;
  assert(
    parsed.config.projectType === "renovation",
    "the canonical renovation projectType must survive validation",
  );
  assert(
    parsed.renovation.areas.includes("structure"),
    "renovation-specific fields (areas, etc.) must survive validation intact",
  );
  console.log(
    "PASS — B) renovation project validated by the SAME leadSubmissionInputSchema as new-pool projects, no second schema",
  );
}

{
  const submission: LeadSubmission = {
    requestId: crypto.randomUUID(),
    projectId: renovationProject.projectId,
    schemaVersion: renovationProject.schemaVersion,
    createdAt: new Date().toISOString(),
    customer: validRenovationInput().customer as LeadSubmission["customer"],
    commercial: validRenovationInput().commercial as LeadSubmission["commercial"],
    project: renovationProject,
    privacy: { accepted: true, marketingConsent: false },
    attachments: [],
  };
  const { subject, text } = formatLeadEmail(submission);
  assert(
    subject.includes("Ristrutturazione"),
    "renovation email subject must say so, not 'nuovo progetto'",
  );
  assert(
    text.includes("RISTRUTTURAZIONE PISCINA"),
    "renovation email body must use the renovation section",
  );
  assert(
    text.includes("Impianto filtrazione"),
    "requested filtration work must appear (area selected)",
  );
  assert(
    text.includes("Problemi struttura"),
    "requested structural issues must appear (area selected)",
  );
  assert(
    !text.includes("Illuminazione LED"),
    "irrelevant new-pool-only fields (LED) must not appear in a renovation email",
  );
  console.log(
    "PASS — B) renovation commercial email adapts content (current situation, interventions, problems) instead of reusing new-pool fields",
  );
}

console.log("Attachment + renovation audit complete.");
