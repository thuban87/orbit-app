/**
 * permission — thin wrappers over the OS POST_NOTIFICATIONS permission.
 *
 * The permission is OS-owned and revocable: it is READ FRESH on each relevant
 * entry, never cached in app state (a user can toggle it in system settings
 * between two app opens). `requestNotificationPermission` is fired at a VALUE
 * MOMENT — when the user does something that earns a reminder — not at cold
 * start, and it asks exactly ONCE: a denial degrades the app to in-app-only
 * (dashboard/orrery stay the source of truth) with NO re-nag loop (orchestrator
 * pick 6 / T-11-PERM).
 *
 * Both calls GUARD the underlying OS call so an unexpected rejection resolves to
 * `{ granted: false }` rather than throwing — the caller can treat "couldn't
 * determine / was denied" identically and degrade gracefully.
 */
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications";

/** Minimal typed result the callers branch on. */
export interface NotificationPermissionResult {
  granted: boolean;
  status: string;
}

/**
 * Read the current POST_NOTIFICATIONS status. Fresh read every call — never
 * cached. Resolves to `{ granted: false, status: "denied" }` if the OS call
 * rejects, so the caller never has to try/catch.
 */
export async function getNotificationPermission(): Promise<NotificationPermissionResult> {
  try {
    const { granted, status } = await getPermissionsAsync();
    return { granted, status };
  } catch {
    return { granted: false, status: "denied" };
  }
}

/**
 * Request POST_NOTIFICATIONS at a value moment. Asks once — no loop, no
 * automatic re-prompt on denial. Resolves to `{ granted: false, status:
 * "denied" }` if the OS call rejects (graceful degrade to in-app only).
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  try {
    const { granted, status } = await requestPermissionsAsync();
    return { granted, status };
  } catch {
    return { granted: false, status: "denied" };
  }
}
