/**
 * Foreground lifecycle transition owners.
 *
 * The lifecycle DAO commits the relationship state first. Notification
 * reconciliation and widget publication are best-effort post-commit effects:
 * they must reflect a completed transition but must never retry or roll it back.
 */
import {
  bindContact as bindContactDao,
  unbindContact as unbindContactDao,
} from "@/db/contact-lifecycle-dao";
import type { SqlExecutor } from "@/db/types";
import { reconcileSchedule as reconcileNotificationSchedule } from "@/services/notifications/notification-schedule";
import { notifyWidgetDataChanged as notifyWidget } from "@/services/widget/widget-refresh";
import { Logger } from "@/utils/logger";

const LOG_SOURCE = "contact-lifecycle-effects";

export type LifecycleDirection = "bind" | "unbind";

type EffectDeps = {
  exec: SqlExecutor;
  reconcileSchedule: (exec: SqlExecutor) => Promise<void>;
  notifyWidgetDataChanged: () => void;
  reportError: (message: string, error: unknown) => void;
};

type LifecycleDeps = Omit<EffectDeps, "exec"> & {
  bindContact: (
    exec: SqlExecutor,
    contactId: number,
    now: string,
    intervalDays?: number,
  ) => Promise<void>;
  unbindContact: (
    exec: SqlExecutor,
    contactId: number,
    now: string,
  ) => Promise<void>;
};

const defaultDeps: LifecycleDeps = {
  bindContact: bindContactDao,
  unbindContact: unbindContactDao,
  reconcileSchedule: reconcileNotificationSchedule,
  notifyWidgetDataChanged: notifyWidget,
  reportError: (message, error) => Logger.error(LOG_SOURCE, message, error),
};

/**
 * Apply only the post-commit effects for a transition already persisted by the
 * caller. The direction is retained in the error context; schedule reconciliation
 * reads current durable lifecycle state to cancel Unbound decay or re-arm Bound
 * decay. Each effect is isolated so one failure cannot suppress the other.
 */
export async function applyLifecycleTransitionEffects(
  contactId: number,
  direction: LifecycleDirection,
  deps: EffectDeps,
): Promise<void> {
  try {
    await deps.reconcileSchedule(deps.exec);
  } catch (error) {
    deps.reportError(
      `${direction} notification reconciliation failed for contact ${contactId}`,
      error,
    );
  }

  try {
    deps.notifyWidgetDataChanged();
  } catch (error) {
    deps.reportError(
      `${direction} widget refresh failed for contact ${contactId}`,
      error,
    );
  }
}

/** Persist an Unbind, then make the scheduler and widget observe it. */
export async function unbindWithLifecycleEffects(
  exec: SqlExecutor,
  contactId: number,
  now: string,
  deps: LifecycleDeps = defaultDeps,
): Promise<void> {
  await deps.unbindContact(exec, contactId, now);
  await applyLifecycleTransitionEffects(contactId, "unbind", { exec, ...deps });
}

/** Persist a Bind, then immediately re-arm proactive surfaces. */
export async function bindWithLifecycleEffects(
  exec: SqlExecutor,
  contactId: number,
  now: string,
  intervalDays?: number,
  deps: LifecycleDeps = defaultDeps,
): Promise<void> {
  await deps.bindContact(exec, contactId, now, intervalDays);
  await applyLifecycleTransitionEffects(contactId, "bind", { exec, ...deps });
}
