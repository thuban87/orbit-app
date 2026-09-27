/**
 * Post-commit effects of an import that created Bound contacts (38.4 D-57).
 *
 * A Bound batch puts its new contacts on reminders: birthday reminders apply at
 * once, and decay reminders start after a first touchpoint. The notification
 * schedule and the widget must observe the committed contacts, so they refresh
 * once per pass, combine or single import — never per row. This mirrors
 * `applyLifecycleTransitionEffects` (contact-lifecycle-effects.ts): the import is
 * already committed, so these effects can never fail, retry or roll it back.
 * Each effect is isolated, so one failure does not suppress the other. An
 * Unbound import runs no effects, as before.
 *
 * Callers in node-tested services reach this module through a lazy `import()`
 * default, because it pulls in native modules (expo-notifications,
 * react-native-android-widget).
 */
import type { SqlExecutor } from "@/db/types";
import { reconcileSchedule as reconcileNotificationSchedule } from "@/services/notifications/notification-schedule";
import { notifyWidgetDataChanged as notifyWidget } from "@/services/widget/widget-refresh";
import { Logger } from "@/utils/logger";

const LOG_SOURCE = "import-lifecycle-effects";

export interface BoundImportEffectDeps {
  reconcileSchedule: (exec: SqlExecutor) => Promise<unknown>;
  notifyWidgetDataChanged: () => void;
}

/** The effect hook the import services accept (injectable for tests). */
export type BoundImportEffects = (exec: SqlExecutor) => Promise<void>;

const defaultDeps: BoundImportEffectDeps = {
  reconcileSchedule: reconcileNotificationSchedule,
  notifyWidgetDataChanged: notifyWidget,
};

/** Refresh reminders, then the widget, once; log and swallow each failure. */
export async function applyBoundImportEffects(
  exec: SqlExecutor,
  deps: BoundImportEffectDeps = defaultDeps,
): Promise<void> {
  try {
    await deps.reconcileSchedule(exec);
  } catch (error) {
    Logger.error(
      LOG_SOURCE,
      "notification reconciliation after a Bound import failed",
      error,
    );
  }
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
