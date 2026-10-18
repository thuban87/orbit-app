import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  applyRestore,
  type RestoreMode,
  type RestoreProgressStep,
} from "@/backup/restore-apply";
import { ShellAppBar } from "@/components/ShellAppBar";
import { OptionSelectRow, OptionSheet } from "@/components/ui";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  DEFAULT_RESTORE_HOST,
  RESTORE_SUCCESS_BASE_ROUTE,
} from "@/screens/backup-dualhome-logic";
import {
  backupNeedsBackgroundConsent,
  type ConfirmedRestoreApply,
  confirmRestoreApply,
  createRestoreApplyRun,
  createRestoreApplySingleFlight,
  RESTORE_MODE_OPTIONS,
  type RestoreApplyConfirmation,
  type RestoreApplyConfirmationResult,
  restoreApplyLabel,
  restoreApplyRecovery,
  restoreModeLabel,
  restorePeopleComparison,
  restorePreviewCache,
  restoreProgressLabel,
  toRestoreResultParams,
} from "@/screens/backup-restore-logic";
import { createVerifiedPreRestoreSnapshot } from "@/services/backup/backup-service";
import {
  APPROVED_BACKUP_ENCRYPTION_PROFILE,
  createBackupEnvelopeCrypto,
} from "@/services/backup/encryption";
import { backupPassphraseStore } from "@/services/backup/passphrase-store";
import { publishCommittedRestore } from "@/services/backup/restore-completion";
import { createSafStorage } from "@/services/backup/saf-storage";
import { readStoredPhotoBase64 } from "@/services/backup/share-export";
import { confirm } from "@/stores/confirm-store";
import { useThemeStore } from "@/stores/theme-store";
import { useTheme } from "@/theme";
import { formatSourceTimeMinuteOrFallback } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "restore-preview";

/**
 * The apply's one confirmation dialog (Replace-all, and/or the 38.5 D-47
 * unavailable-background question), themed (38.9 D-27). A destructive
 * Replace-all cannot be dismissed by Back or the scrim (D-06, ADR-086); the
 * non-destructive question can, and dismissing it cancels.
 */
function confirmApply(
  confirmation: RestoreApplyConfirmation,
): Promise<boolean> {
  return confirm({
    title: confirmation.title,
    message: confirmation.message,
    cancelLabel: confirmation.cancelLabel,
    confirmLabel: confirmation.confirmLabel,
    destructive: confirmation.destructive,
    dismissable: !confirmation.destructive,
  });
}

/** This phone's settings LWW stamp, for the D-47 / RA-a consent decision. */
async function readLocalSettingsModifiedAt(): Promise<string> {
  return (await getAppSettings(getExecutor())).modifiedAt;
}

async function createPreRestoreSnapshot() {
  const exec = getExecutor();
  const settings = await getAppSettings(exec);
  if (!settings.backupFolderUri) return { status: "failed" as const };
  return createVerifiedPreRestoreSnapshot({
    exec,
    exportedAt: localDateTime(),
    now: new Date(),
    readPhotoBase64: readStoredPhotoBase64,
    directoryUri: settings.backupFolderUri,
    retentionDays: settings.backupRetentionDays,
    storage: createSafStorage(),
    encryption: {
      enabled: settings.encryptionEnabled === 1,
      passphrase: await backupPassphraseStore.getPassphrase(),
      encrypt: (contents, passphrase) =>
        JSON.stringify(
          createBackupEnvelopeCrypto({
            profiles: [APPROVED_BACKUP_ENCRYPTION_PROFILE],
          }).encrypt({
            passphrase,
            plaintext: new TextEncoder().encode(contents),
            profile: APPROVED_BACKUP_ENCRYPTION_PROFILE,
          }),
        ),
    },
  })();
}

