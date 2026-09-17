-- P6B: private attachment storage for POOL-SHAPER project references
-- (site photos, architectural plans) plus the `attachments` column on
-- `leads` that records the final, successfully-stored attachment
-- metadata a submission actually references. Not yet applied to any
-- live project in this environment -- see the P6B report (same
-- Supabase-quota blocker as P6A's leads table). Apply alongside
-- 0001_create_leads_table.sql once a dedicated project exists, then set
-- SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY -- no code change needed.

insert into storage.buckets (id, name, public)
values ('pool-shaper-attachments', 'pool-shaper-attachments', false)
on conflict (id) do nothing;

-- No storage.objects policies are created for this bucket: storage.objects
-- has RLS enabled by default, and with zero policies only the
-- service-role key (server-side only, per src/lib/lead/attachmentStorage.ts's
-- getServerEnv) can read, write or list objects in it -- the
-- publishable/anon key gets nothing. Object paths are
-- `${projectId}/${randomUUID}-${sanitizedOriginalName}`: scoped per
-- project and non-guessable, never derived from anything public.

alter table public.leads
  add column if not exists attachments jsonb not null default '[]'::jsonb;

comment on column public.leads.attachments is
  'Array of {name, storagePath, mimeType, size} for attachments that '
  'actually completed a real upload to the pool-shaper-attachments '
  'bucket -- never local-only blob: references or unvalidated client claims.';

-- Cleanup strategy (manual for now, no scheduled job in this pass): when
-- a lead is deleted, its objects under `${project_id}/` in
-- pool-shaper-attachments should be removed too. A trigger/Edge Function
-- can be added once the dedicated project exists; documented here rather
-- than implemented against a project that isn't provisioned yet.
