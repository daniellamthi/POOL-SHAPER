-- A forged extra save with the same internal projectId must not grant attachment ownership.
create or replace function public.claim_attachment_owner(p_project text,p_hash text,p_ref text default null,p_edit_hash text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare current_hash text; recovered boolean;
begin
  if p_project !~ '^[A-Za-z0-9_-]{1,100}$' or p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project,0));
  select owner_hash into current_hash from public.attachment_owners where project_id=p_project;
  if current_hash=p_hash then return true; end if;
  recovered := exists(select 1 from public.projects where project_id=p_project and public_ref=p_ref and edit_token_hash=p_edit_hash
    and public_ref=(select public_ref from public.projects where project_id=p_project order by created_at,id limit 1));
  if current_hash is not null and not recovered then return false; end if;
  if current_hash is null and not recovered and (
    exists(select 1 from public.projects where project_id=p_project) or
    exists(select 1 from public.leads where project_id=p_project)
  ) then return false; end if;
  insert into public.attachment_owners(project_id,owner_hash) values(p_project,p_hash)
    on conflict(project_id) do update set owner_hash=excluded.owner_hash;
  return true;
end $$;
revoke all on function public.claim_attachment_owner(text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_attachment_owner(text,text,text,text) to service_role;