export function RestorePreviewScreen({
  navigation,
  route,
}: RootStackScreenProps<"RestorePreview">) {
  // 38.12 D-68: the host travels as a route param (absent = settings).
  const host = route.params.host ?? DEFAULT_RESTORE_HOST;
  const { colors } = useTheme();
  // A focused page (D-114): no tab bar and no +, so the last item only clears
  // the system navigation area.
  const bottomClearance = useSafeAreaInsets().bottom + 16;
  // Merge is preselected (D-23); Replace all is explicitly confirmed.
  const [mode, setMode] = useState<RestoreMode>("merge");
  // The shared single-choice sheet for the mode (D-61).
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  // D-69: the step applyRestore last reported, shown in the busy state.
  const [progressStep, setProgressStep] = useState<RestoreProgressStep | null>(
    null,
  );
  const [expired, setExpired] = useState(
    () => restorePreviewCache.read(route.params.token) === null,
  );
  const [applying, setApplying] = useState(false);
  // True from the Apply tap until the confirmation settles and the apply
  // completes or is cancelled: the mode radios and Apply are disabled (WR-1).
  const [modeLocked, setModeLocked] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const executeRef = useRef<
    (confirmed: ConfirmedRestoreApply) => Promise<void>
  >(async () => {});
  const confirmRef = useRef<
    (mode: RestoreMode) => Promise<RestoreApplyConfirmationResult>
  >(async () => ({ status: "cancelled" }));
  // The preview notice shows exactly when the apply will ask (RA-a / D-49): an
  // unavailable id in settings this mode will write. A Merge whose backup
  // settings are older than this phone's skips them, so it shows nothing.
  const [unavailableBackground, setUnavailableBackground] = useState(false);
  useEffect(() => {
    // Clear the previous mode's answer before the new read starts, so the
    // notice never shows a stale decision while it runs (scoped re-check IN-1).
    setUnavailableBackground(false);
    const cached = restorePreviewCache.read(route.params.token);
    if (cached === null) return;
    let current = true;
    backupNeedsBackgroundConsent(cached, mode, readLocalSettingsModifiedAt)
      .then((needed) => {
        if (current) setUnavailableBackground(needed);
      })
      .catch((error: unknown) => {
        // The notice is informational; the apply's own confirmation re-reads
        // and decides, and surfaces a failure there.
        Logger.error(LOG_SCOPE, "failed to read the local settings", error);
        if (current) setUnavailableBackground(false);
      });
    return () => {
      current = false;
    };
  }, [mode, route.params.token]);
  const allowNavigationRef = useRef(false);
  const runSingleApply = useRef(
    createRestoreApplySingleFlight((confirmed: ConfirmedRestoreApply) =>
      executeRef.current(confirmed),
    ),
  ).current;
  // One Apply tap: the confirmation for the mode at the tap, then the apply
  // with the mode that confirmation carries. The mode is locked throughout, so
  // a radio tap cannot swap Replace-all in behind Merge's dialog (38.5 scoped
  // re-check WR-1; D-47 "each path shows one dialog").
  const applyRun = useRef(
    createRestoreApplyRun({
      confirm: (confirmMode) => confirmRef.current(confirmMode),
      apply: (confirmed) => runSingleApply(confirmed),
    }),
  ).current;
  const selectMode = useCallback(
    (next: RestoreMode) => {
      if (applyRun.acceptsModeChange()) setMode(next);
    },
    [applyRun],
  );

  useEffect(() => {
    setExpired(restorePreviewCache.read(route.params.token) === null);
  }, [route.params.token]);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (applying && !allowNavigationRef.current) event.preventDefault();
      }),
    [applying, navigation],
  );

  // Re-pick a file (D-67): pop back to the Backup page beneath this one, so the
  // host's stack (Settings under Backup) stays. Its host is passed again
  // because popTo replaces the route's params.
  const returnToSelection = useCallback(() => {
    navigation.popTo("Backup", { host });
  }, [host, navigation]);

  confirmRef.current = (confirmMode) =>
    // One dialog at most: Replace-all's, carrying the D-47 notice when a
    // background is unavailable, or for Merge the D-47 question alone. Cancel
    // returns before anything is written.
    confirmRestoreApply(
      restorePreviewCache,
      route.params.token,
      confirmMode,
      {
        destinationConfigured: async () =>
          Boolean((await getAppSettings(getExecutor())).backupFolderUri),
        localSettingsModifiedAt: readLocalSettingsModifiedAt,
      },
      confirmApply,
    );

  // The apply runs with the CONFIRMED candidate, mode and D-47 answer, never
  // this render's `mode` (WR-1).
  executeRef.current = async (confirmed) => {
    setApplying(true);
    setApplyError(null);
    setProgressStep(null);
    try {
      const result = await applyRestore(
        getExecutor(),
        confirmed.candidate.manifest,
        confirmed.mode,
        {
          createVerifiedPreRestoreSnapshot: createPreRestoreSnapshot,
          unavailableBackgrounds: confirmed.useDefaultBackgrounds
            ? "use-default"
            : "reject",
          onProgress: setProgressStep,
        },
      );
      if (result.status !== "applied") {
        setApplyError(restoreApplyRecovery(result.status).message);
        return;
      }
      await publishCommittedRestore({
        readSettings: () => getAppSettings(getExecutor()),
        hydrate: (selection) => useThemeStore.getState().hydrate(selection),
      });
      // The success reset intentionally removes this route while `applying` is
      // still true; permit that internal navigation while retaining the guard
      // against user Back actions during the apply.
      allowNavigationRef.current = true;
      restorePreviewCache.discard(route.params.token);
      // The success reset leaves Backup restored on the Settings hub, so its
      // Back lands there; the result carries the host, which drives its
      // return button (D-68).
      navigation.reset({
        index: 1,
        routes: [
          { name: RESTORE_SUCCESS_BASE_ROUTE },
          {
            name: "RestoreResult",
            params: { ...toRestoreResultParams(result), host },
          },
        ],
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "restore apply failed", error);
      setApplyError(restoreApplyRecovery("unexpected").message);
    } finally {
      setApplying(false);
    }
  };

  const beginApply = useCallback(async () => {
    if (!applyRun.acceptsModeChange()) return;
    setModeLocked(true);
    try {
      const outcome = await applyRun.begin(mode);
      if (outcome.status === "expired") setExpired(true);
    } catch (error) {
      // The apply catches its own failures; this is the confirmation's.
      Logger.error(LOG_SCOPE, "failed to confirm the restore apply", error);
      setApplyError(restoreApplyRecovery("unexpected").message);
    } finally {
      setModeLocked(false);
    }
  }, [applyRun, mode]);

  if (expired) {
    // The expired preview's Back returns to Backup to choose the file again,
    // the same reset as "Choose file again" (38.9 D-16 onBack override).
    return (
      <View style={styles.root}>
        <ShellAppBar
          variant="child"
          title="Restore preview"
          onBack={returnToSelection}
        />
        <ScrollView
          testID="restore-preview-expired"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomClearance },
          ]}
        >
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary }]}
            >
              Preview expired
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Choose the backup file again to preview it safely.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose file again"
              onPress={returnToSelection}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            >
              <Text style={{ color: colors.onAccent }}>Choose file again</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const { preview } = route.params;
  // Header Back is goBack(); the beforeRemove hold above keeps the user on this
  // screen while a restore applies (38.9 D-16), and the header Back is drawn
  // disabled for that time so it never looks live (D-26; review WR-04).
  return (
    <View style={styles.root}>
      <ShellAppBar
        variant="child"
        title="Restore preview"
        backDisabled={applying}
      />
      <ScrollView
        testID="restore-preview-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Backup details
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Source date: {formatSourceTimeMinuteOrFallback(preview.exportedAt)}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Backup version: {preview.backupFormatVersion}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Encryption:{" "}
            {preview.encrypted
              ? "Protected with a passphrase"
              : "Readable JSON"}
          </Text>
          <Text style={[styles.body, { color: colors.textPrimary }]}>
            {restorePeopleComparison(preview)}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Linked items: {preview.relatedRowCount} · Photos:{" "}
            {preview.photoCount} · Deleted items kept: {preview.tombstoneCount}
          </Text>
        </View>
        {unavailableBackground ? (
          <View
            testID="restore-background-unavailable"
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Background not available
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              A background selected in this backup is no longer available. Orbit
              will ask before switching to the default background instead.
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Restore mode
          </Text>
          <OptionSelectRow
            testID="restore-mode"
            label="Restore mode"
            currentLabel={restoreModeLabel(mode)}
            disabled={applying || modeLocked}
            onPress={() => {
              if (applyRun.acceptsModeChange()) setModeSheetOpen(true);
            }}
          />
          <Text
            testID="restore-mode-description"
            style={[
              styles.body,
              {
                color:
                  mode === "replace-all" ? colors.danger : colors.textSecondary,
              },
            ]}
          >
            {mode === "merge"
              ? "Add backup changes while keeping newer local data."
              : "Replace local data with this backup. This is destructive."}
          </Text>
        </View>
        <OptionSheet
          visible={modeSheetOpen}
          title="Restore mode"
          options={RESTORE_MODE_OPTIONS}
          selected={mode}
          searchable={false}
          onSelect={selectMode}
          onRequestClose={() => setModeSheetOpen(false)}
        />
        {applyError ? (
          <View
            testID="restore-apply-error"
            accessibilityLiveRegion="polite"
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {applyError}
            </Text>
          </View>
        ) : null}
        {applying ? (
          <View
            testID="restore-applying"
            accessibilityLiveRegion="polite"
            accessibilityLabel={restoreProgressLabel(progressStep)}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              testID="restore-progress-step"
              style={[styles.cardTitle, { color: colors.textPrimary }]}
            >
              {restoreProgressLabel(progressStep)}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              This can take a moment. Orbit will only change local data after
              this backup is ready to apply.
            </Text>
          </View>
        ) : null}
        <Pressable
          testID="restore-apply"
          accessibilityRole="button"
          accessibilityLabel={restoreApplyLabel(mode)}
          accessibilityState={{ disabled: applying || modeLocked }}
          disabled={applying || modeLocked}
          onPress={() => void beginApply()}
          style={[
            styles.primaryButton,
            {
              backgroundColor:
                mode === "replace-all" ? colors.danger : colors.accent,
              opacity: applying || modeLocked ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={{
              color: mode === "replace-all" ? colors.onDanger : colors.onAccent,
            }}
          >
            {restoreApplyLabel(mode)}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "600", lineHeight: 29 },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 8 },
  cardTitle: { fontSize: 20, fontWeight: "600", lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
});
