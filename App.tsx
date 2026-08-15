import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getExecutor, openAndMigrate } from "@/db/database";
import { HomeScreen } from "@/screens/HomeScreen";
import { registerFieldSweep } from "@/services/field-sweep";
import { installSweepTrigger } from "@/services/launch-sweep";
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

function AppShell() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);

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

  return <HomeScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
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
