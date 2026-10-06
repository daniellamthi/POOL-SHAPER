-- Build 2 · Project delivery: durable, shareable projects.
--
-- One row per saved project. `snapshot` is the canonical
-- ProjectConfiguration (src/lib/pool/project.ts) exactly as the configurator
-- produced it -- the same object the 3D scene, Summary, Project Book PDF and
-- quote request read. No second representation of the configuration lives
-- here.
--
-- Access model (capability tokens, no customer accounts yet):
--   * public_ref  -- the customer/sales-facing project ID (PW-XXXX-XXXXXX),
--                    50 random bits: unguessable, never sequential, safe to
--                    print on the PDF and to put in a share URL. It grants
--                    READ of the snapshot only, and only while share_enabled.
--   * edit token  -- 256 random bits, returned once to the browser that
--                    created the project. Only its SHA-256 is stored here.
--                    It is required to update the row.
--
-- The browser never talks to this table. All reads and writes go through
-- the app's server functions (src/lib/project-delivery/) using the
-- service-role key, which bypasses RLS. RLS is enabled with zero policies
-- and table privileges are revoked from anon/authenticated, so the
-- publishable key can neither list, read, insert, update nor delete rows.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique
    check (public_ref ~ '^PW-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{6}$'),
  project_id text not null,
  edit_token_hash text not null check (edit_token_hash ~ '^[0-9a-f]{64}$'),
  snapshot_version integer not null,
  snapshot jsonb not null,
  share_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_project_id_idx on public.projects (project_id);

create or replace function public.projects_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.projects_touch_updated_at();

alter table public.projects enable row level security;
revoke all on table public.projects from anon, authenticated;
-- No policies: with RLS enabled and none defined, every non-bypass role is
-- denied. Only the service role (server-side secret) reaches this table.
