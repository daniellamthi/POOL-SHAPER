# D — Exact hosted candidate delivery preparation

2026-10-20. Exact preview candidate: `6ad89bdd5347017ea9a4ced72caf9783b771bf76`.
URL: https://pool-shaper-9qeaubbxt-daniellamthis-projects.vercel.app

Parent has now actually opened this preview in the integrated browser. This
supersedes the earlier access-blocked observation; it is not evidence that its
cloud-delivery environment is configured. E currently owns the browser; D has
not navigated, submitted a lead or written a hosted project in this preparation.

## Destination / durability gate before any hosted write

Read exact existing server source only; none of these files has a local diff:

- `supabase-target.server.ts` accepts only the exact URL
  `https://waetxxqdlsuanqescuye.supabase.co` and otherwise throws.
- `getProjectStore()` and `getLeadStore()` call that guard before constructing
  their durable Supabase adapters; missing credentials throw. Their memory
  classes are explicit test fixtures, not a production fallback.
- `backendCredentials()` repeats the same destination guard for notification
  and attachment RPC/REST helpers. No credential value was read or exposed.

An ordinary hosted Save is therefore safe against accidental writes to a
different Supabase project: it either uses the locked target or fails closed.
Actual hosted credential availability still requires its real Save result and
an exact generated-reference read in Daniele 2, `waetxxqdlsuanqescuye`.
No public backend/notification configuration-status endpoint was found.

## Separate email safety prerequisite

`submitLead.server.ts` persists first, then automatically calls
`processLeadNotification()`. That function skips provider sending only when its
configuration is invalid/missing or `LEAD_NOTIFICATIONS_QA_DISABLED === "true"`.
Local QA-disabled evidence does **not** prove that condition on Vercel.

Before pressing hosted Submit, require non-secret existing-deployment evidence
that QA disable is true or the provider configuration is absent/invalid. Do
not infer it from an unsent local quote, the synthetic recipient, deferred
domain plans or a null provider ID on an older row. Do not fetch/print keys,
change environment variables, or submit first to discover whether it sends.
Save/Reload/Share/Copy/PDF can proceed independently. Hosted quote remains
**NOT VERIFIED pending this safety prerequisite**, not a product failure.

## One scoped hosted chain, not a repeat of five local-cloud paths

After explicit browser handoff and performance quiet window: use a synthetic
QA project through ordinary public UI; preserve all user tabs/drafts. Record
actual selected dimensions/options, source and copy public refs, Project IDs,
the UI's saved/reloaded status and seven-page PDF path. Open the shared link
in a genuinely non-owner QA context; another same-origin owner tab is not a
read-only test. No edit token or private browser storage is included in output.

Only if the email gate above is established: fill a synthetic QA quote with
privacy consent and ordinary validation/submission. No real customer contacts
or email delivery. Use a normal bounded PDF click followed by a separate UI
inspection and exact filename lookup; never CUA download event/path waiters.

## Prepared read-only SQL (not executed)

Use only the hosted browser-generated QA references. Connector must explicitly
be Daniele 2 (`link_6ac6a1212b9881919c404d54257bc6b1`); project
`waetxxqdlsuanqescuye`. No contacts/token hashes/unrelated rows returned.

```sql
select public_ref, project_id, snapshot_version, share_enabled,
       snapshot->>'projectId' = project_id as identity_matches,
       md5((snapshot - 'projectId')::text) as technical_fingerprint,
       snapshot #> '{config,dimensions}' as dimensions,
       snapshot #> '{config,features}' as features,
       not exists (
         select 1 from jsonb_each_text(snapshot #> '{config,customer}') c
         where coalesce(c.value, '') <> ''
       ) as public_customer_empty,
       jsonb_array_length(coalesce(snapshot #> '{config,uploads}', '[]'::jsonb)) = 0
         as public_uploads_empty
from public.projects
where public_ref in ('<HOSTED_QA_SOURCE>', '<HOSTED_QA_COPY>');

select s.public_ref as source, c.public_ref as copy,
       s.project_id <> c.project_id as distinct_identity,
       (s.snapshot - 'projectId') = (c.snapshot - 'projectId')
         as exact_technical_snapshot_equal
from public.projects s cross join public.projects c
where s.public_ref = '<HOSTED_QA_SOURCE>'
  and c.public_ref = '<HOSTED_QA_COPY>';
```

The canonical public source code allowlists `dimensions.sunShelfRun`, replaces
all customer fields with their empty defaults, strips uploads and excludes
renovation free text. Verify the exact snapshots/fingerprints, not just a few
visible options. If the selected hosted case includes a shelf run, assert its
actual value explicitly after restore/copy/PDF.

After an authorized no-email hosted quote, compare only the generated request
to its exact saved project. Remove private `config.customer` from that technical
comparison because the lead intentionally retains synthetic contact data:

