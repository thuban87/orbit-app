/**
 * notification-actions — the action-category registration and the ONE
 * exactly-once shared handler that BOTH the foreground response listener (11-12)
 * and the killed-app headless task (11-07 `headless-task.ts`) funnel into.
 *
 * =============================================================================
 * EXACTLY-ONCE, DB-BOOTSTRAPPED, DAO-ONLY (reviews H1 + H2, threat register
 * T-11-BOOT / T-11-DUP / T-11-MUTEX):
 *
 *   H1 — DB bootstrap. `handleNotificationAction` FIRST `await openAndMigrate()`
 *   (idempotent — database.ts:95-96 returns the cached connection when already
 *   open) BEFORE `getExecutor()` (which THROWS pre-open — database.ts:123-127).
 *   On a killed-app headless launch React never mounts, so App.tsx's open effect
 *   never runs; without this await every write would throw "getDb() called
 *   before openAndMigrate() completed" and the tap would silently drop. On the
 *   foreground path openAndMigrate() is a no-op (already cached), so the single
 *   await is safe for both callers.
 *
 *   H2 — deterministic idempotency. The interaction/event `uid` is the PURE
 *   `actionUid(actionIdentifier, data)` (notification-ids.ts) — NEVER a fresh
 *   `newUid()`. A re-delivered (warm double) or cold-replayed identical tap
 *   therefore mints the SAME uid and collides on the existing UNIQUE(uid)
 *   constraint (interactions.uid / events.uid, 001-initial.ts) — the durable
 *   exactly-once backstop. A second, in-process `handledSet` short-circuits the
 *   warm double-delivery cheaply before it even reaches the DB.
 *
 *   DAO-ONLY. Mark routes through `recordTouchpoint` (the single-writer,
 *   mutexed recency DAO); snooze routes through `snoozeContact` (the mutexed
 *   snooze DAO, +1 week). This module NEVER issues a raw UPDATE of
 *   `last_contact` / `snooze_until` and NEVER nests the non-reentrant mutex.
 * =============================================================================
 *
 * The two action buttons register with `opensAppToForeground:false` so a
 * killed-app tap reaches the headless task (a foregrounding button would instead
 * boot the UI and bypass the headless write path).
 */
import {
  cancelScheduledNotificationAsync,
  setNotificationCategoryAsync,
} from "expo-notifications";
import { getExecutor, localDateTime, openAndMigrate } from "@/db/database";
import { recordTouchpoint } from "@/db/recency-dao";
import { snoozeContact } from "@/db/snooze-dao";
import { Logger } from "@/utils/logger";
import {
  ACTION_MARK,
  ACTION_SNOOZE,
  actionUid,
  DECAY_CATEGORY,
  decayIdentifier,
  type NotificationData,
} from "./notification-ids";

const LOG_SOURCE = "notif-actions";

/**
 * In-process dedup layer (H2, layer 1). Keyed on the deterministic actionUid, it
 * short-circuits a warm double-delivery (the SAME response handed to both the
 * headless task and the foreground listener within one live process) before it
 * reaches the DB. The durable layer is the UNIQUE(uid) constraint below, which
 * also covers a COLD replay after this set is gone (fresh process).
 */
const handledSet = new Set<string>();

/**
 * Register the decay action category with its two headless buttons. Both set
 * `opensAppToForeground:false` so a tap on a killed app is delivered to the
 * headless task (11-07) rather than booting the UI. Idempotent — safe to call on
 * every launch (Expo replaces the category definition for the id).
 */
export async function ensureNotificationCategories(): Promise<void> {
  await setNotificationCategoryAsync(DECAY_CATEGORY, [
    {
      identifier: ACTION_MARK,
      buttonTitle: "Mark contacted",
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: "Snooze 1 week",
      options: { opensAppToForeground: false },
    },
  ]);
}

/** True when a rejection is a SQLite UNIQUE-constraint violation (the replay backstop). */
function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed/i.test(msg);
}

/**
 * The ONE exactly-once shared handler. Both wirings (foreground listener,
 * headless task) call THIS with the tapped notification's `data` payload and the
 * pressed `actionIdentifier`.
 *
 * Flow: derive the deterministic key → warm-double short-circuit → bootstrap the
 * DB (H1) → branch (mark → recordTouchpoint, snooze → snoozeContact) → cancel the
 * contact's pending decay notification → record the key as handled. A
 * UNIQUE-collision rejection is a benign already-handled replay (swallowed, key
 * recorded, notification still cancelled); any OTHER error is logged and the key
 * is NOT recorded so a genuine transient failure can retry.
 */
export async function handleNotificationAction(
  data: NotificationData,
  actionIdentifier: string,
): Promise<void> {
  // Unknown actions (including the body/default tap, handled elsewhere by 11-12)
  // do nothing here — no write, no cancel.
  if (actionIdentifier !== ACTION_MARK && actionIdentifier !== ACTION_SNOOZE) {
    return;
  }

  // H2 layer 1: deterministic key + in-process short-circuit.
  const key = actionUid(actionIdentifier, data);
  if (handledSet.has(key)) {
    Logger.debug(LOG_SOURCE, `warm double-delivery ignored: ${key}`);
    return;
  }

  // H1: open + migrate the DB BEFORE getExecutor(). Idempotent on the foreground
  // path (cached); the ONLY thing that opens the DB on a killed-app headless
  // launch, where React never mounts.
  await openAndMigrate();
  const exec = getExecutor();

  const now = localDateTime();

  try {
    if (actionIdentifier === ACTION_MARK) {
      // The 04-log canonical one-tap values (A6): a notification-sourced,
      // outbound, unspecified-channel, connected touchpoint with no quality.
      await recordTouchpoint(exec, {
        contactId: data.contactId,
        uid: key,
        occurredAt: now,
        now,
        source: "notification",
        direction: "outbound",
        channel: "unspecified",
        connected: 1,
        quality: null,
      });
    } else {
      // The fixed +1-week headless snooze.
      await snoozeContact(exec, {
        contactId: data.contactId,
        uid: key,
        preset: "1w",
        now,
      });
    }

    // Suppress the acted-on contact's imminent decay notification immediately
    // (NOTIF-03). The headless path deliberately does NOT run a full reconcile
    // here (Pitfall 5): no mounted React → no guaranteed ensureChannels(), so
    // scheduling from here could land on a not-yet-created channel. The
    // post-snooze re-arm is launch-deferred to the next foreground reconcile.
    await cancelScheduledNotificationAsync(decayIdentifier(data.contactId));
    handledSet.add(key);
  } catch (err) {
    if (isUniqueViolation(err)) {
      // H2 layer 2 (durable): a re-delivered/cold-replayed tap collided on
      // UNIQUE(uid). It was already acted on — a benign no-op. Record the key
      // and STILL cancel the (already-acted) notification; do NOT rethrow.
      handledSet.add(key);
      Logger.debug(LOG_SOURCE, `duplicate action swallowed (UNIQUE): ${key}`);
      await cancelScheduledNotificationAsync(decayIdentifier(data.contactId));
      return;
    }
    // A genuine transient failure — surface it and do NOT record the key, so a
    // later delivery of the same action can retry the write.
    Logger.error(LOG_SOURCE, `action ${actionIdentifier} failed: ${key}`, err);
  }
}
