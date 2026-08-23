/**
 * digest-schedule — the weekly-digest Sunday alarm (DGST-01). Its OWN service and
 * OWN launch-sweep hook, DELIBERATELY SEPARATE from the decay/birthday reconcile
 * engine (notification-schedule.ts). The digest is a SINGLETON WEEKLY trigger
 * under one stable identifier (`digest:weekly`), so a re-arm on every real
 * foreground launch REPLACES the prior schedule instead of stacking, and it fires
 * Sunday morning even if the app is never reopened (survives a reboot via the
 * launch sweep).
 *
 * WHY A SEPARATE SERVICE (not folded into reconcileSchedule):
 *   - `notification-schedule.ts`'s `isOwnedIdentifier` matches ONLY `decay:` /
 *     `birthday:` ids and its `notification-schedule.test.ts` asserts a digest id
 *     is NEVER cancelled by it (T-15-06 non-clobber regression). Folding the
 *     digest into that engine would put an unowned id under its cancel-all sweep.
 *   - The digest has no per-contact fan-out, no horizon/cap, no stagger — it is a
 *     single fixed weekly trigger. Composition, not extension.
 *
 * H2 (defer-one coordinator): `reconcileDigestSchedule` is SELF-COORDINATING via
 * a module-level DEFER-ONE guard (`digestReconcileRunning` / `digestReconcilePending`),
 * mirroring notification-schedule.ts VERBATIM in shape. The digest reconcile is
 * now driven from all three settings paths (master toggle, digest toggle,
 * delivery-hour) AND the launch sweep, so overlapping fire-and-forget calls are
 * reachable. A stale in-flight pass that read settings BEFORE a toggle-off commit
 * must NOT finish AFTER a newer one and RE-ARM the just-cancelled digest — on
 * re-entry we coalesce (set pending + return); the in-flight run drains pending
 * with exactly one trailing pass that RE-READS app_settings + the OS scheduled
 * set, so it always reflects the NEWEST committed state.
 *
 * NEVER nest a DAO write mutex inside the reconcile — it is READ-ONLY on the DB
 * plus expo scheduling calls. No network on any path (local scheduling only).
 */

import {
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
} from "expo-notifications";
import { getAppSettings } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
import { Logger } from "@/utils/logger";
import {
  DIGEST_BODY,
  DIGEST_CHANNEL,
  DIGEST_IDENTIFIER,
  DIGEST_TITLE,
} from "./notification-ids";

// ---------------------------------------------------------------------------
// TUNABLES (single-number edits — the tuning surface for the digest alarm).
// ---------------------------------------------------------------------------

/**
 * The weekday the digest fires. Expo's WEEKLY trigger weekday is 1=Sunday .. 7=
 * Saturday. DECIDED: Sunday morning (a calm week-in-review). Delivery HOUR reuses
 * the SHARED `app_settings.deliveryHour` (11-notify's morning hour) — only the
 * weekday is digest-specific, so this is the single-number edit. Device-spike
 * verified in 15-06.
 */
export const DIGEST_WEEKDAY = 1;

const LOG_SCOPE = "digest-schedule";

/**
 * The slice of a currently-scheduled request the diff reads. Shaped to match the
 * expo-notifications double (and the real frozen WEEKLY request); accessed via a
 * cast so this module never couples to expo's fragile runtime trigger union.
 */
interface ScheduledEntry {
  identifier: string;
  trigger?: {
    weekday?: number;
    hour?: number;
  };
}

/**
 * Schedule the singleton weekly digest under DIGEST_IDENTIFIER. WEEKLY trigger on
 * DIGEST_WEEKDAY at `deliveryHour:00`, on the PRIVATE `digest-v1` channel, with
 * the frozen generic title/body (names no one — lock-screen safe). The arg is
 * cast like scheduleOne (notification-schedule.ts) so this module never couples
 * to expo's runtime trigger union.
 */
export async function scheduleDigest(deliveryHour: number): Promise<void> {
  await scheduleNotificationAsync({
    identifier: DIGEST_IDENTIFIER,
    content: {
      title: DIGEST_TITLE,
      body: DIGEST_BODY,
      data: { kind: "digest" },
      autoDismiss: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.WEEKLY,
      channelId: DIGEST_CHANNEL,
      weekday: DIGEST_WEEKDAY,
      hour: deliveryHour,
      minute: 0,
    },
  } as Parameters<typeof scheduleNotificationAsync>[0]);
}

