import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
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
import { AssistBanner } from "@/components/AssistBanner";
import { BackupEncryptionBenchmarkHarness } from "@/components/BackupEncryptionBenchmarkHarness";
import { ResumeImportPrompt } from "@/components/ResumeImportPrompt";
import { ResumeReconcilePrompt } from "@/components/ResumeReconcilePrompt";
import { Snackbar } from "@/components/Snackbar";
import { UniversalFab } from "@/components/UniversalFab";
import { getAppSettings, updateAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime, openAndMigrate } from "@/db/database";
import { isMigration006IntegrityError } from "@/db/migrations/006-normalize-custom-field-values";
import { navigationRef, ShareIntentGate } from "@/navigation/linking";
import { NotificationResponseGate } from "@/navigation/notification-gate";
import { RootNavigator } from "@/navigation/RootNavigator";
import { WidgetLinkingGate } from "@/navigation/widget-linking";
import { registerBackupSweep } from "@/services/backup-sweep";
import { getDeviceRegion } from "@/services/device-region";
import { registerFieldSweep } from "@/services/field-sweep";
import {
  type ResumableImport,
  registerImportResumeSweep,
} from "@/services/import/contact-import-resume-sweep";
import {
  type ResumableReconcile,
  registerReconcileResumeSweep,
} from "@/services/import/reconcile-resume-sweep";
import { interactionAssistSweep } from "@/services/interaction-assist-sweep";
import {
  installSweepTrigger,
  registerSweepHook,
} from "@/services/launch-sweep";
import { registerMemoryTrashSweep } from "@/services/memory-trash-sweep";
// Module-scope side-effect import (Pitfall P5): importing headless-task RUNS its
// `TaskManager.defineTask` + `registerTaskAsync` so a killed-app action tap reaches
// the headless write path. React never mounts in the headless context, so no
// component effect could do this — it MUST be a module-scope import. Importing it
// runs NOTHING else (no reconcile, no sweep).
import { ensureChannels } from "@/services/notifications/channels";
import { ensureNotificationCategories } from "@/services/notifications/notification-actions";
import { resolveActiveResumePrompt } from "@/services/resume-prompt-precedence";
import "@/services/notifications/headless-task";
import { registerDigestScheduleSweep } from "@/services/notifications/digest-schedule";
import { FOREGROUND_NOTIFICATION_BEHAVIOR } from "@/services/notifications/notification-ids";
import { registerNotificationScheduleSweep } from "@/services/notifications/notification-schedule";
import { registerBackgroundReconcileSweep } from "@/services/photos/background-reconcile-sweep";
import { registerPhotoReconcileSweep } from "@/services/photos/photo-reconcile-sweep";
import { registerRestorePhotoFinalizeSweep } from "@/services/photos/restore-photo-finalize-sweep";
import { registerWidgetSweep } from "@/services/widget/widget-refresh";
import { subscribeAppState, useAssistBanner } from "@/stores/assist-store";
import { setFocusedRouteName } from "@/stores/focused-route-store";
import {
  themeSelectionFromSettings,
  useThemeStore,
} from "@/stores/theme-store";
import { ThemeProvider, useTheme } from "@/theme";
import { loadAppFonts } from "@/theme/fonts";
import { hydrateThemeAtBoot } from "@/theme/hydrate-theme-at-boot";
import { navigationTheme } from "@/theme/navigation-theme";
import { Logger } from "@/utils/logger";

