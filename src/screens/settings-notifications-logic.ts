import type { AppSettings, AppSettingsPatch } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import {
  clampHour,
  nextAllowedFireInstant,
} from "@/services/notifications/fire-instant";
import { formatLocalDate } from "@/utils/dates";

/** Format a 0-23 hour as a "h:MM AM/PM" wall-clock label (e.g. 9 → "9:00 AM"). */
export function formatHour(hour: number): string {
  const h = clampHour(hour);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

/** When reminders really arrive for a reminder time that falls in quiet hours. */
export interface ReminderArrival {
  /** The 0-23 hour reminders actually fire at (the quiet-hours end). */
  arrivalHour: number;
  /**
   * The roll moved the slot to the next calendar day (an evening reminder
   * time inside a quiet window that wraps midnight). The scheduler skips a
   * birthday alert whose slot leaves the birthday (notification-schedule.ts
   * `buildBirthdayRequest`), so birthday alerts are not sent in that case.
   */
  nextDay: boolean;
}

/**
 * When reminders picked for `reminderTime` will actually arrive, given the
 * quiet window (38.12 D-78). Computed by the scheduler's own helper,
 * `nextAllowedFireInstant` (fire-instant.ts), with no per-contact stagger and
 * no "now" constraint, so the page states exactly the roll the scheduler
 * applies. Returns null when the reminder time is outside quiet hours (the
 * picked time is the arrival time).
 *
 * `baseDate` is the day the slot is computed for (default today); only its
 * local Y/M/D matter.
 */
export function effectiveReminderArrival({
  reminderTime,
  quietStart,
  quietEnd,
  baseDate = new Date(),
}: {
  reminderTime: number;
  quietStart: number;
  quietEnd: number;
  baseDate?: Date;
}): ReminderArrival | null {
  const day = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
  );
  const slot = nextAllowedFireInstant(
    day,
    reminderTime,
    quietStart,
    quietEnd,
    0,
    // An invalid `now` means "no past constraint" (fire-instant.ts): the slot
    // is the day's own quiet-rolled slot, not tomorrow's.
    new Date(Number.NaN),
  );
  const nextDay = formatLocalDate(slot) !== formatLocalDate(day);
  if (!nextDay && slot.getHours() === clampHour(reminderTime)) {
    return null;
  }
  return { arrivalHour: slot.getHours(), nextDay };
}

/**
 * The line under Reminder time when the picked time sits inside quiet hours
 * (38.12 D-78), or null when it does not. With Birthday alerts on and a roll
 * into the next day, it also says birthday alerts are not sent: the scheduler
 * skips them rather than deliver a day late.
 */
export function reminderArrivalLine(
  arrival: ReminderArrival | null,
  birthdayAlertsOn: boolean,
): string | null {
  if (arrival === null) return null;
  const base = `Reminders will arrive at ${formatHour(arrival.arrivalHour)}, after quiet hours end.`;
  return arrival.nextDay && birthdayAlertsOn
    ? `${base} Birthday alerts can't move to the next day, so they won't be sent.`
    : base;
}

/** The helper under the quiet-hours rows: what the scheduler does (D-78). */
export const QUIET_HOURS_HELPER =
  "Reminders that fall inside quiet hours wait until quiet hours end. The weekly digest comes at your reminder time.";

/** The one line shown while Allow notifications is off (D-77). */
export const NOTIFICATIONS_PAUSED_LINE =
  "Notifications are paused. Turn on Allow notifications to get reminders.";

/**
 * The injectable collaborators of {@link persistNotificationSettings}. Extracted
 * as explicit deps so the reconcile-on-write path is unit-testable with mocked
 * DAO + reconcilers (ordering, both-fire, and failure) rather than only asserted
 * by source text. The production wiring passes the real
 * `updateAppSettings` / `getAppSettings` (app-settings-dao),
 * `reconcileSchedule` (notification-schedule),
 * `reconcileDigestSchedule` (digest-schedule), and `localDateTime` for `now`.
 */
export interface PersistNotificationDeps {
  updateAppSettings: (
    exec: SqlExecutor,
    patch: AppSettingsPatch,
    now: string,
  ) => Promise<void>;
  getAppSettings: (exec: SqlExecutor) => Promise<AppSettings>;
  reconcileSchedule: (exec: SqlExecutor) => Promise<void>;
  reconcileDigestSchedule: (exec: SqlExecutor) => Promise<void>;
  now: () => string;
}

/**
 * The shared notification/digest reconcile-on-write helper (Phase 37 §G),
 * extracted from the monolith's inline `persist()` (SettingsScreen.tsx) so every
 * notification write routes through one tested path.
 *
 * On a settings change it:
 *   1. writes the patch via `updateAppSettings(exec, patch, now())`;
 *   2. re-reads the durable state via `getAppSettings`;
 *   3. triggers BOTH `reconcileSchedule` and `reconcileDigestSchedule`
 *      immediately (fire-and-forget via `void`, matching the shipped monolith —
 *      NOT awaited) so the OS schedule re-arms on change rather than waiting for
 *      next launch (RESEARCH Pitfall 5);
 *   4. RETURNS the fresh `AppSettings` from the re-read so the caller can publish
 *      it into local state (review MEDIUM #2 — the re-read must not be discarded,
 *      or controls show stale values after a successful write).
 *
 * Failure ownership (review MEDIUM, cycle-3): a failing `updateAppSettings`
 * REJECTS out of this helper. It does NOT catch/swallow/log-and-continue — the
 * reconcilers never fire and no stale value is returned. The CALLER (the screen)
 * is the single place that owns and renders the error.
 */
export async function persistNotificationSettings(
  exec: SqlExecutor,
  patch: AppSettingsPatch,
  deps: PersistNotificationDeps,
): Promise<AppSettings> {
  // Write first. A rejection propagates (we do not catch) so the reconcilers and
  // the re-read below never run on a failed write.
  await deps.updateAppSettings(exec, patch, deps.now());
  // Re-read the durable state; the caller publishes this so controls reflect the
  // write (not a stale value).
  const next = await deps.getAppSettings(exec);
  // Both reconcilers fire immediately, fire-and-forget (NOT awaited), matching
  // the shipped monolith so the OS schedule re-arms on this change.
  void deps.reconcileSchedule(exec);
  void deps.reconcileDigestSchedule(exec);
  return next;
}
