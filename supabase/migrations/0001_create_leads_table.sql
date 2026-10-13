-- P6A durable lead storage. Not yet applied to any live project in this
-- environment (see the P6A report: blocked by the connected Supabase
-- account's 2-project free-tier quota). Apply this to whichever project
-- is designated for POOL-SHAPER once one is available, then set
-- SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only secret) so
-- src/lib/lead/storage.ts picks it up automatically -- no code change
-- needed.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  idempotency_key text not null unique,
  project_id text not null,
  schema_version integer not null,
  created_at timestamptz not null default now(),

  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  project_location text not null,
  timing text not null,
  notes text,

  privacy_accepted boolean not null,
  marketing_consent boolean not null,

  -- The complete canonical ProjectConfiguration (P1) as submitted --
  -- dimensions, system, overflow variant, coping, liner/mosaic, pool
  -- access, LED/RGB, features/equipment, renovation data.
  project_configuration jsonb not null,

  status text not null default 'pending' check (status in ('pending', 'email_sent', 'email_failed')),
  email_error text,
  email_sent_at timestamptz
);

create index if not exists leads_project_id_idx on public.leads (project_id);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

-- No policies are created: with RLS enabled and zero policies, only
-- requests carrying the service-role key (server-side only, per
-- src/lib/lead/storage.ts's getServerEnv) can read or write this table --
-- the publishable/anon key gets nothing. This is deliberate: leads
-- contain personal data and must never be reachable from the browser.
