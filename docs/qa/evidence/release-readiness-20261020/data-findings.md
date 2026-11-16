# D — Persistence, export and commercial readiness

Reviewed 2026-10-20, branch `feat/fullscreen-day-night-hidden-overflow`, starting HEAD `0665d3b44bb0d25319f273397dea14825ff5f64a`. Read-only specialist review. Existing WIP and archives preserved. No application edit, migration, backend mutation, deployment, secret change or email send.

## Current verdict

**BLOCKED for production release.** Local delivery/security regressions pass and the authorized backend is reachable. Current integrated browser delivery remains NOT VERIFIED until the browser owner completes the chain. Privacy placeholders, undocumented asset rights, production runtime/domain verification and operational recovery evidence remain open. Email live remains explicitly deferred.

## Requirement matrix

| ID | Expected/scenario | Evidence / cause / next action | Status |
|---|---|---|---|
| D01 | Exact backend and secure server credential | Explicit `Daniele 2` connector `link_6ac6a1212b9881919c404d54257bc6b1`; `get_project(waetxxqdlsuanqescuye)` returned Configuratore piscine wellness, ACTIVE_HEALTHY. Ignored `.env.local` mode 0600, exact authorized URL and nonempty server credential. Private in-process HEAD `/rest/v1/projects?select=public_ref&limit=0` authenticated HTTP 200. No key value printed or recorded. | PASS, current read-only live check |
| D02 | Missing/incorrect server config must fail closed | `store.ts:getProjectStore`, lead/attachment factories reject missing credentials and wrong target. Memory stores are explicit test fixtures only. Backend-security and lead-storage regressions pass. | PASS local |
| D03 | Save → Reload → Share → read-only → Save Copy identity | Current `test:project-delivery`: A 8×4 Skimmer, B 12×5 Infinity, C above-ground grille/extended platform, 0 mismatches; invalid references/tokens/snapshots refused; owner identity cannot be reassigned; copy receives new identity; saved copy URL regression covered. Memory adapter only. | PASS local; NOT VERIFIED current browser/cloud chain |
| D04 | Current local draft and legacy recovery | `test:persistence` passes canonical fields, L shape/slope, malformed dimensions, unsupported schema, retired Organic archive, and archive-quota preservation. In-memory localStorage fixture; no customer browser draft touched. | PASS local |
| D05 | Public shares exclude personal data and uploads | Current allowlist removes contacts/upload metadata and unknown private fields before persistence and again on shared read. Scoped read-only SQL: 87 projects; 0 nonempty customer fields, 0 nonempty uploads, 0 row/snapshot projectId mismatches. No contacts or snapshot values retrieved. | PASS local + current live aggregate |
| D06 | Attachment type, bytes, quota, ownership and private storage | JPG/JPEG/PNG/WEBP/PDF; >0 and ≤10 MiB; max 8/project; server byte-signature and persisted-ledger verification, owner/grant scoping, traversal/duplicate/forgery checks pass locally. Scoped cloud metadata confirms `pool-shaper-attachments.public=false`. Bucket MIME/size fields are null; authoritative restrictions live in server code, with no public object access. | PASS local + private-bucket metadata; historic concurrency/RLS evidence only |
| D07 | PDF and quote use saved canonical identity | A/B/C contract tests match saved/shared Summary/PDF/quote data. Export-guard suite passes separately: its unsupported render-export formats must not be confused with Project Book PDF. Current browser download/pages/images and durable quote identity still require browser verification. | PASS local; NOT VERIFIED current browser |
| D08 | Lead validation, consent, durable storage and idempotency | `test:lead-pipeline`, `test:lead-storage`, `test:attachments` pass new/renovation schemas, consent rejection, canonical payload, duplicate keys, storage failures and verified attachments. Lead-storage HTTP responses are mocked; handler needs real request context and is explicitly outside those tests. | PASS local; NOT VERIFIED current browser/DB submission |
| D09 | Notifications distinguish accepted/sent/delivered/bounced | Current email suite: 20 mocked workers → one provider call; stable retry payload/key, business recipient, early/replayed signed webhook handling, missing credentials never claim delivery. `.env.local`: Resend API key, sender and webhook secret absent; domain-verification flag false; QA disable true. | PASS local; BLOCKED live email, intentionally deferred |
| D10 | Current release runs with server bindings and HTTPS/domain | Shell env has no backend/provider vars; local private file is valid but does not prove deployed bindings. Existing `.output/nitro.json` is a 2026-10-19 artifact targeting cloudflare-module/nodeCompat, not evidence for the current candidate deployment. README's historical Lovable domain could not be inspected by web tool; this is not proof of outage. No production candidate/domain/SHA verified. | NOT VERIFIED |
| D11 | Customer-facing privacy information is final | `src/routes/privacy.tsx` explicitly says development document; placeholders remain for company, legal address, VAT, privacy/DPO contact, retention, hosting/storage provider and publication date. No legal/business facts invented. | BLOCKED owner input |
| D12 | Recoverable data and deployment with an executable restore procedure | Local source/WIP backups are documented in existing QA reports. They do not establish a Supabase database/object backup, retention/RPO/RTO or a tested production restore. No production recovery runbook/evidence found in the relevant checked delivery/QA docs. | NOT VERIFIED / prelaunch blocker |
| D13 | Publication rights are documented for shipped assets | `public/product-photos/README.md`, `manifest.json`, `sources.json` document the bounded licensed subset: 4/55 mappings, three photographs (two licensed references + owner Prun sample). Fifteen retained liner/mosaic raster samples explicitly lack documented author/redistribution permission. Liner not altered. Remaining 51 photo mappings are missing, not treated as licensed product photographs. | BLOCKED undocumented retained-raster rights |
| D14 | Server secrets absent from current public build | Factories are server-only and tests use fake keys. Build 2 documented an actual configured-key scan, but no current candidate production-bundle secret scan was performed by this specialist. Root should scan its final build without printing key values. | NOT VERIFIED current build |

