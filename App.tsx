import { NavigationContainer } from "@react-navigation/native";
import { ShareIntentProvider } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getExecutor, openAndMigrate } from "@/db/database";
import { navigationRef, ShareIntentGate } from "@/navigation/linking";
import { RootNavigator } from "@/navigation/RootNavigator";
import { registerFieldSweep } from "@/services/field-sweep";
import { installSweepTrigger } from "@/services/launch-sweep";
import { registerPhotoReconcileSweep } from "@/services/photos/photo-reconcile-sweep";
import { ThemeProvider, useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

/**
 * App entry: the thin shell. `ThemeProvider` reads the persisted `orbit-theme`
 * store internally (so a rehydrated selection restyles the tree). This shell
 * owns the two launch-path lifecycle jobs and gates first render on them:
 *
 *   1. `openAndMigrate()` (DATA-01) runs in an on-mount effect; the home shell
 *      renders only once migration RESOLVES — a themed loading view shows while
 *      it is pending, so no read path ever sees a half-built DB. If migration
 *      REJECTS (the runner rolls back cleanly and re-throws on a failed step,
 *      leaving the DB at its prior version), the rejection is caught, logged via
 *      `Logger.error`, and a THEMED error view is rendered instead of an infinite
 *      spinner (WR-01) — the data is safe, but this launch cannot proceed.
 *   2. `installSweepTrigger(AppState)` (DATA-06) installs the once-per-launch
 *      sweep — but ONLY from a `ready`-gated effect, so the cold-start sweep it
 *      fires immediately can never run before the DB is migrated.
 *
 * `App.tsx` owns the single `react-native` import for `AppState` and injects it
 * into the pure `launch-sweep` module. Neither migration nor the sweep runs at
 * module scope. `AppShell` lives INSIDE `ThemeProvider` so its loading view can
 * resolve colours through the theme tokens (CLAUDE.md: no hardcoded colour).
 */
// One-shot guard: the field-expiry hook must be registered on the launch-sweep
// registry EXACTLY once. The `ready`-gated effect below can re-run (Strict Mode,
// remounts), and registering the same hook twice would double-run it — so this
// module-scope flag makes registration idempotent across effect re-entries.
let fieldSweepRegistered = false;
// One-shot guard for the photo-write reconciliation hook (PHOTO-03/05), on the
// SAME registry and under the SAME re-entrancy reasoning as the field sweep.
let photoReconcileRegistered = false;

function AppShell() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Reactive navigator-readiness flag (A4-refine). `NavigationContainer`'s
  // `onReady` flips this true once the container has mounted and reported ready;
  // it is passed to `<ShareIntentGate/>` and keys its navigate effect alongside
  // `hasShareIntent`, so a cold-start share that lands before the container is
  // ready still navigates the moment readiness settles (no stranded intent).
  const [navReady, setNavReady] = useState(false);

  // 1. Migrate before first render. Hold `ready` false until it resolves. A
  //    rejection (failed migration) is caught so the app surfaces a themed error
  //    state instead of hanging on the spinner with an unhandled rejection.
  useEffect(() => {
    let active = true;
    openAndMigrate()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        Logger.error("bootstrap", "openAndMigrate failed", err);
        setError(err);
      });
    return () => {
      active = false;
    };
  }, []);

  // 2. Install the sweep trigger ONLY after migration resolves (gated on
  //    `ready`), so its immediate cold-start sweep never precedes the DB.
  useEffect(() => {
    if (!ready) return;
    // Register the launch field sweep (FLD-05) on the registry BEFORE the trigger
    // fires its cold-start sweep — once only (module guard), and only now that
    // migration has resolved so `getExecutor()` has a live connection.
    if (!fieldSweepRegistered) {
      registerFieldSweep(getExecutor);
      fieldSweepRegistered = true;
    }
    // Register the photo-write reconciliation (PHOTO-03/05) on the same registry,
    // once only, BEFORE the trigger fires its cold-start sweep. FS-only, no
    // executor. No background timer — the launch sweep is the recovery path.
    if (!photoReconcileRegistered) {
      registerPhotoReconcileSweep();
      photoReconcileRegistered = true;
    }
    const subscription = installSweepTrigger(AppState);
    return () => subscription.remove();
  }, [ready]);

  if (error) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          Couldn't start Orbit
        </Text>
        <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
          Your data is safe and unchanged. Please reopen the app; if this keeps
          happening, contact support.
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Mount the navigator only in the ready && !error branch, so no screen renders
  // before migration resolves. NavigationContainer sits INSIDE ThemeProvider (see
  // App below) so every screen's chrome resolves theme tokens + safe-area insets.
  //
  // The navigator (and therefore `<ShareIntentGate/>`) stays INSIDE this
  // `ready && !error` branch (RESEARCH Q4): the share navigation and the picker's
  // DB query resolve only AFTER `openAndMigrate()` resolves, so the picker never
  // queries a half-built DB. `onReady` sets the reactive `navReady` flag that the
  // ready-gated single-owner `<ShareIntentGate/>` keys its navigate effect on
  // (with `hasShareIntent`) — driving the pending share to Capture the moment
  // BOTH settle (A4/A4-refine), with no linking getInitialURL racing the provider.
  return (
    <NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)}>
      <ShareIntentGate isReady={navReady} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  // `GestureHandlerRootView` MUST wrap the OUTERMOST tree (outside
  // `SafeAreaProvider`) so react-native-gesture-handler can intercept touches
  // for the whole app — the crop-screen pan/pinch gestures (later Phase-5 plans)
  // depend on it. `flex: 1` lets it fill the screen; without it the tree
  // collapses to zero height.
  //
  // `ShareIntentProvider` is the SOLE consumer of the native pending-share
  // singleton (A4). It wraps the whole shell — mounting ABOVE the migration
  // `ready` gate on purpose — so on a cold-start share it consumes the pending
  // intent into context state WHILE migrations run; `hasShareIntent` PERSISTS
  // (the capture screen resets it on cancel/commit) until the ready-gated
  // `<ShareIntentGate/>` navigates. No `getInitialURL`/linking redirect competes
  // with it; navigation is a single downstream reaction to its context state.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ShareIntentProvider>
          <ThemeProvider>
            <StatusBar style="light" />
            <AppShell />
          </ThemeProvider>
        </ShareIntentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  errorBody: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