```sql
select l.request_id, l.project_id, l.project_reference, l.status,
       l.project_configuration->>'projectId' = l.project_id as identity_matches,
       (l.project_configuration #- '{config,customer}') =
         (p.snapshot #- '{config,customer}') as exact_technical_identity,
       l.privacy_accepted,
       n.state as notification_state, n.attempts,
       n.error_code, n.provider_id is null as no_provider_send,
       (select count(*) from public.leads x where x.request_id=l.request_id)
         as lead_count,
       (select count(*) from public.lead_notifications x where x.request_id=l.request_id)
         as outbox_count
from public.leads l
join public.projects p on p.public_ref=l.project_reference
left join public.lead_notifications n using (request_id)
where l.request_id='<HOSTED_QA_REQUEST_UUID>'::uuid;
```

No hosted-chain PASS, SQL result, deployment email-safety PASS or new runtime
claim is made by these prepared source checks.

## Actual hosted failure / one scoped database read

Parent subsequently used the real accessible IAB preview at exact 6ad89bd.
Opening `?p=PW-A24Y-7CDSQC` did not restore that known QA project. Parent then
configured a synthetic 8×4×1.5 Skimmer project through the public wizard and
clicked Save exactly once. It completed with the storage-unavailable alert,
no saved public reference, and retained its selected values. Parent evidence:
`residual-hosted-save-error.png` and `residual-hosted-save-error-dom.txt`.
These are actual hosted failures, not a local test substitution. D did not
operate the browser.

At parent's request D executed **one SELECT of that exact known publicRef**
through the explicitly selected Daniele 2 connector / authorized project.
No customer contact/token field or unrelated row was queried. Result:

- Existing publicRef `PW-A24Y-7CDSQC`, Project ID
  `243e4207-54d7-45a2-9c36-9daafb5b462b`, snapshot version 1,
  sharing enabled and embedded project identity matches its row.
- 8×4×1.5 m, `sunShelfRun=3.2`, Skimmer, stored Mosaic 5 identifier,
  Sun Shelf / dedicated loungers / stair lighting.
- Exact technical MD5 `128943cf5b242927121a25a0c56785ba`, unchanged from
  the prior actual local-cloud chain. Last update
  `2026-10-20T14:47:09.909937Z`, before the hosted attempt.
- Every public customer field empty; public uploads empty.

Therefore the failed hosted restore is **not explained by that QA row being
missing, changed or share-disabled**. This read does not identify whether the
hosted cause is absent/mismatched environment configuration, connectivity or
another server-function failure. It also does **not** prove the new hosted Save
wrote no row: the failed action could have progressed partially before its
error, and no unknown/generated new Project ID was supplied for a scoped check.
No quote was submitted; the hosted no-email prerequisite remains unverified.

Existing authenticated GitHub CLI read deployment `7204470014` status:
success at `2026-10-20T15:52:46Z`, environment Preview. Its exposed `log_url`
is merely the public app URL, not a runtime-log endpoint. The already-verified
combined-status link identifies the actual deployment dashboard:
https://vercel.com/daniellamthis-projects/pool-shaper/A4MVGxvZHg3BFWWNdxvsvoZG1Soc
Parent can use its visible Logs/Runtime controls. No log URL was guessed, no
credential read, new authorization, deployment, environment change or database
write was performed by D.

## Hosted cause confirmed — environment configuration BLOCKED

Parent then opened the actual authenticated Vercel dashboard for deployment
`A4MVGxvZHg3BFWWNdxvsvoZG1Soc`, exact 6ad89bd. Actual runtime POST logs show:

- `2026-10-20T18:34:34.275Z`, shared load:
  `[project] storage failure Durable project storage is not configured.`
- `2026-10-20T18:38:22.558Z`, ordinary Save:
  the same durable-storage-not-configured error.

Parent evidence: `residual-hosted-runtime-cause.txt`. The project Environment
Variables panel was inspected with All Types / All Environments / All Editors,
no search filter, and displayed **No Environment Variables Added**. Non-secret
presence checks for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`LEAD_NOTIFICATIONS_QA_DISABLED` were all false. Evidence:
`residual-hosted-env-empty.png`. No value was revealed or changed.

This establishes the current exact hosted cloud-chain gate as **BLOCKED —
missing Preview server environment configuration**, not a missing QA database
row and not a code/runtime PASS. The source fails closed as designed; hosted
Save/Reload/Share/Copy/PDF/quote completion cannot be claimed from local proof.
The earlier one-Save observation is not retroactively labelled a successful
save. No additional database query or browser action is needed to identify
this cause.

Precise owner action already requested by parent: privately add the two
server-only Supabase variables for the authorized
`waetxxqdlsuanqescuye` target to **Preview only**, plus
`LEAD_NOTIFICATIONS_QA_DISABLED=true`, then notify parent “Preview configurata”.
Do not paste keys into chat, expose them through `VITE_*`, alter Production,
or treat a future deployment as already tested. Parent will establish the
new exact Preview SHA/environment before resuming the one hosted QA chain.
No environment change, secret access, deployment or email by D.