## Targeted verification executed

All exited 0 on the checked source, with no live-test flags:

- `npm run test:persistence`
- `npm run test:export-guard`
- `npm run test:project-delivery` — explicit LOCAL ONLY output; A/B/C 0 mismatches.
- `npm run test:lead-pipeline`
- `npm run test:lead-storage`
- `npm run test:attachments`
- `node scripts/run-backend-security-audit.mjs`
- `node scripts/run-email-notification-audit.mjs` — provider mocked, no Resend send.

Expected corrupt-draft/schema/quota warning logs belong to negative tests; suites completed successfully. No full build/lint/test run performed by this specialist.

Current read-only cloud checks used only the exact authorized connector/project, plus the secure HEAD above. Existing Build 2 migration versions through `20261010132858` are present. Later wellness/archive migrations exist; no unrelated schema audit or alteration was performed. An initial aggregate SQL had a syntax error; corrected read-only SQL returned the results reported above. The failed query changed nothing.

## Build 2 evidence reuse boundary

`docs/qa/BUILD2_BACKEND_GATE.md` records October 11 live authorization/concurrency and nine browser/cloud/PDF cases. The unchanged server-store, attachment authorization and notification implementation preserve useful historical evidence, reinforced by current local regressions and live metadata. No new live concurrency/68-session RLS run was necessary or performed.

The integrated parser, public snapshot allowlist, client dirty tracking/copy handling, delivery UI, quote schema, Summary and PDF changed after Build 2 (`bb1c1d5`), most recently delivery-related code in `48114b3`. Therefore that historic matrix cannot stand in for a fresh current browser chain. No historical PASS has been promoted to a current production PASS.

## Browser handoff — precise prerequisites

Ready: correct active backend; valid server credential held privately in the correct checkout; QA notifications disabled; targeted fixtures/contracts passing. At this specialist's listener check no POOL-SHAPER preview process was running; the only app-like listener (4190) belonged to a different repository.

Root/browser owner must start or identify the preview from this checkout with server env loaded, record origin/PID/cwd, preserve the original browser draft, and use a separate QA origin/context. No specialist browser navigation or cloud write was performed.

Then execute CONFIGURE → SAVE → RELOAD → SHARE → fresh-context READ-ONLY → SAVE COPY → RELOAD → PDF → QUOTE on current candidate. Record source/copy public references, saved projectIds and exact QA requestIds without owner tokens or contacts. Verify identical normalized saved snapshots, new copy identity, unchanged source, absence of edit token/contact/uploads in public data, actual PDF download and page/image/ID checks, and one durable QA lead/outbox per submission. Repeat required desktop/mobile viewports; emulation must be labelled. Scoped read-only database verification can follow the exact generated IDs. Email stays disabled.

If new shelf dimension/orientation fields are introduced, add them to `shareableProject`'s explicit whitelist and roundtrip tests before reusing D03/D07 results.

## Exact remaining owner / release actions

1. Supply the actual legal/business values for D11 and obtain the intended privacy approval; complete the existing page before public lead collection.
2. Provide public-web redistribution authorization/source/manufacturer for the 15 retained liner/mosaic raster samples. Any replacement needs a separate authorized scope because liner changes are forbidden here.
3. Confirm intended production host/domain and release SHA; after release authorization, verify HTTPS, redirect/canonical origin, secure-cookie behavior and server-only backend bindings in that runtime. No deployment or DNS change is authorized by this task.
4. Confirm the authorized project's actual database/object backup schedule, retention and last successful backup; name the responsible operator and acceptable RPO/RTO. Prepare and approve a recovery runbook covering maintenance/write pause, exact backup/version selection, database plus private-object restore, server secret re-binding, exact backend target check, Save/Reload/Share/lead smoke verification and reopening. Prove a restore in an explicitly authorized isolated recovery environment; do not restore or mutate the live project as part of this QA.
5. Keep live email deferred. If required for launch: privately configure the Piscine Wellness verified sender, Resend key and webhook secret, deployed webhook/worker scheduling; separately authorize controlled delivery tests and verify accepted/sent/delivered/bounced. Until then designate a durable-lead review/response operator so saved commercial requests are not unattended.

No known reproducible application defect was introduced or corrected by this read-only specialist. The items above are evidence gaps and concrete prelaunch content/operations blockers, not a claim that the whole configurator is production-ready.
