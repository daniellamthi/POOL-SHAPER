-- Private server-side ownership, atomic eight-slot ledger, durable notification queue.
create table public.attachment_owners (
  project_id text primary key check (project_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  owner_hash text not null check (owner_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create table public.attachment_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.attachment_owners(project_id),
  slot smallint not null check (slot between 1 and 8),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size integer not null check (size between 1 and 10485760),
  storage_path text not null unique,
  grant_hash text not null check (grant_hash ~ '^[0-9a-f]{64}$'),
  granted_until timestamptz not null,
  lease_until timestamptz,
  state text not null check (state in ('reserved','uploading','complete','failed')),
  created_at timestamptz not null default now(),
  unique (project_id,slot),
  unique (project_id,content_hash)
);
create table public.lead_notifications (
  request_id uuid primary key references public.leads(request_id),
  submission jsonb not null,
  payload jsonb,
  state text not null default 'pending' check (state in ('pending','processing','accepted','sent','delivered','bounced','failed','blocked')),
  attempts integer not null default 0,
  retryable boolean not null default true,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  provider_id text unique,
  last_event_at timestamptz,
  error_code text,
  updated_at timestamptz not null default now()
);
create index lead_notifications_due_idx on public.lead_notifications(next_attempt_at) where state in ('pending','failed','processing');
create table public.notification_events (
  event_id text primary key,
  provider_id text not null,
  state text not null,
  occurred_at timestamptz not null
);
alter table public.leads add column project_reference text;
alter table public.attachment_owners enable row level security;
alter table public.attachment_uploads enable row level security;
alter table public.lead_notifications enable row level security;
alter table public.notification_events enable row level security;
revoke all on public.attachment_owners, public.attachment_uploads, public.lead_notifications, public.notification_events from public,anon,authenticated;
grant all on public.attachment_owners, public.attachment_uploads, public.lead_notifications, public.notification_events to service_role;

create function public.claim_attachment_owner(p_project text,p_hash text,p_ref text default null,p_edit_hash text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare current_hash text; recovered boolean;
begin
  if p_project !~ '^[A-Za-z0-9_-]{1,100}$' or p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project,0));
  select owner_hash into current_hash from public.attachment_owners where project_id=p_project;
  if current_hash=p_hash then return true; end if;
  recovered := exists(select 1 from public.projects where project_id=p_project and public_ref=p_ref and edit_token_hash=p_edit_hash);
  if current_hash is not null and not recovered then return false; end if;
  if current_hash is null and not recovered and (
    exists(select 1 from public.projects where project_id=p_project) or
    exists(select 1 from public.leads where project_id=p_project)
  ) then return false; end if;
  insert into public.attachment_owners(project_id,owner_hash) values(p_project,p_hash)
    on conflict(project_id) do update set owner_hash=excluded.owner_hash;
  return true;
end $$;

create function public.reserve_attachment(p_project text,p_owner text,p_content text,p_name text,p_mime text,p_size integer,p_grant text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item public.attachment_uploads; free_slot integer; new_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project,0));
  if not exists(select 1 from public.attachment_owners where project_id=p_project and owner_hash=p_owner) then raise exception 'Attachment owner rejected' using errcode='42501'; end if;
  if p_content !~ '^[0-9a-f]{64}$' or p_grant !~ '^[0-9a-f]{64}$' or length(p_name)>120 then raise exception 'Invalid upload'; end if;
  select * into item from public.attachment_uploads where project_id=p_project and content_hash=p_content for update;
  if found then
    if item.state='complete' then return pg_catalog.to_jsonb(item); end if;
    if item.state='uploading' and item.lease_until>now() then return pg_catalog.jsonb_build_object('state','busy'); end if;
    update public.attachment_uploads set state='reserved',grant_hash=p_grant,granted_until=now()+interval '5 minutes',lease_until=null
      where id=item.id returning * into item;
    return pg_catalog.to_jsonb(item);
  end if;
  select n into free_slot from pg_catalog.generate_series(1,8) n
    where not exists(select 1 from public.attachment_uploads where project_id=p_project and slot=n) order by n limit 1;
  if free_slot is null then return pg_catalog.jsonb_build_object('state','full'); end if;
  new_id:=gen_random_uuid();
  insert into public.attachment_uploads(id,project_id,slot,content_hash,name,mime_type,size,storage_path,grant_hash,granted_until,state)
    values(new_id,p_project,free_slot,p_content,p_name,p_mime,p_size,p_project||'/'||new_id::text||'-'||pg_catalog.regexp_replace(p_name,'[^a-zA-Z0-9._-]','_','g'),p_grant,now()+interval '5 minutes','reserved') returning * into item;
  return pg_catalog.to_jsonb(item);
end $$;

create function public.consume_attachment_grant(p_id uuid,p_owner text,p_grant text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare changed uuid;
begin
  update public.attachment_uploads u set state='uploading',lease_until=now()+interval '2 minutes'
    where u.id=p_id and u.state='reserved' and u.grant_hash=p_grant and u.granted_until>now()
      and exists(select 1 from public.attachment_owners o where o.project_id=u.project_id and o.owner_hash=p_owner)
    returning id into changed;
  return changed is not null;
end $$;

create function public.claim_lead_notification(p_request uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item public.lead_notifications;
begin
  -- Never retry an uncertain send outside Resend's 24-hour idempotency window.
  update public.lead_notifications set state='blocked',retryable=false,error_code='IDEMPOTENCY_WINDOW_EXPIRED'
    where request_id=p_request and first_attempt_at<now()-interval '23 hours' and state in ('failed','processing') and provider_id is null;
  update public.lead_notifications set state='processing',lease_token=p_lease,lease_until=now()+interval '1 minute',
    attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now()
    where request_id=p_request and next_attempt_at<=now() and attempts<5 and (
      (state in ('pending','failed') and retryable) or (state='processing' and lease_until<now())
    ) returning * into item;
  if not found then return null; end if;
  return pg_catalog.to_jsonb(item);
end $$;

create function public.record_notification_event(p_event text,p_provider text,p_state text,p_at timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if p_state not in ('sent','delivered','bounced','failed') then return false; end if;
  insert into public.notification_events(event_id,provider_id,state,occurred_at) values(p_event,p_provider,p_state,p_at) on conflict do nothing;
  if not found then return false; end if;
  update public.lead_notifications set state=p_state,last_event_at=p_at,updated_at=now(),retryable=false
    where provider_id=p_provider and (last_event_at is null or last_event_at<=p_at)
      and not (state in ('delivered','bounced') and p_state='sent');
  return true;
end $$;

revoke all on function public.claim_attachment_owner(text,text,text,text), public.reserve_attachment(text,text,text,text,text,integer,text),public.consume_attachment_grant(uuid,text,text),public.claim_lead_notification(uuid,uuid),public.record_notification_event(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_attachment_owner(text,text,text,text), public.reserve_attachment(text,text,text,text,text,integer,text),public.consume_attachment_grant(uuid,text,text),public.claim_lead_notification(uuid,uuid),public.record_notification_event(text,text,text,timestamptz) to service_role;
