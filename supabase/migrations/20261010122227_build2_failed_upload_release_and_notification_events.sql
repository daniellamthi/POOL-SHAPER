create function public.release_failed_attachment(p_id uuid,p_owner text,p_grant text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare removed uuid;
begin
  -- Caller must first prove Storage definitively rejected the write and the object is absent.
  delete from public.attachment_uploads u where u.id=p_id and u.state='failed' and u.grant_hash=p_grant
    and exists(select 1 from public.attachment_owners o where o.project_id=u.project_id and o.owner_hash=p_owner)
    returning id into removed;
  return removed is not null;
end $$;
revoke all on function public.release_failed_attachment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.release_failed_attachment(uuid,text,text) to service_role;

create or replace function public.record_notification_event(p_event text,p_provider text,p_state text,p_at timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare request uuid;
begin
  if p_state not in ('sent','delivered','bounced','failed') then return false; end if;
  insert into public.notification_events(event_id,provider_id,state,occurred_at) values(p_event,p_provider,p_state,p_at) on conflict do nothing;
  if not found then return false; end if;
  update public.lead_notifications set state=p_state,last_event_at=p_at,updated_at=now(),retryable=false
    where provider_id=p_provider and (last_event_at is null or last_event_at<=p_at)
      and not (state in ('delivered','bounced') and p_state='sent') returning request_id into request;
  if request is not null then
    update public.leads set status=case when p_state in ('sent','delivered') then 'email_sent' else 'email_failed' end,
      email_error=case when p_state in ('bounced','failed') then 'PROVIDER_'||upper(p_state) else null end,
      email_sent_at=case when p_state in ('sent','delivered') then coalesce(email_sent_at,now()) else email_sent_at end
      where request_id=request;
  end if;
  return true;
end $$;
revoke all on function public.record_notification_event(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_notification_event(text,text,text,timestamptz) to service_role;