/**
 * App entry: the thin shell. `ThemeProvider` reads the `useThemeStore` selection
 * (hydrated from `app_settings` at boot — the durable theme columns of migration
 * 015, no longer AsyncStorage) so the hydrated selection restyles the tree. This
 * shell owns the launch-path lifecycle jobs and gates first render on them:
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
// Module-scope foreground-presentation handler (item D). Set EXACTLY ONCE when the
// bundle loads (before the component, mirroring the headless registration) so it is
// never re-registered per render. It returns the pure, node-tested
// `FOREGROUND_NOTIFICATION_BEHAVIOR` const: the dashboard/orrery is the in-app
// surface, so a nudge firing WHILE THE APP IS FOREGROUNDED is DELIBERATELY
// suppressed (no banner, no shade-list) AND kept silent (shouldPlaySound:false) to
// honour the calm/anti-nag mandate — made explicit here so it cannot drift with
// Expo's default. Tap/action ROUTING is independent of this handler (it runs off
// the response listener + getLastNotificationResponseAsync in NotificationResponseGate).
Notifications.setNotificationHandler({
  handleNotification: async () => FOREGROUND_NOTIFICATION_BEHAVIOR,
});

// One-shot guard: the field-expiry hook must be registered on the launch-sweep
// registry EXACTLY once. The `ready`-gated effect below can re-run (Strict Mode,
// remounts), and registering the same hook twice would double-run it — so this
// module-scope flag makes registration idempotent across effect re-entries.
let fieldSweepRegistered = false;
let memoryTrashSweepRegistered = false;
let backupSweepRegistered = false;
// One-shot guard for the photo-write reconciliation hook (PHOTO-03/05), on the
// SAME registry and under the SAME re-entrancy reasoning as the field sweep.
let photoReconcileRegistered = false;
let backgroundReconcileRegistered = false;
let restorePhotoFinalizeSweepRegistered = false;
// One-shot guard for the notification-schedule reconcile hook (NOTIF-01/04), on the
// SAME registry and under the SAME re-entrancy reasoning. Registered ready-gated so
// the reconcile fires once per real foreground launch — never at import, never on a
// headless tap (T-11-SWEEP).
let notificationScheduleRegistered = false;
// One-shot guard for the weekly-digest reconcile hook (DGST-01), on the SAME
// registry and under the SAME re-entrancy reasoning as the notification schedule.
// Its OWN sweep hook (separate from the decay/birthday reconcile) — registered
// ready-gated so the digest re-arms once per real foreground launch, never at
// import, never on a headless tap.
let digestScheduleRegistered = false;
// One-shot guard for the widget foreground-refresh hook (WDG-03), on the SAME
// registry and under the SAME re-entrancy reasoning. Registered ready-gated so the
// widget recompute fires once per real foreground launch — never at import, never
// on a headless tap (this is a foreground SweepHook; the headless tap path never
// reaches the sweep runner).
let widgetSweepRegistered = false;
// One-shot guard for the durable import resume hook. It is ready-gated with the
// other launch hooks so Strict Mode/remounts cannot double-prompt a session.
let importResumeSweepRegistered = false;
let reconcileResumeSweepRegistered = false;
let interactionAssistSweepRegistered = false;

function AppShell() {
  const { colors, mode } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Reactive navigator-readiness flag (A4-refine). `NavigationContainer`'s
  // `onReady` flips this true once the container has mounted and reported ready;
  // it is passed to `<ShareIntentGate/>` and keys its navigate effect alongside
  // `hasShareIntent`, so a cold-start share that lands before the container is
  // ready still navigates the moment readiness settles (no stranded intent).
  const [navReady, setNavReady] = useState(false);
  const [resumableImport, setResumableImport] =
    useState<ResumableImport | null>(null);
  const [resumableReconcile, setResumableReconcile] =
    useState<ResumableReconcile | null>(null);

  const syncFocusedRoute = () => {
    setFocusedRouteName(navigationRef.current?.getCurrentRoute()?.name);
  };

  // 1. Migrate before first render. Hold `ready` false until it resolves. A
  //    rejection (failed migration) is caught so the app surfaces a themed error
  //    state instead of hanging on the spinner with an unhandled rejection.
  useEffect(() => {
    let active = true;
    openAndMigrate(getDeviceRegion())
      .then(async () => {
        // After migration 015 is committed, run the one-time legacy orbit-theme
        // import + read the durable theme selection, THEN hydrate the store, THEN
        // flip `ready` — so the first painted MAIN frame carries the saved palette
        // (restore-before-paint, no wrong-theme flash). The coordinator is
        // internally error-isolated (getItem/parse/clear/write failures are
        // non-fatal), so a legacy-import hiccup never blocks boot.
        //
        // The expo-font load (THEME-07) is folded into the SAME ready gate — run
        // in parallel with the theme read so first paint carries the real fonts.
        // `loadAppFonts()` RESOLVES even on a font-load failure (degrade to the
        // system font), so it can never reach this effect's `.catch` or block
        // boot in the startup-error state (REVIEWS 23-02 MEDIUM).
        const [settings] = await Promise.all([
          hydrateThemeAtBoot({
            getItem: (key) => AsyncStorage.getItem(key),
            removeItem: (key) => AsyncStorage.removeItem(key),
            getAppSettings: () => getAppSettings(getExecutor()),
            updateAppSettings: (patch) =>
              updateAppSettings(getExecutor(), patch, localDateTime()),
          }),
          loadAppFonts(),
        ]);
        if (!active) return;
        useThemeStore.getState().hydrate(themeSelectionFromSettings(settings));
        setReady(true);
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
    // The confirmation queue has its own per-return subscription: unlike the
    // launch sweep, it refreshes for every real background-to-active return.
    void useAssistBanner.getState().refresh();
    const assistSubscription = subscribeAppState(AppState);
    // Register the launch field sweep (FLD-05) on the registry BEFORE the trigger
    // fires its cold-start sweep — once only (module guard), and only now that
    // migration has resolved so `getExecutor()` has a live connection.
    if (!fieldSweepRegistered) {
      registerFieldSweep(getExecutor);
      fieldSweepRegistered = true;
    }
    // Memory and Undo-only relationship trash expire only on a real foreground
    // launch, after migration makes their tables available and before the
    // trigger fires its cold-start sweep.
    if (!memoryTrashSweepRegistered) {
      registerMemoryTrashSweep(getExecutor);
      memoryTrashSweepRegistered = true;
    }
    // Backup must register before the trigger's cold-start foreground sweep.
    if (!backupSweepRegistered) {
      registerBackupSweep(getExecutor);
      backupSweepRegistered = true;
    }
    // Durable assist rows are bounded only during a real foreground launch. The
    // hook gets its executor lazily and is registered before the cold-start
    // trigger, so headless widget/notification taps cannot reach it.
    if (!interactionAssistSweepRegistered) {
      registerSweepHook(interactionAssistSweep(getExecutor));
      interactionAssistSweepRegistered = true;
    }
    // Register the photo-write reconciliation (PHOTO-03/05) on the same registry,
    // once only, BEFORE the trigger fires its cold-start sweep. FS-only, no
    // executor. No background timer — the launch sweep is the recovery path.
    if (!photoReconcileRegistered) {
      registerPhotoReconcileSweep();
      photoReconcileRegistered = true;
    }
    // Profile image derivatives use their own UID-derived namespace and must
    // reconcile only after migrations expose template referrers. Register before
    // the trigger so interrupted swaps and zero-referrer orphans recover on the
    // cold-start sweep, never from module scope or a background timer.
    if (!backgroundReconcileRegistered) {
      registerBackgroundReconcileSweep(getExecutor);
      backgroundReconcileRegistered = true;
    }
    // A committed restore-photo journal is drained only on real foreground
    // launches, after migration readiness and before the cold-start sweep fires.
    if (!restorePhotoFinalizeSweepRegistered) {
      registerRestorePhotoFinalizeSweep(getExecutor);
      restorePhotoFinalizeSweepRegistered = true;
    }
    // Register the notification-schedule reconcile (NOTIF-01/04) on the SAME
    // registry, once only, BEFORE the trigger fires its cold-start sweep. The exec
    // is taken lazily inside the hook; the reconcile is a launch-sweep hook ONLY
    // (never called directly here) so it fires once per real foreground launch and
    // is unreachable from the headless tap path (T-11-SWEEP / Pitfall P5).
    if (!notificationScheduleRegistered) {
      registerNotificationScheduleSweep(getExecutor);
      notificationScheduleRegistered = true;
    }
    // Register the weekly-digest reconcile (DGST-01) on the SAME registry, once
    // only, BEFORE the trigger fires its cold-start sweep. Its OWN hook — the
    // decay/birthday reconcile never touches digest:weekly (T-15-06). The digest-v1
    // channel is already created by ensureChannels() (awaited below) before the
    // sweep begins scheduling.
    if (!digestScheduleRegistered) {
      registerDigestScheduleSweep(getExecutor);
      digestScheduleRegistered = true;
    }
    // Register the widget foreground-refresh recompute (WDG-03) on the SAME
    // registry, once only, BEFORE the trigger fires its cold-start sweep — so a
    // real foreground launch recomputes + re-pushes every placed OrbitFavourites
    // instance (no polling). registerWidgetSweep plugs pushWidgetUpdate into the
    // launch-sweep registry; it is a FOREGROUND SweepHook and is never reached
    // from the headless tap path.
    if (!widgetSweepRegistered) {
      registerWidgetSweep();
      widgetSweepRegistered = true;
    }
    // The resume hook reads only the durable snapshot after migrations. Register
    // it before the cold-start trigger; the module-scope guard prevents duplicate
    // sweep hooks and duplicate modal prompts across effect re-entries.
    if (!importResumeSweepRegistered) {
      registerImportResumeSweep(setResumableImport, { getExecutor });
      importResumeSweepRegistered = true;
    }
    if (!reconcileResumeSweepRegistered) {
      registerReconcileResumeSweep(setResumableReconcile, { getExecutor });
      reconcileResumeSweepRegistered = true;
    }

    // item 6 / A1: AWAIT channels + the action category into existence BEFORE the
    // trigger fires the cold-start reconcile (which begins scheduling immediately).
    // Channel visibility is IMMUTABLE at creation, so a schedule landing before its
    // private/public channel exists is a privacy landmine on a restore-into-fresh-
    // install path — fire-and-forget would race the first scheduleNotificationAsync
    // against channel creation. Both calls are idempotent and Logger-guarded.
    let cancelled = false;
    let subscription: { remove(): void } | null = null;
    (async () => {
      try {
        await ensureChannels();
        await ensureNotificationCategories();
      } catch (err) {
        Logger.error(
          "bootstrap",
          "notification channel/category init failed",
          err,
        );
      }
      // If the effect was torn down while channels initialised, do not install.
      if (cancelled) return;
      subscription = installSweepTrigger(AppState);
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      assistSubscription.remove();
    };
  }, [ready]);

  if (error) {
    const isIntegrityFailure = isMigration006IntegrityError(error);
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          {isIntegrityFailure
            ? "Couldn't safely update your custom fields"
            : "Couldn't start Orbit"}
        </Text>
        <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
          {isIntegrityFailure
            ? "Orbit stopped before changing anything, so all your data is safe and unchanged. This version can't finish updating your custom fields on this device, and reopening won't change that. Nothing has been altered or lost."
            : "Your data is safe and unchanged. Please reopen the app."}
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
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme[mode]}
      onReady={() => {
        setNavReady(true);
        syncFocusedRoute();
      }}
      onStateChange={syncFocusedRoute}
    >
      <ShareIntentGate isReady={navReady} />
      {/* Render-null gate: owns its own response listener + cold-start read; keyed
          on the SAME reactive navReady flag as ShareIntentGate so a tap routes the
          moment the navigator settles (body taps queued until ready). */}
      <NotificationResponseGate isReady={navReady} />
      {/* Render-null gate: owns its own Linking url listener + cold-start
          getInitialURL read, resolves through the strict orbit:// allow-list
          (12-04), and is keyed on the SAME reactive navReady flag as the other
          gates so a widget deep link routes the moment the navigator settles
          (pre-ready intents queue in the gate and flush on navReady). */}
      <WidgetLinkingGate isReady={navReady} />
      <RootNavigator />
      <UniversalFab />
      <Snackbar />
      <AssistBanner />
      {resolveActiveResumePrompt(resumableImport, resumableReconcile) ===
      "import" ? (
        <ResumeImportPrompt
          resumable={resumableImport}
          onDismiss={() => setResumableImport(null)}
        />
      ) : null}
      {resolveActiveResumePrompt(resumableImport, resumableReconcile) ===
      "reconcile" ? (
        <ResumeReconcilePrompt
          resumable={resumableReconcile}
          onDismiss={() => setResumableReconcile(null)}
        />
      ) : null}
    </NavigationContainer>
  );
}

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "light" ? "dark" : "light"} />;
}

export default function App() {
  // Task 17-07 only: a purpose-built release APK can opt into the native KDF
  // timing harness. This literal is compiled in by Expo only for that one
  // measurement build; ordinary product builds never mount the harness.
  const benchmarkMode =
    process.env.EXPO_PUBLIC_BACKUP_ENCRYPTION_BENCHMARK === "1";
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
            <ThemedStatusBar />
            {benchmarkMode ? (
              <BackupEncryptionBenchmarkHarness />
            ) : (
              <AppShell />
            )}
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
