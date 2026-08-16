/**
 * headless-task — the MODULE-SCOPE killed-app notification-action task.
 *
 * =============================================================================
 * WHY MODULE SCOPE (11-RESEARCH Pattern 4 / Pitfall P5): a killed-app action tap
 * loads the JS bundle in a HEADLESS context — React never mounts, no component
 * effect ever runs. The `addNotificationResponseReceivedListener` foreground
 * wiring (11-12) is a NO-OP in that context. Only a task DEFINED and REGISTERED
 * at module scope (`TaskManager.defineTask` + `Notifications.registerTaskAsync`)
 * survives process death and receives the response. App.tsx (11-13) imports this
 * module FOR ITS SIDE EFFECT — importing it registers the task; it runs NOTHING
 * else at import (no reconcile, no sweep — Pitfall P5).
 *
 * A2 DEVICE SPIKE (carried from 04-log F5): this path's FCM-less bring-up on the
 * release APK cannot be exercised in the JS/vitest harness (the native task
 * runtime is absent). It is proven on the physical Pixel — kill the app, tap
 * mark/snooze from the shade, and read the written row back via
 * `run-as com.bwales.orbit`. Nothing here requires FCM, but that must be shown
 * on-device, not asserted.
 *
 * DB BOOTSTRAP LIVES IN THE SHARED HANDLER (review H1): the task body does NOT
 * open the DB itself — `handleNotificationAction` awaits the idempotent
 * `openAndMigrate()` before `getExecutor()`. In a killed-app launch that await is
 * the ONLY thing that opens the DB, since App.tsx's open effect never runs here.
 *
 * ONLY THE WRITE + THE SINGLE CANCEL (Pitfall 5): the shared handler cancels the
 * acted-on `decay:<id>` for immediate NOTIF-03 suppression but deliberately does
 * NOT run a full reconcile from this headless process — with no mounted React
 * there is no guaranteed `ensureChannels()`, so scheduling from here could land a
 * notification on a not-yet-created (default/public) channel (the immutable-
 * channel privacy landmine). The post-snooze +1-week re-arm is launch-deferred to
 * the next foreground reconcile.
 * =============================================================================
 */
import { registerTaskAsync } from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Logger } from "@/utils/logger";
import { handleNotificationAction } from "./notification-actions";
import type { NotificationData } from "./notification-ids";

const LOG_SOURCE = "notif-headless";

/**
 * The permanent task id. Registered once at module scope; App.tsx imports this
 * module so the registration runs on every process start (headless or normal).
 */
export const NOTIFICATION_ACTION_TASK = "orbit-notification-action";

/**
 * The serialized notification RESPONSE the OS hands the background task: the
 * pressed `actionIdentifier` plus the notification, whose occurrence-scoped
 * payload lives at `notification.request.content.data`.
 */
interface HeadlessResponsePayload {
  actionIdentifier?: string;
  notification?: {
    request?: { content?: { data?: NotificationData } };
  };
}

// Module scope (NOT inside a component): defining + registering here is what lets
// a killed-app tap reach this code at all (Pitfall P5). The body does the bare
// minimum — parse the payload, funnel to the ONE exactly-once shared handler,
// done — guarded so a failure can never crash the headless context.
TaskManager.defineTask<HeadlessResponsePayload>(
  NOTIFICATION_ACTION_TASK,
  async ({ data, error }) => {
    if (error) {
      Logger.error(LOG_SOURCE, "headless task received an error", error);
      return;
    }
    try {
      const actionIdentifier = data?.actionIdentifier;
      const notifData = data?.notification?.request?.content?.data;
      if (!actionIdentifier || !notifData) {
        Logger.debug(LOG_SOURCE, "headless task: no action/data in payload");
        return;
      }
      // The shared handler bootstraps the DB (H1), dedups (H2), writes through
      // the mutexed DAOs, and cancels the acted-on decay notification.
      await handleNotificationAction(notifData, actionIdentifier);
    } catch (err) {
      Logger.error(LOG_SOURCE, "headless task body failed", err);
    }
  },
);

// Register at module scope so the task survives process death. Fire-and-forget:
// a rejection is logged, never thrown into the headless bring-up.
void registerTaskAsync(NOTIFICATION_ACTION_TASK).catch((err) => {
  Logger.error(LOG_SOURCE, "registerTaskAsync failed", err);
});
