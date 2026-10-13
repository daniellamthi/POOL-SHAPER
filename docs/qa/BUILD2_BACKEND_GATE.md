# BUILD 2 backend gate - recovery closeout, updated 2026-10-11

## Status: PASS — FINAL CLOUD GATE (email live DEFERRED by owner)

The final cloud evidence at the end supersedes the historical pre-credential BLOCKED entries below. The owner explicitly excluded real email sending from this gate. This is an authorized local frontend connected to the real POOL-SHAPER Supabase project, not a production deployment.

This is local development plus explicitly identified live database checks, not production verification or deployment. No skipped check is counted as PASS.

Repository: daniellamthi/POOL-SHAPER.
Branch: claude/pool-shaper-build2-project-delivery.
Verified local and remote base: 46dc9c82e524b253e5f1ce3ff3907e8cfa1aaf72.
Persistent checkout: /Users/danielelamthi/Documents/Codex/2026-09-14/rendi-la-immagine-1-piu-relistica-4/pool-shaper-build2-recovered-20261010.

## Recovery

PASS: 36 original apply_patch calls affecting 41 code/test/report/migration files were recovered verbatim from the original local session record. All applied cleanly to the verified remote base. No reset, checkout over WIP or destructive cleanup was performed. The original temporary checkout and temporary screenshot/matrix evidence remain unavailable. Credentials were not recovered from conversation text.

The pre-recovery report is preserved outside git in ../build2-recovery-evidence/BUILD2_BACKEND_GATE.pre-recovery.md. This report supersedes its historical claims for the current gate.

## Historical destination and credentials (pre-credential phase)

PASS: connector Daniele 2 explicitly selected (link ending 257bc6b1); project Configuratore piscine wellness, waetxxqdlsuanqescuye, ACTIVE_HEALTHY. Only https://waetxxqdlsuanqescuye.supabase.co is permitted by the server factories.

BLOCKED: the new ignored .env.local has URL configured, permissions 0600 and an empty SUPABASE_SERVICE_ROLE_KEY. The owner must enter a valid server key privately there. QA notification sending is disabled. Resend API key, verified Piscine Wellness sender and webhook signing secret are not configured. No real business/customer email has been sent.

## Historical local-phase requirement evidence (before credentials; superseded below)

