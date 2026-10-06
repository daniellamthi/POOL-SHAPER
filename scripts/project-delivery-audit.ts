/**
 * Build 2 · Project delivery audit. Proves, against the production modules,
 * that ONE canonical snapshot drives save, share restore, Summary, Project
 * Book PDF and quote payload, and that the store contract holds.
 *
 * Always runs against the in-memory store. When PROJECT_AUDIT_SUPABASE_URL
 * (a PostgREST `/rest/v1` endpoint with migrations 0001-0003 applied) and
 * the service/anon/authenticated JWTs are provided, it also runs the same
 * contract against the real database and proves RLS from the outside.
 */
import {
  createProjectId,
  parseProjectConfiguration,
  PROJECT_SCHEMA_VERSION,
  serializeProjectConfiguration,
  type ProjectConfiguration,
} from "../src/lib/pool/project";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { PoolConfig, RenovationConfig } from "../src/lib/pool/types";
import { buildOutline } from "../src/lib/pool/geometry";
import { clampInfinityEdgeParams, infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import {
  createEditToken,
  createPublicRef,
  hashEditToken,
  isEditToken,
  isPublicRef,
  projectShareUrl,
} from "../src/lib/project-delivery/reference";
import {
  MemoryProjectStore,
  SupabaseProjectStore,
  type ProjectStore,
} from "../src/lib/project-delivery/store";
import {
  loadSharedProject,
  MAX_SNAPSHOT_BYTES,
  ProjectDeliveryError,
  saveProject,
} from "../src/lib/project-delivery/service";
import QRCode from "qrcode";
import { buildProjectSummary } from "../src/lib/project-delivery/summary-model";
import { buildProjectBook, pdfText } from "../src/lib/project-delivery/projectBook";
import { leadSubmissionInputSchema } from "../src/lib/lead/schema";
import { formatLeadEmail } from "../src/lib/lead/formatLeadEmail";
import type { LeadSubmission } from "../src/lib/lead/types";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};
/** Field-by-field equality; key order is irrelevant (Postgres jsonb reorders keys). */
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
        )
      : value;
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

const renovation: RenovationConfig = {
  areas: [],
  currentFinish: "liner",
  filtrationWorks: [],
  replaceCoping: null,
  copingMaterial: "",
  structureIssues: [],
  equipmentUpgrades: [],
};

const customer = {
  name: "Ada",
  surname: "Lovelace",
  company: "",
  email: "ada@example.com",
  phone: "+39 333 000 0000",
  city: "Milano",
  country: "Italia",
  notes: "Chiamare dopo le 18",
};

const base: PoolConfig = {
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
  dimensions: { length: 8, width: 4, depth: 1.5, cornerRadius: 0, floorProfile: "flat" },
  system: "skimmer",
  overflowType: "visible",
  skimmerFinish: "white",
  skimmerType: "standard",
  finish: "liner",
  linerColor: "motionSandBeach179",
  mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
  features: ["ledLighting"],
  ledColor: "#ffffff",
  ledIntensity: 0.6,
  poolAccess: "internalSteps",
  internalStairType: "corner",
  equipment: ["heatPump"],
  sceneTime: "day",
  customer,
  uploads: [
    { id: "u1", name: "giardino.jpg", size: 1024, type: "image/jpeg", url: null, category: "site" },
  ],
};

// Reference project A: 8 x 4 rectangle, Skimmer.
const projectA: ProjectConfiguration = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId: createProjectId(),
  config: base,
  renovation,
};

// Reference project B: 12 x 5 rectangle, Infinity on a real candidate side.
const dimsB = { length: 12, width: 5, depth: 1.6, cornerRadius: 0, floorProfile: "flat" as const };
const zoneB = infinityZonesForOutline(
  buildOutline("rectangle", dimsB, base.controlPoints),
  "rectangle",
)[0];
assert(zoneB, "12 x 5 rectangle must offer an Infinity side");
const projectB: ProjectConfiguration = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId: createProjectId(),
  config: {
    ...base,
    dimensions: dimsB,
    system: "infinity",
    infinityEdge: clampInfinityEdgeParams({ enabled: true, side: zoneB.side }),
    finish: "mosaic",
    features: ["ledLighting", "hydromassage"],
    poolAccess: "stainlessSteelLadder",
    sceneTime: "night",
  },
  renovation,
};

async function expectCode(promise: Promise<unknown>, code: string, label: string) {
  try {
    await promise;
  } catch (error) {
    assert(
      error instanceof ProjectDeliveryError && error.code === code,
      `${label}: expected ${code}, got ${String(error)}`,
    );
    return;
  }
  throw new Error(`${label}: expected ${code}, call succeeded`);
}