/**
 * One full reconcile pass — RE-READS all inputs via the stable `exec` so the
 * DEFER-ONE trailing pass reflects the newest committed state. READ-ONLY on the
 * DB. Branches:
 *   - absent & enabled           -> schedule the digest.
 *   - present & !enabled          -> cancel it (master OFF or digest toggle OFF).
 *   - present & enabled & drifted -> cancel + reschedule under the SAME id
 *                                    (delivery-hour or weekday change).
 *   - present & enabled & matching-> leave it untouched (idempotent).
 * `enabled` = notificationsEnabled === 1 && digestEnabled === 1 (the master
 * switch gates the digest exactly like decay/birthday).
 */
async function runDigestReconcilePass(exec: SqlExecutor): Promise<void> {
  const settings = await getAppSettings(exec);
  const desiredEnabled =
    settings.notificationsEnabled === 1 && settings.digestEnabled === 1;

  const existing =
    (await getAllScheduledNotificationsAsync()) as unknown as ScheduledEntry[];
  const current = existing.find((e) => e.identifier === DIGEST_IDENTIFIER);

  try {
    if (!current) {
      // Absent. Schedule iff enabled; otherwise nothing to do.
      if (desiredEnabled) {
        await scheduleDigest(settings.deliveryHour);
      }
      return;
    }

    // Present.
    if (!desiredEnabled) {
      await cancelScheduledNotificationAsync(DIGEST_IDENTIFIER);
      return;
    }

    // Present & enabled — reschedule only on a weekday/hour DRIFT.
    const drifted =
      current.trigger?.weekday !== DIGEST_WEEKDAY ||
      current.trigger?.hour !== settings.deliveryHour;
    if (drifted) {
      await cancelScheduledNotificationAsync(DIGEST_IDENTIFIER);
      await scheduleDigest(settings.deliveryHour);
    }
    // else: matching → leave untouched.
  } catch (err) {
    Logger.error(LOG_SCOPE, "digest reconcile pass failed", err);
  }
}

// Module-level DEFER-ONE coordinator (H2), mirroring notification-schedule.ts:
// 486-512. A re-entrant call while a reconcile is IN FLIGHT does NOT interleave —
// it requests exactly ONE trailing pass, so a burst of fire-and-forget callers
// coalesces to a single follow-up reflecting the newest committed state (never
// re-arming a just-cancelled digest).
let digestReconcileRunning = false;
let digestReconcilePending = false;

/**
 * Reconcile the OS's scheduled set to the desired digest state derived from
 * settings. SELF-COORDINATING: safe to fire-and-forget from any caller (the
 * settings writers + the launch sweep); overlapping calls coalesce to one
 * trailing pass. Read-only on the DB (never nest a DAO write mutex here).
 */
export async function reconcileDigestSchedule(exec: SqlExecutor): Promise<void> {
  if (digestReconcileRunning) {
    digestReconcilePending = true;
    return;
  }
  digestReconcileRunning = true;
  try {
    do {
      // Reset before the pass so an overlapping call DURING it is captured for
      // exactly one more pass (coalescing a burst into a single trailing pass).
      digestReconcilePending = false;
      await runDigestReconcilePass(exec);
    } while (digestReconcilePending);
  } finally {
    digestReconcileRunning = false;
    digestReconcilePending = false;
  }
}

/**
 * Register the digest reconcile as a launch-sweep hook (mirrors
 * registerNotificationScheduleSweep): pushes ONE hook that calls
 * `reconcileDigestSchedule(getExec())`. The exec is taken lazily so registration
 * can precede DB materialisation. Importing this module runs NOTHING (no
 * module-scope side effect).
 */
export function registerDigestScheduleSweep(
  getExec: () => SqlExecutor,
): void {
  registerSweepHook(async () => {
    await reconcileDigestSchedule(getExec());
  });
}

/**
 * Test-only reset of the DEFER-ONE coordinator so each test starts isolated.
 * Not part of the runtime surface.
 */
export function __resetDigestReconcileForTest(): void {
  digestReconcileRunning = false;
  digestReconcilePending = false;
}