| Gate | Status | Evidence |
|---|---|---|
| Original WIP recovery | PASS | 36 patch calls, 41 recovered files; new persistent clone, original records untouched. |
| Preserve approved 3D / wizard | PASS | Approved access/comfort/floor solids, camera system and shaders unchanged. The separately requested optional stair micro-spots reuse the existing small satin/warm fitting; no extra real lights or shadows. Seven-phase wizard preserved. |
| Migrations | PASS | Existing six live migrations not repeated. New status-sync migration applied only to authorized project; recovered new filenames aligned to actual remote migration versions. |
| Upload ownership/security | PASS local; BLOCKED live re-verification | Target lock, fail-closed factories, MIME/extension/signature, quota failure, owner-ledger verification, duplicate/cross-project references and traversal regression tests pass. Atomic ledger, single-use grants and interrupted-upload recovery code recovered; current live concurrency/Storage run needs server credentials. |
| Email application pipeline | PASS local | 20 mocked workers -> one provider POST; frozen canonical payload/idempotency key, retries, failure retention, Project ID and fixed business recipient verified. Acceptance is not delivery. |
| Email state race | PASS live database | Transactional synthetic test: delivered -> late sync remains email_sent; bounced -> late sync remains email_failed. Test rolled back. Queue-to-lead lock order reviewed independently. |
| Worker starvation | PASS code review; BLOCKED REST test | Terminal records and processing with an active lease excluded before limit 25. New live 25-active-lease regression exists; current REST execution needs credentials. |
| Early webhook / replay | PASS local | Signature validated before lookup. Early authenticated webhook returns 503 (provider retry), then 200 after association; repeat event recorded once. Tampered, unsigned and stale signatures rejected. |
| Real Resend accepted/sent/delivered/bounced | BLOCKED | Missing authorized credentials and verified sender; fake provider tests are explicitly not real delivery evidence. |
| RLS / permissions | PASS new SQL privilege check; BLOCKED current full sessions | New sync RPC denied to anon/authenticated, service_role execute granted. Security advisor has only intentional INFO deny-all private-table notices. Prior 66 live checks are historical, not rerun in this gate; updated real-session test includes new RPC. |
| Dirty state after reload | PASS regression; BLOCKED cloud browser verification | Restored snapshot establishes normalized saved baseline. JSONB key order and legacy saved serialization do not mark dirty; actual dimension/optional edits do, shared read-only does not. Browser draft restores dimensions, stair selection and micro-spot/night state; a saved cloud-project reload still requires the server key. |
| Save / share / copy / version / identity | PASS local; BLOCKED live | A/B/C contract tests have zero mismatches; owner update cannot change projectId; invalid tokens fail; copy has new identity; public snapshots exclude contacts/uploads/unrecognized private fields. Live matrix still required. |
| Lead / quote pipeline | PASS local; BLOCKED live | Schema, privacy consent, email/template, duplicate durable storage contract and configuration tests pass. HTTP quote/DB persistence cannot be claimed from these unit tests. |
| Project Book PDF | PASS local contract; BLOCKED current browser export | A/B/C delivery and export-guard tests pass locally. Actual current browser PDF action correctly refuses when cloud save is unavailable: "Project Book non generato. Riprova." No current successful download is claimed. Two previously recovered seven-page PDFs remain historical evidence only. |
| Desktop 1440 x 900 | PASS local UI/error path; BLOCKED full cloud E2E | Runtime optional ON/OFF, corner and straight riser fittings, night/day and Summary checked. Empty quote form displays required-field/privacy errors. Valid synthetic QA form receives storage-unavailable error and retains all fields. A/B/C live matrix not completed. |
| Mobile 390 x 844 | PASS local UI; BLOCKED full cloud E2E | Micro-spot card/state and access inspection checked; quote error/data retention and scrollable modal inspected. No successful cloud delivery claimed. |
| Mobile 430 x 932 | PASS local UI; BLOCKED full cloud E2E | Micro-spot card/state and access inspection checked; quote error, retry control and retained synthetic fields inspected. No successful cloud delivery claimed. |
| Server / preview | PASS runtime | Browser access works on October 11. Stale Vite server was restarted in the persistent checkout; preview is http://127.0.0.1:3001/. Runtime corner/straight stair images were captured and inspected. |
| Credentials in client | PASS static scan | 15 production JS bundles: no sb_secret_, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY or RESEND_WEBHOOK_SECRET. Actual configured-secret scan remains blocked until private server credential is supplied. |
| Independent security review | PASS code review | No concrete P1/P2 remaining in email/upload scope. No reviewer live calls or secret reads. |
| Typecheck / production build / diff-check | PASS local | October 11 tsc --noEmit, Vite production build and git diff --check pass. Existing bundle-size/deprecation warnings are not optimized in this scope. |
| Optional stair micro-spots | PASS targeted/local runtime | 496 configurations / 2,530 riser fittings across sizes 6x3 to 12x5, flat/slope, Skimmer/Infinity/above-ground, mirrored access and supported comfort. Approved access/comfort/wall-LED plans remain identical with optional ON/OFF. Snapshot, quote, Summary/PDF model and Photo Spec preserve it. Corner 11 fittings and straight 6 fittings inspected at night; OFF returns to day and removes fittings. Removing the internal stair while retaining the optional flag cannot advertise nonexistent fittings in Summary/PDF, email, wizard or Photo Spec. Presentation resets to daylight when no usable LEDs remain; runtime Summary now agrees with the scene after switching to inox-only access. |
| Commit / push | BLOCKED by full gate | No commit or push; base HEAD and remote still identical. No merge/deploy. |

## Executed local checks

- npx --no-install tsc --noEmit
- npm run build
- test:attachments, test:lead-storage, test:lead-pipeline, test:project-config
- test:persistence, test:export-guard, test:project-delivery
- node scripts/run-backend-security-audit.mjs
- node scripts/run-email-notification-audit.mjs
- git diff --check
- Production client secret-identifier scan (15 bundles)
- October 11: all listed targeted local suites rerun for recovered WIP plus new optional; no live flags supplied and no local PASS represented as production verification.
- node scripts/run-stair-lighting-audit.mjs (496 configurations, 2,530 fittings)
- Current browser: optional stair lighting, draft reload, Summary, missing-backend save/PDF refusal, quote validation/error retention; desktop 1440x900 and mobile 390x844 / 430x932.

## Current runtime evidence (2026-10-11)

Screenshots are outside the repository in `../build2-recovery-evidence/20261011/`:

