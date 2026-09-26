/**
 * NotificationResponseGate — the OS-listener wiring that turns a notification tap
 * into either a DB write (mark/snooze) or a navigation (body tap), mirroring the
 * `ShareIntentGate` idiom in linking.ts (imperative `navigationRef`, an
 * `isReady`-gated effect, a pending response HELD until the navigator settles).
 *
 * This module is config/logic only — it renders null and carries NO colour
 * literals (check:colors).
 *
 * Two OS surfaces funnel here:
 *
 *   - WARM taps → `addNotificationResponseReceivedListener` (registered on mount,
 *     removed on unmount).
 *   - COLD-START tap → `getLastNotificationResponseAsync`, read ONCE inside the
 *     `isReady`-gated effect (the navigator is guaranteed mounted by then).
 *
 * Classification is by `response.actionIdentifier` (review item 8):
 *   (a) ACTION_MARK / ACTION_SNOOZE → the shared exactly-once
 *       `handleNotificationAction` (11-07). It needs no navigator, so it runs
 *       immediately regardless of `isReady`. The call is wrapped in a
 *       Logger-guarded `.catch` so a stale/purged contactId — or the handler's
 *       benign UNIQUE-collision rejection — can never surface as an unhandled
 *       promise rejection (review item 8 / A3, T-11-SPOOF).
 *   (b) Expo's `DEFAULT_ACTION_IDENTIFIER` — and ONLY that (review item 8: NOT
 *       every non-mark/snooze id) → the body tap: `resolveNotificationNav(data)`
 *       applied to `navigationRef.current`.
 *   (c) any other actionIdentifier → ignored.
 *
 * QUEUED body tap (review A3 / T-11-BACKSTACK): a body tap can arrive one tick
 * before the navigator reports ready. Rather than no-op on `navigationRef.current`
 * and never retry, the warm listener parks the tap in reactive state, and the
 * `isReady`-gated effect flushes it once BOTH the tap and readiness settle —
 * exactly how ShareIntentGate keys its navigate effect on reactive readiness.
 *
 * COLD-START replay guard (review H2 / T-11-REPLAY): the cold-start routine clears
 * the launch response (`clearLastNotificationResponseAsync`, in a `finally`) so a
 * later relaunch cannot re-route or (for an action) re-write it — even when the
 * read or the navigation rejects, or the cold result is dropped as stale.
 * Combined with 11-07's deterministic-uid dedup this closes the cold-start
 * double-write.
 *
 * INGRESS CHRONOLOGY (RG-042 — react-native/AUD-RN-012,
 * reliability-testing/AUD-REL-012): the latest accepted body tap wins. The cold
 * launch response is by definition the OLDEST body tap, so once any warm body
 * tap (DEFAULT_ACTION_IDENTIFIER) has been accepted, a still-pending cold
 * lookup is stale and never navigates (debug log only, content-free — D-24).
 * Same rule as `subscribeToWidgetUrls` in widget-linking.ts ("a warm intent was
 * received ⇒ drop the initial URL"). Action taps and the cold clear are
 * unaffected.
 *
 * Mounted by App.tsx alongside `<ShareIntentGate/>` in 11-13.
 */
import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponseAsync,
  DEFAULT_ACTION_IDENTIFIER,
  getLastNotificationResponseAsync,
  type NotificationResponse,
} from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { handleNotificationAction } from "@/services/notifications/notification-actions";
import {
  ACTION_MARK,
  ACTION_SNOOZE,
  type NotificationData,
} from "@/services/notifications/notification-ids";
import { resolveNotificationNav } from "@/services/notifications/notification-nav";
import { Logger } from "@/utils/logger";
import { navigationRef } from "./linking";
import { resetToDashboardWith, resetToDigestTab } from "./reset-intents";

const LOG_SOURCE = "notif-gate";

/**
 * Run the shared exactly-once action handler for a mark/snooze tap, guarding the
 * promise so a stale/purged contactId or a benign idempotency rejection is logged
 * and swallowed, never an unhandled rejection (review item 8). No navigator
 * needed — safe before `isReady`.
 */
function runActionTap(data: NotificationData, actionIdentifier: string): void {
  handleNotificationAction(data, actionIdentifier).catch((err) => {
    Logger.error(
      LOG_SOURCE,
      `foreground action "${actionIdentifier}" rejected`,
      err,
    );
  });
}

/**
 * Apply a body tap's resolved nav intent to the live navigator. A malformed
 * payload (resolver returns null) or a not-yet-attached ref routes nowhere.
 */
type NotificationContactLookup = (contactId: number) => Promise<{
  archived_at: string | null;
  trackingEnabled: number;
} | null>;

