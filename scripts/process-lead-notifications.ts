import { processLeadNotification } from "../src/lib/lead/leadNotification.server";
import { recoverOrphanNotifications, dueNotificationIds } from "../src/lib/lead/notificationQueue.server";

// Server-only worker; no public retry endpoint. Schedule in the deployment environment.
await recoverOrphanNotifications();
for (const request_id of await dueNotificationIds()) {
  const result = await processLeadNotification(request_id);
  console.log(JSON.stringify({ requestId: request_id, state: result.state }));
}