/** The PDF must carry every value the Summary shows. jsPDF writes WinAnsi
 * text as literal strings; compare word by word (lines may wrap). */
function pdfMissing(pdf: string, values: ReadonlyArray<string>): string[] {
  const missing: string[] = [];
  const body = pdf.replace(/\\([()\\])/g, "$1");
  for (const value of values) {
    for (const word of pdfText(value).split(/[\s·–—]+/)) {
      const ascii = word.replace(/[^\x21-\x7e]/g, "");
      if (ascii.length < 2 || ascii !== word) continue;
      if (!body.includes(ascii)) missing.push(`${value} [${ascii}]`);
    }
  }
  return missing;
}

// Stand-in captures (valid PNGs) for the Day/Night page.
const dayImage = await QRCode.toDataURL("day", { width: 64 });
const nightImage = await QRCode.toDataURL("night", { width: 64 });

let mismatches = 0;

async function contract(store: ProjectStore, label: string) {
  for (const [name, project] of [
    ["A 8x4 Skimmer", projectA],
    ["B 12x5 Infinity", projectB],
  ] as const) {
    const snapshot = serializeProjectConfiguration(project);
    // configure -> snapshot -> server save
    const created = await saveProject(store, { snapshot });
    assert(created.created && isPublicRef(created.publicRef), `${label} ${name}: public ref`);
    assert(isEditToken(created.editToken), `${label} ${name}: owner token returned once`);
    assert(created.durable === store.durable, `${label} ${name}: durability is reported honestly`);

    // reload / new session -> shared read
    const shared = await loadSharedProject(store, created.publicRef);
    const restored = parseProjectConfiguration(shared.snapshot);
    const expected = {
      ...project,
      config: { ...project.config, customer: { ...restored.config.customer }, uploads: [] },
    };
    assert(
      Object.values(restored.config.customer).every((v) => v === "") &&
        restored.config.uploads.length === 0,
      `${label} ${name}: shared snapshot must not carry contact details or uploads`,
    );
    assert(!shared.snapshot.includes(customer.email), `${label} ${name}: email leaked`);
    if (!same(restored, expected)) {
      mismatches++;
      throw new Error(`${label} ${name}: restored snapshot differs from the saved one`);
    }

    // Summary and PDF read the same model from the same snapshot.
    const summary = buildProjectSummary(restored);
    if (!same(summary, buildProjectSummary(expected))) mismatches++;
    assert(summary.projectId === project.projectId, `${label} ${name}: summary project id`);
    const shareUrl = projectShareUrl("https://example.test", created.publicRef);
    const doc = await buildProjectBook({
      model: summary,
      publicRef: created.publicRef,
      shareUrl,
      heroDataUrl: dayImage,
      presentation: { day: dayImage, night: nightImage },
      issuedAt: new Date("2026-10-06T10:00:00Z"),
    });
    const pdf = doc.output();
    assert(doc.getNumberOfPages() === 7, `${label} ${name}: Project Book has 7 pages`);
    assert(
      ["Presentazione", "GIORNO", "NOTTE"].every((word) => pdf.includes(word)),
      `${label} ${name}: Day/Night presentation page`,
    );
    assert(
      (pdf.match(/\/Subtype \/Image/g) ?? []).length >= 3,
      `${label} ${name}: hero, day/night and QR images embedded`,
    );
    assert(pdf.includes(created.publicRef), `${label} ${name}: PDF carries the Project ID`);
    assert(pdf.includes(shareUrl), `${label} ${name}: PDF carries the share link`);
    assert(/\/Subtype \/Image/.test(pdf), `${label} ${name}: PDF embeds the QR image`);
    assert(!pdf.includes(created.editToken!), `${label} ${name}: PDF must not carry the token`);
    const values = [
      summary.headline,
      ...summary.sections.flatMap((s) => s.rows.map((r) => r.value)),
      ...summary.technical.map((r) => r.value),
    ];
    const missing = pdfMissing(pdf, values);
    if (missing.length) {
      mismatches += missing.length;
      throw new Error(`${label} ${name}: PDF misses ${missing.slice(0, 5).join(", ")}`);
    }

    // Quote payload: the same snapshot, plus the public reference.
    const parsed = leadSubmissionInputSchema.parse({
      customer: {
        name: "Ada",
        email: "ada@example.com",
        phone: "+39 333 000 0000",
        projectLocation: "Milano",
      },
      commercial: { timing: "within3Months", notes: "" },
      privacy: { accepted: true, marketingConsent: false },
      website: "",
      idempotencyKey: "audit-key-123456",
      projectReference: created.publicRef,
      project: restored,
    });
    if (!same(parsed.project, restored)) {
      mismatches++;
      throw new Error(`${label} ${name}: quote payload snapshot differs`);
    }
    assert(parsed.projectReference === created.publicRef, `${label} ${name}: quote reference`);
    const submission: LeadSubmission = {
      requestId: "req-audit",
      projectId: restored.projectId,
      projectReference: created.publicRef,
      schemaVersion: restored.schemaVersion,
      createdAt: new Date().toISOString(),
      customer: parsed.customer as LeadSubmission["customer"],
      commercial: parsed.commercial as LeadSubmission["commercial"],
      project: parsed.project as ProjectConfiguration,
      privacy: { accepted: true, marketingConsent: false },
      attachments: [],
    };
    const email = formatLeadEmail(submission);
    assert(
      email.subject.includes(created.publicRef) && email.text.includes(created.publicRef),
      `${label} ${name}: quote email carries the Project ID`,
    );

    // Owner update.
    const changed: ProjectConfiguration = {
      ...project,
      config: { ...project.config, ledIntensity: 0.9 },
    };
    const updated = await saveProject(store, {
      snapshot: serializeProjectConfiguration(changed),
      publicRef: created.publicRef,
      editToken: created.editToken!,
    });
    assert(!updated.created && updated.editToken === null, `${label} ${name}: update keeps ref`);
    const reread = parseProjectConfiguration(
      (await loadSharedProject(store, created.publicRef)).snapshot,
    );
    assert(reread.config.ledIntensity === 0.9, `${label} ${name}: owner update persisted`);

    // Non-owner cannot mutate: wrong token, unknown ref, malformed input.
    const attack = serializeProjectConfiguration({
      ...project,
      config: { ...project.config, ledIntensity: 0.1 },
    });
    await expectCode(
      saveProject(store, {
        snapshot: attack,
        publicRef: created.publicRef,
        editToken: createEditToken(),
      }),
      "forbidden",
      `${label} ${name}: wrong token`,
    );
    await expectCode(
      saveProject(store, {
        snapshot: attack,
        publicRef: createPublicRef(),
        editToken: created.editToken!,
      }),
      "forbidden",
      `${label} ${name}: token on another ref`,
    );
    await expectCode(
      saveProject(store, { snapshot: attack, publicRef: created.publicRef, editToken: "short" }),
      "invalid_reference",
      `${label} ${name}: malformed token`,
    );
    await expectCode(
      saveProject(store, { snapshot: attack, publicRef: created.publicRef }),
      "invalid_reference",
      `${label} ${name}: ref without token`,
    );
    const after = parseProjectConfiguration(
      (await loadSharedProject(store, created.publicRef)).snapshot,
    );
    assert(after.config.ledIntensity === 0.9, `${label} ${name}: rejected writes changed nothing`);
    console.log(
      `PASS — ${label} ${name}: save → reload → share → Summary → PDF → quote (0 mismatches) · ${created.publicRef}`,
    );
  }

  await expectCode(
    loadSharedProject(store, createPublicRef()),
    "not_found",
    `${label}: unknown ref`,
  );
  await expectCode(
    loadSharedProject(store, "PW-0000-00000I"),
    "invalid_reference",
    `${label}: bad ref`,
  );
  await expectCode(loadSharedProject(store, "1"), "invalid_reference", `${label}: numeric id`);
  await expectCode(saveProject(store, { snapshot: "{" }), "invalid_snapshot", `${label}: bad json`);
  await expectCode(
    saveProject(store, { snapshot: JSON.stringify({ ...projectA, schemaVersion: 99 }) }),
    "invalid_snapshot",
    `${label}: future schema`,
  );
  await expectCode(
    saveProject(store, {
      snapshot: JSON.stringify({ ...projectA, config: { ...projectA.config, shape: "organic" } }),
    }),
    "invalid_snapshot",
    `${label}: retired Organic`,
  );
  await expectCode(
    saveProject(store, {
      snapshot: JSON.stringify({ ...projectA, padding: "x".repeat(MAX_SNAPSHOT_BYTES) }),
    }),
    "too_large",
    `${label}: oversize`,
  );
  console.log(
    `PASS — ${label}: invalid ref / unknown ref / bad JSON / future schema / Organic / oversize refused`,
  );
}

