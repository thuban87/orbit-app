import type { NavigationContainerRef } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { createRef, useEffect, useState } from "react";
import { AppState } from "react-native";
import { hasSharedBackup } from "../../modules/orbit-backup-document-picker";
import { shouldRouteBackupShare } from "./backup-share-intent";
import { navigateIntoTab } from "./tab-entry";
import type { TabParamList } from "./types";

/**
 * Share-intent → navigation wiring: the SINGLE deterministic owner of pending-
 * share navigation (A4). This module has no UI — it is config/logic only, so it
 * carries no colour literals (check:colors).
 *
 * Two exports:
 *
 *   1. `navigationRef` — an imperative ref onto the `NavigationContainer`
 *      mounted in `App.tsx`. It lets a non-screen component (the gate below)
 *      call `navigate(...)` without a `useNavigation` hook (which is only
 *      available to descendants of a screen). App.tsx passes it as
 *      `<NavigationContainer ref={navigationRef}>`.
 *
 *   2. `ShareIntentGate` — a render-null component that reacts to the
 *      `ShareIntentProvider`'s context state and drives navigation. It is the
 *      ONE owner of the pending share (A4): the provider consumes the native
 *      pending-share singleton on mount (cold start) and via its internal
 *      `onStateChange "pending"` subscription (background), exposing
 *      `hasShareIntent`; this gate is the only thing that turns that flag into a
 *      navigation. We deliberately do NOT add a competing linking
 *      `getInitialURL`/`getStateFromPath`/`subscribe` redirect keyed on the same
 *      pending share — a second consumer would race the native singleton on cold
 *      start, which is exactly the ordering hazard the review flagged.
 *
 * A top-level `scheme` deep-link `linking` config is intentionally absent: it is
 * not required for the share flow, and were one ever added for the app it MUST
 * NOT handle the share intent (that stays the provider's job, single-owner).
 */
export const navigationRef = createRef<NavigationContainerRef<TabParamList>>();

/**
 * Ready-gated single-owner share navigation.
 *
 * `isReady` is the REACTIVE navigator-readiness flag App.tsx sets from
 * `NavigationContainer`'s `onReady` (A4-refine). The navigate effect is keyed on
 * BOTH `hasShareIntent` and `isReady` so it re-runs whenever EITHER settles
 * last: a pending share that arrives one tick before the container reports ready
 * is NOT stranded — the effect re-fires the moment `isReady` flips true (and
 * vice-versa). We do NOT gate on the non-reactive `navigationRef.current?.
 * isReady()`: an effect that runs one tick early would no-op and, since
 * `hasShareIntent` never changes again, never retry. The `navigationRef.current?.`
 * optional chain on the `.navigate` call stays only as a null-safety guard, not
 * as the readiness trigger.
 */
export function ShareIntentGate({ isReady }: { isReady: boolean }) {
  const { hasShareIntent, resetShareIntent } = useShareIntentContext();
  // DEF-04: a backup shared into a running Orbit is captured natively but
  // changes no React state, so nothing re-ran this check until Data & Backup
  // was visited. Each return to the foreground re-checks the native flag.
  const [foregroundTick, setForegroundTick] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegroundTick((tick) => tick + 1);
    });
    return () => subscription.remove();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: foregroundTick only re-runs the native check on each return to the foreground.
  useEffect(() => {
    // Query unconditionally: expo-share-intent's cold-start state can settle
    // after this module has already captured the JSON stream. The native cache
    // is the authoritative proof that Android granted one backup document.
    const backupReady = hasSharedBackup();
    if (isReady) {
      if (shouldRouteBackupShare(backupReady, hasShareIntent)) {
        resetShareIntent();
        // A fresh shareSeq makes an already-open Backup page consume it too.
        navigateIntoTab(navigationRef.current, "SettingsTab", "Backup", {
          shareSeq: nextBackupShareSeq(),
        });
        return;
      }
      if (hasShareIntent) {
        navigateIntoTab(navigationRef.current, "DashboardTab", "Capture");
      }
    }
  }, [hasShareIntent, isReady, resetShareIntent, foregroundTick]);

  return null;
}

let backupShareSeq = 0;
/** A new Backup `shareSeq` per routed share (DEF-04). */
export function nextBackupShareSeq(): number {
  backupShareSeq += 1;
  return backupShareSeq;
}
