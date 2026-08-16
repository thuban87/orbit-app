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
 * COLD-START replay guard (review H2 / T-11-REPLAY): after handling the cold-start
 * response, `clearLastNotificationResponseAsync()` clears it so a later relaunch
 * cannot re-route or (for an action) re-write it. Combined with 11-07's
 * deterministic-uid dedup this closes the cold-start double-write.
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
function applyBodyNav(data: NotificationData): void {
  const intent = resolveNotificationNav(data);
  if (!intent) {
    return;
  }
  const nav = navigationRef.current;
  if (!nav) {
    return;
  }
  if (intent.type === "reset") {
    nav.reset({ index: intent.index, routes: intent.routes });
  } else {
    nav.navigate(intent.name, intent.params);
  }
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
 * Render-null gate. `isReady` is the reactive navigator-readiness flag App.tsx
 * sets from `NavigationContainer`'s `onReady` — the same flag ShareIntentGate
 * uses. Action taps run immediately; body taps are queued until `isReady`.
 */
export function NotificationResponseGate({ isReady }: { isReady: boolean }) {
  // A body tap parked until the navigator is ready (review A3). Reactive so the
  // flush effect below re-fires the moment EITHER this or `isReady` settles last.
  const [pendingBodyData, setPendingBodyData] =
    useState<NotificationData | null>(null);
  // The cold-start response is read exactly once, no matter how `isReady` churns.
  const coldStartHandled = useRef(false);

  // WARM taps: register the response listener on mount. Action taps run now; body
  // taps are parked in reactive state and flushed by the isReady-gated effect.
  useEffect(() => {
    const sub = addNotificationResponseReceivedListener((response) => {
      const actionIdentifier = response.actionIdentifier;
      const data = dataOf(response);
      if (
        actionIdentifier === ACTION_MARK ||
        actionIdentifier === ACTION_SNOOZE
      ) {
        runActionTap(data, actionIdentifier);
      } else if (actionIdentifier === DEFAULT_ACTION_IDENTIFIER) {
        setPendingBodyData(data);
      }
      // Any other actionIdentifier is ignored (review item 8).
    });
    return () => sub.remove();
  }, []);

  // Flush a queued body tap once BOTH the tap and navigator readiness settle
  // (mirrors ShareIntentGate keying on reactive readiness — review A3).
  useEffect(() => {
    if (isReady && pendingBodyData !== null) {
      applyBodyNav(pendingBodyData);
      setPendingBodyData(null);
    }
  }, [isReady, pendingBodyData]);

  // COLD-START tap: read the launch response ONCE, after the navigator is ready
  // (so a body tap can route), then clear it so a relaunch cannot replay it
  // (review H2). Action taps route to the guarded handler; the DEFAULT id routes
  // to nav; anything else is ignored.
  useEffect(() => {
    if (!isReady || coldStartHandled.current) {
      return;
    }
    coldStartHandled.current = true;
    (async () => {
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
          applyBodyNav(data);
        }
      }
      // Clear regardless of classification so no relaunch replays this response.
      await clearLastNotificationResponseAsync();
    })().catch((err) => {
      Logger.error(LOG_SOURCE, "cold-start response handling failed", err);
    });
  }, [isReady]);

  return null;
}