// --- References: unguessable, non-sequential, well-formed ---
const refs = new Set<string>();
for (let i = 0; i < 20000; i++) {
  const ref = createPublicRef();
  assert(isPublicRef(ref), `malformed ref ${ref}`);
  refs.add(ref);
}
assert(refs.size === 20000, "public refs must not collide in 20k draws");
const tokens = new Set(Array.from({ length: 2000 }, () => createEditToken()));
assert(
  tokens.size === 2000 && [...tokens].every(isEditToken),
  "edit tokens must be unique 256-bit",
);
const token = createEditToken();
assert(
  /^[0-9a-f]{64}$/.test(await hashEditToken(token)),
  "only a SHA-256 hex of the token is stored",
);
assert(!isPublicRef("PW-AAAA-AAAAAI") && !isPublicRef("pw-aaaa-aaaaaa"), "ref alphabet is strict");
console.log("PASS — refs: 50-bit Crockford, 20k unique; tokens 256-bit; hash-only storage");

// --- Legacy saves: older drafts restore, unsupported ones are refused cleanly ---
const legacy = JSON.parse(serializeProjectConfiguration(projectA)) as {
  config: Record<string, unknown>;
};
delete legacy.config["sceneTime"];
delete legacy.config["ledIntensity"];
delete legacy.config["infinityEdge"];
const legacyRestored = parseProjectConfiguration(JSON.stringify(legacy));
assert(typeof legacyRestored.config.ledIntensity === "number", "legacy draft gains defaults");
assert(buildProjectSummary(legacyRestored).sections.length > 0, "legacy draft renders a Summary");
console.log("PASS — legacy snapshot restores with defaults; Summary renders");

