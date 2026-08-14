import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { openAndMigrate } from "@/db/database";
import { HomeScreen } from "@/screens/HomeScreen";
import { installSweepTrigger } from "@/services/launch-sweep";
import { ThemeProvider, useTheme } from "@/theme";

/**
 * App entry: the thin shell. `ThemeProvider` reads the persisted `orbit-theme`
 * store internally (so a rehydrated selection restyles the tree). This shell
 * owns the two launch-path lifecycle jobs and gates first render on them:
 *
 *   1. `openAndMigrate()` (DATA-01) runs in an on-mount effect; the home shell
 *      renders only once migration RESOLVES — a themed loading view shows while
 *      it is pending, so no read path ever sees a half-built DB.
 *   2. `installSweepTrigger(AppState)` (DATA-06) installs the once-per-launch
 *      sweep — but ONLY from a `ready`-gated effect, so the cold-start sweep it
 *      fires immediately can never run before the DB is migrated.
 *
 * `App.tsx` owns the single `react-native` import for `AppState` and injects it
 * into the pure `launch-sweep` module. Neither migration nor the sweep runs at
 * module scope. `AppShell` lives INSIDE `ThemeProvider` so its loading view can
 * resolve colours through the theme tokens (CLAUDE.md: no hardcoded colour).
 */
function AppShell() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);

  // 1. Migrate before first render. Hold `ready` false until it resolves.
  useEffect(() => {
    let active = true;
    openAndMigrate().then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // 2. Install the sweep trigger ONLY after migration resolves (gated on
  //    `ready`), so its immediate cold-start sweep never precedes the DB.
  useEffect(() => {
    if (!ready) return;
    const subscription = installSweepTrigger(AppState);
    return () => subscription.remove();
  }, [ready]);

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
  },
});
