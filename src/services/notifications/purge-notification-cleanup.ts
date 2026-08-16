/**
 * Post-commit notification purge cleanup — the `onPurgeExtensions` adapter that
 * cancels a purged contact's scheduled decay + birthday notifications.
 *
 * =============================================================================
 * WHY IDENTIFIERS ARE REBUILT FROM contactId — READ BEFORE EDITING:
 *   Phase 4's `purgeContact` fires `onPurgeExtensions(contactId)` POST-COMMIT:
 *   by the time this adapter runs the `contacts` row is ALREADY deleted, so
 *   nothing can be read from the DB. Both identifiers are therefore rederived
 *   from `contactId` alone via the single-source-of-truth builders in
 *   `notification-ids` (`decay:<id>` / `birthday:<id>`) — never re-derived here.
 *
 * WHY THIS IS THE RIGHT PLACE (Phase-4 deferral):
 *   An OS-scheduled alarm outlives the DB row it points at unless explicitly
 *   cancelled. `purge-dao`'s module header records that Phases 5 (photo) and 11
 *   (notifications) register the POST-COMMIT adapter; this fulfils the Phase-4
 *   note "notification cancel runs POST-COMMIT via onPurgeExtensions — Phase 11
 *   registers it". It composes alongside the photo cleanup in the single slot
 *   (see ArchivedContactsScreen.doPurge).
 *
 * BEST-EFFORT / IDEMPOTENT (T-04-16, T-11-PURGE):
 *   Runs post-commit, NEVER inside the transaction/mutex — a cancel is an OS-side
 *   side effect that cannot be rolled back. Each cancel is idempotent (cancelling
 *   an already-absent identifier is a harmless no-op on the OS side) and
 *   internally error-resilient: a throw from one cancel is logged and does NOT
 *   skip the other or reject the adapter. The outer purge hook already
 *   try/catch-logs, but this stays resilient on its own (mirrors the photo
 *   adapter contract).
 *
 * PURE-OS, NO exec: unlike the photo adapter there is no DB read — the cancel is
 *   entirely OS-side — so the builder takes no `SqlExecutor`.
 */
import { cancelScheduledNotificationAsync } from "expo-notifications";
import { Logger } from "@/utils/logger";
import { birthdayIdentifier, decayIdentifier } from "./notification-ids";

const LOG_SCOPE = "purge-notification-cleanup";

/** Cancel one identifier, logging (never throwing) on any failure. */
async function safeCancel(identifier: string): Promise<void> {
  try {
    await cancelScheduledNotificationAsync(identifier);
  } catch (err) {
    Logger.error(LOG_SCOPE, `best-effort cancel failed for ${identifier}`, err);
  }
}

/**
 * Build the `PurgeOptions.onPurgeExtensions` adapter for the notification
 * subsystem. The returned function, given a purged `contactId`, cancels that
 * contact's scheduled decay AND birthday notifications, both identifiers derived
 * from `contactId` alone (post-commit; the row is already gone). Idempotent and
 * best-effort — one cancel failing never skips the other or throws out.
 */
export function buildNotificationPurgeCleanup(): (
  contactId: number,
) => Promise<void> {
  return async (contactId: number): Promise<void> => {
    await safeCancel(decayIdentifier(contactId));
    await safeCancel(birthdayIdentifier(contactId));
  };
}