/**
 * Resolve a body tap and reject a decay action that no longer points at a live
 * Bound contact. Birthday and digest navigation remain factual/view-only routes.
 */
export async function guardNotificationBodyIntent(
  data: unknown,
  lookup: NotificationContactLookup,
) {
  const intent = resolveNotificationNav(data);
  if (!intent) {
    return null;
  }
  if (intent.type === "select-digest" || intent.routes[1]?.name !== "Compose") {
    return intent;
  }

  const contactId = intent.routes[1].params.contactId;
  const contact = await lookup(contactId);
  if (contact === null || contact.archived_at !== null) {
    return null;
  }
  if (contact.trackingEnabled !== 1) {
    return {
      type: "reset" as const,
      index: 1 as const,
      routes: [
        { name: "Home" as const },
        { name: "Profile" as const, params: { contactId } },
      ],
    };
  }

  return intent;
}

/**
 * Apply the guarded body intent to the live navigator.
 *
 * `isCurrent` keeps an older asynchronous lookup from replacing the destination
 * selected by a newer notification body tap.
 */
export async function applyBodyNav(
  data: unknown,
  isCurrent: () => boolean = () => true,
  lookup: NotificationContactLookup = async (contactId) => {
    const [{ getExecutor }, { getContactHeader }] = await Promise.all([
      import("@/db/database"),
      import("@/db/contact-read"),
    ]);
    return getContactHeader(getExecutor(), contactId);
  },
): Promise<void> {
  const intent = await guardNotificationBodyIntent(data, lookup);
  if (!intent) {
    return;
  }
  if (!isCurrent()) {
    return;
  }
  const nav = navigationRef.current;
  if (!nav) {
    return;
  }
  nav.reset(
    intent.type === "select-digest"
      ? resetToDigestTab()
      : resetToDashboardWith(intent.routes[1]),
  );
}

/**
 * Cold/warm ingress ordering for one mounted gate (RG-042). The cold launch
 * response is the oldest body tap, so it is current only while no warm body tap
 * has been accepted and the gate is still mounted. Closures (not `this`) so the
 * methods may be passed around unbound.
 */
export interface NotificationIngressChronology {
  /** A warm DEFAULT body tap was accepted — any pending cold result is stale. */
  markWarmBodyAccepted(): void;
  /** True while a cold body result may still navigate. */
  coldIsCurrent(): boolean;
  /** The gate unmounted — a pending cold result must never navigate. */
  teardown(): void;
}

export function createNotificationIngressChronology(): NotificationIngressChronology {
  let warmBodyAccepted = false;
  let tornDown = false;
  return {
    markWarmBodyAccepted: () => {
      warmBodyAccepted = true;
    },
    coldIsCurrent: () => !warmBodyAccepted && !tornDown,
    teardown: () => {
      tornDown = true;
    },
  };
}

/** Read the app-minted payload off a tapped notification. */
function dataOf(response: NotificationResponse): NotificationData {
  // `content.data` is typed `Record<string, unknown> | undefined`; the payload is
  // app-minted at schedule time (notification-schedule.ts). A body tap re-validates
  // via `resolveNotificationNav`; a malformed action payload is caught by the
  // Logger-guarded catch around `handleNotificationAction`.
  return response.notification.request.content
    .data as unknown as NotificationData;
}

/**
 * Classify one WARM notification response. Action taps (mark/snooze) run the
 * guarded handler immediately and never count as a body tap; a DEFAULT body tap
 * is marked accepted on the chronology (so a pending cold result is dropped)
 * BEFORE it is parked for the ready-gated flush; anything else is ignored
 * (review item 8).
 */
export function handleWarmNotificationResponse(
  response: NotificationResponse,
  chronology: Pick<
    NotificationIngressChronology,
    "markWarmBodyAccepted"
  > | null,
  parkBodyTap: (data: NotificationData) => void,
): void {
  const actionIdentifier = response.actionIdentifier;
  const data = dataOf(response);
  if (actionIdentifier === ACTION_MARK || actionIdentifier === ACTION_SNOOZE) {
    runActionTap(data, actionIdentifier);
  } else if (actionIdentifier === DEFAULT_ACTION_IDENTIFIER) {
    chronology?.markWarmBodyAccepted();
    parkBodyTap(data);
  }
}

/**
 * Read, route and clear the COLD-START response once. A body tap navigates only
 * while `coldIsCurrent()` holds (RG-042); a dropped stale result is logged once
 * at debug level with a content-free message (D-24). The clear runs in a
 * `finally` so a rejected read / lookup / navigation — or a dropped result — can
 * never leave the response to replay on relaunch (review H2). A routing error
 * still propagates to the caller's logger; a clear failure is logged here.
 */