- `corner-microspots-desktop-night.jpg`, `linear-microspots-desktop-night.jpg`
- `corner-microspots-off.jpg`, `corner-microspots-day-mobile430.jpg`
- `corner-microspots-mobile390-access.jpg`, `corner-microspots-mobile430-access.jpg`
- `cloud-save-unconfigured-desktop.jpg`
- `quote-error-retains-data-desktop.jpg`, `quote-error-mobile390.jpg`, `quote-error-mobile430.jpg`
- `removed-stairs-no-phantom-summary.jpg` (inox-only access, no phantom micro-spot row, Summary Giorno)

Use the existing **Vista piscina -> Accesso** inspection for close-up evidence. The default lighting framing remains the approved camera system and can be distant; no camera redesign or approved geometry alteration was made. A current seven-page browser PDF, exact persisted rows, concurrent Storage calls and real-session RLS remain BLOCKED, not inferred from screenshots or mocked tests.

No new application dependency added. npm ci used the existing lockfile and an isolated writable cache; package.json/package-lock.json unchanged.

## Historical remaining actions (superseded by final cloud gate)

1. Owner: enter correct server key privately in the persistent checkout's ignored .env.local. Never paste it in chat.
2. Browser access is restored. After the server key is configured, finish A/B/C Save -> Reload -> Share -> Read-only -> Save Copy -> PDF -> Quote at all three viewports. Do not replace browser evidence with server-only checks.
3. Run recovered live upload concurrency, live notification state/worker and real Auth/anon RLS tests; verify exact persisted snapshots/lead identity and clean disposable QA data after evidence.
4. Owner explicitly deferred piscinewellness.com sender/domain setup until the site is ready. Keep email application code and tests ready; actual Resend accepted/sent/delivered/bounced stays BLOCKED until authorized credentials, verified sender, signing secret and operational worker/webhook wiring exist. The connected Resend account currently only exposes an unrelated verified domain; it was not used. No customer/business email was sent.
5. Commit/push only after every required gate passes, on the same feature branch.

