-- Read the current outbox state under its row lock, never a stale worker result.
-- Queue -> lead lock order matches record_notification_event.
create function public.sync_lead_notification_status(p_request uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare notification public.lead_notifications%rowtype;
begin
  select * into notification from public.lead_notifications where request_id=p_request for update;
  if not found then return; end if;
  if notification.error_code='LEGACY_NOTIFICATION_ALREADY_SENT' then return; end if;
  update public.leads set
    status=case when notification.state in ('sent','delivered') then 'email_sent'
      when notification.state in ('failed','bounced','blocked') then 'email_failed' else 'pending' end,
    email_error=case when notification.state in ('bounced','failed','blocked') then
      coalesce(notification.error_code,'PROVIDER_'||upper(notification.state)) else null end,
    email_sent_at=case when notification.state in ('sent','delivered') then coalesce(email_sent_at,now()) else email_sent_at end
    where request_id=p_request;
end $$;
revoke all on function public.sync_lead_notification_status(uuid) from public,anon,authenticated;
grant execute on function public.sync_lead_notification_status(uuid) to service_role;