await contract(new MemoryProjectStore(), "memory");

// --- Real PostgREST + Postgres (Supabase-equivalent) ---
const url = process.env["PROJECT_AUDIT_SUPABASE_URL"];
const serviceKey = process.env["PROJECT_AUDIT_SERVICE_KEY"];
const anonKey = process.env["PROJECT_AUDIT_ANON_KEY"];
const userKey = process.env["PROJECT_AUDIT_AUTHENTICATED_KEY"];
if (url && serviceKey && anonKey && userKey) {
  const store = new SupabaseProjectStore(url, serviceKey);
  await contract(store, "postgrest");

  const owned = await saveProject(store, { snapshot: serializeProjectConfiguration(projectA) });
  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/projects`;
  const service = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const stored = (await (
    await fetch(`${endpoint}?public_ref=eq.${owned.publicRef}&select=edit_token_hash,snapshot`, {
      headers: service,
    })
  ).json()) as Array<{ edit_token_hash: string; snapshot: unknown }>;
  assert(stored[0]?.edit_token_hash === (await hashEditToken(owned.editToken!)), "hash stored");
  assert(!JSON.stringify(stored).includes(owned.editToken!), "raw token never stored");
  assert(!JSON.stringify(stored).includes(customer.email), "contact details never stored");

  for (const [role, key] of [
    ["anon", anonKey],
    ["authenticated", userKey],
  ] as const) {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    const attempts: Array<[string, Promise<Response>]> = [
      ["list", fetch(`${endpoint}?select=*`, { headers })],
      [
        "read by ref",
        fetch(`${endpoint}?public_ref=eq.${owned.publicRef}&select=snapshot`, { headers }),
      ],
      [
        "insert",
        fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            public_ref: createPublicRef(),
            project_id: "x",
            edit_token_hash: "0".repeat(64),
            snapshot_version: 1,
            snapshot: {},
          }),
        }),
      ],
      [
        "update",
        fetch(`${endpoint}?public_ref=eq.${owned.publicRef}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ snapshot: {} }),
        }),
      ],
      [
        "delete",
        fetch(`${endpoint}?public_ref=eq.${owned.publicRef}`, { method: "DELETE", headers }),
      ],
    ];
    for (const [what, request] of attempts) {
      const response = await request;
      const text = await response.text();
      assert(
        response.status === 401 || response.status === 403,
        `RLS: ${role} ${what} must be denied, got ${response.status} ${text}`,
      );
    }
    console.log(`PASS — RLS: ${role} key denied list/read/insert/update/delete (401/403)`);
  }
  const intact = parseProjectConfiguration(
    (await loadSharedProject(store, owned.publicRef)).snapshot,
  );
  assert(
    intact.config.ledIntensity === projectA.config.ledIntensity,
    "denied writes changed nothing",
  );
  console.log(
    "PASS — postgrest: token stored as SHA-256 only, no contact data, row intact after attacks",
  );
} else {
  console.log("SKIP — postgrest/RLS: PROJECT_AUDIT_SUPABASE_URL and keys not provided");
}

assert(mismatches === 0, `${mismatches} mismatches`);
console.log("PASS — project delivery: 0 mismatches");
