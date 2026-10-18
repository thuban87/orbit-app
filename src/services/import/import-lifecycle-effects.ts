/**
 * Post-commit lifecycle effects of an import (38.4 D-57; 38.12 D-58).
 *
 * The one helper every import path awaits after it commits — single review,
 * bulk driver, Duplicate Review's "Import as new" and the bulk-setup Combine.
 *
 * - Bound contacts (`anyBound`): a Bound batch puts its new contacts on
 *   reminders — birthday reminders apply at once, decay reminders start after
 *   a first touchpoint — so the notification schedule and the widget refresh.
 * - Unbound contacts (`anyUnbound`): an Unbound contact gets birthday alerts
 *   only when "Birthday alerts for Unbound contacts" is on
 *   (`app_settings.birthday_unbound_enabled`, read by
 *   `listBirthdayNotificationCandidates`). With that setting on, the schedule
 *   is reconciled so the new birthdays are scheduled; with it off, an
 *   Unbound-only import runs nothing.
 *
 * The schedule reconciles at most once per call — never per row. This mirrors
 * `applyLifecycleTransitionEffects` (contact-lifecycle-effects.ts): the import
 * is already committed, so these effects can never fail, retry or roll it
 * back. Each effect is isolated, so one failure does not suppress the other.
 *
 * Callers in node-tested services reach this module through a lazy `import()`
 * default, because it pulls in native modules (expo-notifications,
 * react-native-android-widget).
 */
import { getAppSettings } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import { reconcileSchedule as reconcileNotificationSchedule } from "@/services/notifications/notification-schedule";
import { notifyWidgetDataChanged as notifyWidget } from "@/services/widget/widget-refresh";
import { Logger } from "@/utils/logger";

const LOG_SOURCE = "import-lifecycle-effects";

/** Which lifecycles the committed import created contacts with. */
export interface ImportLifecycleFlags {
  anyBound: boolean;
  anyUnbound: boolean;
}

export interface ImportLifecycleEffectDeps {
  reconcileSchedule: (exec: SqlExecutor) => Promise<unknown>;
  notifyWidgetDataChanged: () => void;
  /** Whether "Birthday alerts for Unbound contacts" is on. */
  readBirthdayUnboundEnabled: (exec: SqlExecutor) => Promise<boolean>;
}

/** The effect hook the import services accept (injectable for tests). */
export type ImportLifecycleEffects = (
  exec: SqlExecutor,
  flags: ImportLifecycleFlags,
) => Promise<void>;

const defaultDeps: ImportLifecycleEffectDeps = {
  reconcileSchedule: reconcileNotificationSchedule,
  notifyWidgetDataChanged: notifyWidget,
  readBirthdayUnboundEnabled: async (exec) =>
    (await getAppSettings(exec)).birthdayUnboundEnabled === 1,
};

async function unboundBirthdaysEnabled(
  exec: SqlExecutor,
  deps: ImportLifecycleEffectDeps,
): Promise<boolean> {
  try {
    return await deps.readBirthdayUnboundEnabled(exec);
  } catch (error) {
    Logger.error(
      LOG_SOURCE,
      "could not read the Unbound birthday setting after an import",
      error,
    );
    return false;
  }
}

/**
 * Apply the post-commit effects for the lifecycles an import created; log and
 * swallow every failure. Never rethrows.
 */
export async function applyImportLifecycleEffects(
  exec: SqlExecutor,
  flags: ImportLifecycleFlags,
  deps: ImportLifecycleEffectDeps = defaultDeps,
): Promise<void> {
  const reschedule =
    flags.anyBound ||
    (flags.anyUnbound && (await unboundBirthdaysEnabled(exec, deps)));
  if (reschedule) {
    try {
      await deps.reconcileSchedule(exec);
    } catch (error) {
      Logger.error(
        LOG_SOURCE,
        "notification reconciliation after an import failed",
        error,
      );
    }
  }
  if (flags.anyBound) {
    try {
      deps.notifyWidgetDataChanged();
    } catch (error) {
      Logger.error(
        LOG_SOURCE,
        "widget refresh after a Bound import failed",
        error,
      );
    }
  }
}
