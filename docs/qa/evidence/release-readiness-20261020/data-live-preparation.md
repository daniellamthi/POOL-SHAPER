# D — Current candidate live-delivery handoff

2026-10-20. Scope: current feature candidate, not a repetition of Build 2.
Browser remains owned by root/performance until an explicit handoff. No live
write, browser interaction, migration, secret change or email performed by D.

## Verified prerequisites from current source and existing evidence

- Exact permitted connector: **Daniele 2**, link
  `link_6ac6a1212b9881919c404d54257bc6b1`, project
  `waetxxqdlsuanqescuye`. Never use another/default account.
- Existing D report establishes the private local server credential and QA
  notification disable; this is not deployed-runtime proof.
- `ProjectDelivery.tsx` exposes Save, Share and PDF by stable test IDs.
  Copy requires an unowned shared project; an owner opening its own URL is
  not a read-only/copy test. Use a separate QA origin/context, not a user draft.
- `useProjectDelivery.ts` coalesces concurrent saves, assigns a fresh identity
  when copying, replaces URL with the saved public reference and fingerprints
  canonical project data. DOM wording alone is not the canonical comparison.
- New `config.dimensions.sunShelfRun` must survive the public snapshot,
  reload, copy, summary, PDF and lead configuration. Local passing contracts
  cannot replace the remaining actual cloud/browser chain.

## Exact scoped database checks after browser creates references

Use only the browser-generated QA public references/request IDs. Do not query
or retain customer contacts, edit-token hashes, grant tokens or unrelated rows.
Record technical snapshot equality/fingerprints and required non-sensitive
fields. These are templates, **not executed results**:

```sql
select public_ref, project_id,
       snapshot->>'projectId' = project_id as identity_matches,
       snapshot_version, share_enabled,
       md5((snapshot - 'projectId')::text) as technical_fingerprint,
       snapshot #> '{config,dimensions}' as dimensions,
       snapshot #> '{config,features}' as features,
       jsonb_array_length(coalesce(snapshot #> '{config,uploads}', '[]'::jsonb)) = 0
         as public_uploads_empty
from public.projects
where public_ref in ('<QA_SOURCE_REF>', '<QA_COPY_REF>');
```

For source/copy exact technical equality:

```sql
select s.public_ref as source, c.public_ref as copy,
       s.project_id <> c.project_id as distinct_identity,
       (s.snapshot - 'projectId') = (c.snapshot - 'projectId')
         as exact_technical_snapshot_equal
from public.projects s cross join public.projects c
where s.public_ref = '<QA_SOURCE_REF>'
  and c.public_ref = '<QA_COPY_REF>';
```

Before/after the twenty navigation cycles and IT/EN switch, compare the same
saved project's canonical technical snapshot. Any intentional subsequent
dimension change must be separately recorded; do not call that a mismatch.

For a generated quote request:

```sql
select l.request_id, l.project_id, l.project_reference,
       l.project_configuration->>'projectId' = l.project_id as identity_matches,
       l.project_configuration #> '{config,dimensions}' as dimensions,
       l.project_configuration #> '{config,features}' as features,
       l.privacy_accepted, l.status,
       n.state as notification_state, n.attempts,
       n.provider_id is null as no_provider_send,
       count(*) over (partition by l.request_id) as request_row_count
from public.leads l
left join public.lead_notifications n using (request_id)
where l.request_id = '<QA_REQUEST_UUID>'::uuid;
```

Check the exact lead snapshot against the exact saved project snapshot and
source/copy unchanged fingerprints, not only a few visible options. Verify one
request/outbox after retry; no provider send may occur during this task.

## Browser evidence still required

Configure → Save → Reload → Share → separate-context read-only → Save Copy →
Reload → actual PDF download/pages/images/ID → quote validation/submission.
Cover requested main systems plus renovation and 1440/390/430, explicitly
labelling mobile viewport emulation. Capture no owner/upload tokens in files
or URLs. Synthetic QA contacts only; request reference is safe to record.

Current status: **NOT VERIFIED** for this new live chain. Ready for explicit
browser turn or exact generated QA identifiers from root.

## B04 — Backup metadata check (read-only, 2026-10-20)

**NOT VERIFIED.** Inspected the currently exposed Supabase tool catalogue for
backup/retention/restore metadata. No backup-list, retention or last-backup
read operation is available. The exposed `restore_project` mutates project
availability and is not a backup-evidence API; it was **not called**.

One exact authorized `get_project` request used Daniele 2 and
`waetxxqdlsuanqescuye`. It returned Configuratore piscine wellness,
`ACTIVE_HEALTHY`, region `eu-west-1`, PostgreSQL 17.11.0.003 and creation date,
but no backup schedule, retention, last-successful backup or restoration
evidence. Active health does not prove recoverability. No dump, restore,
migration, SQL change, credential read or browser navigation was performed.

Required owner/operations evidence before public release: the exact project's
Database Backups/PITR metadata (coverage, retention and last success), a
separate private-object backup strategy, responsible operator/RPO/RTO and an
approved isolated restore rehearsal. Do not infer Storage-object recovery
from the existence of a database backup. No restore is authorized here.