Advisor reference: [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is intentional deny-all for these server-only tables.

## Final cloud gate — 2026-10-11

Daniele 2 was explicitly selected with link_id ending `257bc6b1`; `get_project` confirmed `waetxxqdlsuanqescuye`, Configuratore piscine wellness, ACTIVE_HEALTHY. The ignored 0600 `.env.local` credential successfully authenticated REST to that exact target (HTTP 200). No credential is recorded here. No migration was repeated.

| Requirement | Status | Current evidence |
|---|---|---|
| Cloud connection / durable persistence | PASS | Real Supabase rows, durable store; no memory fallback. |
| Upload concurrency / ownership / recovery | PASS live | 12 simultaneous distinct requests create exactly 8 objects; 8 duplicate replays return one object. Wrong owner, reused/expired grants and forged owner recovery rejected. Definitive failures release slots; uncertain transport retains a recoverable reservation. Disposable objects/ledgers cleaned. |
| RLS / real sessions | PASS live | 68 checks through real anon/authenticated REST sessions: private tables/RPCs denied; private leads and object read/overwrite/delete protected. Test session revoked, user and object removed. |
| Notification durability / retries | PASS live database, mocked provider | 20 workers create one mocked provider send; accepted/sent/delivered/bounced distinguished; retry payload/key stable. 26 terminal records and 25 active leases cannot starve pending work; late sync preserves delivery/bounce evidence. QA rows cleaned. No real Resend call. |
| Email live | DEFERRED, NOT TESTED | Owner requested no real emails and domain setup later. Missing sender/credentials produce `EMAIL_NOT_CONFIGURED`, not fictitious delivery. |
| Save / Reload / Share / Read-only / Save Copy | PASS browser + database | Nine cases below; source links opened read-only, copies created through UI with new identity. Share action confirmed. Reload restores the correct copy, owner and configuration with no false dirty state. |
| Exact snapshot / quote identity / privacy | PASS live | New browser-cloud audit confirms nine exact normalized snapshot matches, correct Project ID/reference, exactly one lead/outbox per submission, consent retained, contacts absent from public snapshots. Invalid edit token rejected and persisted snapshot unchanged in every case. |
| Browser PDF | PASS | Nine real browser downloads, each seven pages; correct Project ID, Day/Night text and image assets, no credentials. All seven A pages and scenario-specific B/C technical/presentation pages rendered and inspected; no clipping/overlap in inspected layouts. Approved Infinity composition/camera preserved. |
| Desktop 1440x900 | PASS | A/B/C full browser flow and confirmation screenshots. |
| Mobile 390x844 | PASS | A/B/C full browser flow, scrolling controls and confirmation screenshots. |
| Mobile 430x932 | PASS | A/B/C full browser flow, scrolling controls and confirmation screenshots. |
| Stair micro-spots / night persistence | PASS local geometry + cloud browser | Existing 496 configurations / 2,530 fittings remain valid. Cloud project PW-GBYM-YHE13F restores optional + Night, then linear/corner changes are saved and reloaded with clean baseline; 6/11 riser fittings checked using the approved Accesso inspection. |
| Secret exposure | PASS | Production build with real server credential configured: 15 public JS bundles, zero secret values/identifiers. Server credential remains ignored and 0600. |
| Typecheck / build / diff-check | PASS | Rechecked after the scoped copy-URL correction. No dependency change, geometry/shader/camera redesign, merge or deploy. |

### Actual browser matrix

Each row completed read-only source -> Save Copy -> Reload -> Share -> PDF -> Quote. The source fixtures were prepared through the existing durable API; all copies and quote submissions were made through the real browser UI.

| Project | Viewport | Source ref | Browser copy / PDF ref |
|---|---|---|---|
| A: 8x4 Skimmer | 1440x900 | PW-M53F-P7KM28 | PW-E8RC-Q6TX5H |
| B: 12x5 Infinity | 1440x900 | PW-37KC-C5MQFB | PW-B6Y7-K5CJB1 |
| C: above-ground, panels/stair/Pellicano | 1440x900 | PW-MNKK-E8BCDE | PW-RP42-M5TKQG |
| A | 390x844 | PW-M53F-P7KM28 | PW-M8JY-6D3WW3 |
| B | 390x844 | PW-37KC-C5MQFB | PW-P4QK-8HTA2Q |
| C | 390x844 | PW-MNKK-E8BCDE | PW-4V1C-NYT58J |
| A | 430x932 | PW-M53F-P7KM28 | PW-2X38-6JCXWR |
| B | 430x932 | PW-37KC-C5MQFB | PW-RRFW-QKAMQ1 |
| C | 430x932 | PW-MNKK-E8BCDE | PW-0QYC-TDQ3ZJ |

### Verified defect corrected

Save Copy originally persisted a new copy while keeping the original `?p=` URL; browser reload consequently reopened the source. Successful saves now update only the current public reference via history.replaceState, retaining preview query/hash context and exposing no edit token. Regression assertions cover first save and copied-reference URLs. All nine browser reloads then passed.

### Final evidence and reproduction

- `node scripts/run-upload-concurrency-live-audit.mjs` — PASS live, cleanup verified.
- `node scripts/run-notification-live-audit.mjs` — PASS live queue / mocked email provider only, cleanup verified.
- `BACKEND_QA_PUBLIC_KEY=<publishable key> node scripts/run-build2-final-rls.mjs` — 68 PASS live checks, QA session/user revoked/removed.
- `BROWSER_GATE_CASES=<JSON matrix above> node scripts/run-browser-cloud-gate-audit.mjs` — 9 PASS, zero identity/snapshot mismatches, privacy and bad-token checks.
- PDF binary/text/images inspected using pdfinfo, pypdf and pdftoppm; nine browser downloads are in the local Downloads folder, not git.
- New screenshot evidence remains outside git in `../build2-recovery-evidence/20261011/`: `cloud-{A,B,C}-{1440,390,430}-saved.jpg` / `-quote.jpg` (desktop A uses `cloud-A-desktop-*`), plus `cloud-linear-microspots-night.jpg` and cloud corner capture.
- Missing-backend/error-retention evidence and prior local regression suites are retained above; they are not represented as production verification.

PASS: the nine verified synthetic QA leads/outboxes were cleaned using `BROWSER_GATE_CLEANUP_LEADS=1`, after all evidence checks passed. The audit validates their QA name/email/note and deletes only exact request IDs; each lead's absence was verified. This prevents future real email notifications from QA entries. No real customer records were touched. Synthetic saved projects remain available for preview/review.

Remaining owner action: configure the Piscine Wellness sender/Resend later. This deferred email activation is not a blocker for the explicitly agreed final cloud gate. Production deployment remains unperformed.