export async function handleColdStartResponse(
  coldIsCurrent: () => boolean,
  lookup?: NotificationContactLookup,
): Promise<void> {
  let dropLogged = false;
  const isCurrent = () => {
    const current = coldIsCurrent();
    if (!current && !dropLogged) {
      dropLogged = true;
      Logger.debug(LOG_SOURCE, "stale cold notification navigation dropped");
    }
    return current;
  };
  try {
    const response = await getLastNotificationResponseAsync();
    if (response) {
      const actionIdentifier = response.actionIdentifier;
      const data = dataOf(response);
      if (
        actionIdentifier === ACTION_MARK ||
        actionIdentifier === ACTION_SNOOZE
      ) {
        runActionTap(data, actionIdentifier);
      } else if (actionIdentifier === DEFAULT_ACTION_IDENTIFIER) {
        await applyBodyNav(data, isCurrent, lookup);
      }
      // Any other actionIdentifier is ignored (review item 8).
    }
  } finally {
    // Clear regardless of classification or outcome so no relaunch replays it.
    try {
      await clearLastNotificationResponseAsync();
    } catch (err) {
      Logger.error(LOG_SOURCE, "clear last notification response failed", err);
    }
  }
}

/**
 * Render-null gate. `isReady` is the reactive navigator-readiness flag App.tsx
 * sets from `NavigationContainer`'s `onReady` — the same flag ShareIntentGate
 * uses. Action taps run immediately; body taps are queued until `isReady`.
 */
export function NotificationResponseGate({ isReady }: { isReady: boolean }) {
  // A body tap parked until the navigator is ready (review A3). Reactive so the
  // flush effect below re-fires the moment EITHER this or `isReady` settles last.
  const [pendingBodyData, setPendingBodyData] =
    useState<NotificationData | null>(null);
  // Every flush gets a new id. An older DB lookup may finish after a newer tap,
  // but it cannot navigate or clear the newer pending body data.
  const bodyNavigationRequestId = useRef(0);
  // The cold-start response is read exactly once, no matter how `isReady` churns.
  const coldStartHandled = useRef(false);
  // Cold/warm ingress ordering (RG-042). Always read through the ref at event
  // time: a (StrictMode) remount replaces it with a fresh instance.
  const chronologyRef = useRef<NotificationIngressChronology | null>(null);

  // Declared BEFORE the warm-listener and cold-start effects (effects run in
  // declaration order), so both see this mount's chronology. Unmount tears it
  // down so a still-pending cold lookup can never navigate.
  useEffect(() => {
    const chronology = createNotificationIngressChronology();
    chronologyRef.current = chronology;
    return () => chronology.teardown();
  }, []);

  // WARM taps: register the response listener on mount. Action taps run now; body
  // taps mark the chronology, then park in reactive state for the isReady flush.
  useEffect(() => {
    const sub = addNotificationResponseReceivedListener((response) => {
      handleWarmNotificationResponse(
        response,
        chronologyRef.current,
        setPendingBodyData,
      );
    });
    return () => sub.remove();
  }, []);

  // Flush a queued body tap once BOTH the tap and navigator readiness settle
  // (mirrors ShareIntentGate keying on reactive readiness — review A3).
  useEffect(() => {
    if (isReady && pendingBodyData !== null) {
      const requestId = bodyNavigationRequestId.current + 1;
      bodyNavigationRequestId.current = requestId;
      const isCurrent = () => bodyNavigationRequestId.current === requestId;
      void applyBodyNav(pendingBodyData, isCurrent)
        .catch((err) => {
          Logger.error(LOG_SOURCE, "guarded body navigation failed", err);
        })
        .finally(() => {
          if (isCurrent()) {
            setPendingBodyData(null);
          }
        });
    }
  }, [isReady, pendingBodyData]);

  // COLD-START tap: read the launch response ONCE, after the navigator is ready
  // (so a body tap can route), then clear it so a relaunch cannot replay it
  // (review H2). A body result navigates only while no warm body tap has been
  // accepted and the gate is mounted (RG-042).
  useEffect(() => {
    if (!isReady || coldStartHandled.current) {
      return;
    }
    coldStartHandled.current = true;
    handleColdStartResponse(
      () => chronologyRef.current?.coldIsCurrent() ?? false,
    ).catch((err) => {
      Logger.error(LOG_SOURCE, "cold-start response handling failed", err);
    });
  }, [isReady]);

  return null;
}
