import { backendRequest } from "../backend-db.server";
import { notificationStore } from "./leadNotification.server";

export async function recoverOrphanNotifications(): Promise<void> {
  const orphans = await backendRequest<Array<{ request_id: string }>>("/rest/v1/leads?select=request_id,lead_notifications(request_id)&lead_notifications=is.null&order=created_at.asc&limit=25");
  for (const { request_id } of orphans) await notificationStore.ensure(request_id);
}

export async function dueNotificationIds(): Promise<string[]> {
  const now = encodeURIComponent(new Date().toISOString());
  const rows = await backendRequest<Array<{ request_id: string }>>(`/rest/v1/lead_notifications?select=request_id&or=(state.in.(pending,failed),and(state.eq.processing,lease_until.lte.${now}))&retryable=eq.true&attempts=lt.5&next_attempt_at=lte.${now}&order=next_attempt_at.asc&limit=25`);
  return rows.map((row) => row.request_id);
}
