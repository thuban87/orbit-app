import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { applyRestore, type RestoreMode } from "@/backup/restore-apply";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import {
  type BackupHost,
  DEFAULT_BACKUP_HOST,
  restoreReturnRouteName,
} from "@/screens/backup-dualhome-logic";
import {
  backupNeedsBackgroundConsent,
  type ConfirmedRestoreApply,
  confirmRestoreApply,
  createRestoreApplyRun,
  createRestoreApplySingleFlight,
  type RestoreApplyConfirmation,
  type RestoreApplyConfirmationResult,
  restoreApplyLabel,
  restoreApplyRecovery,
  restorePreviewCache,
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
import { useThemeStore } from "@/stores/theme-store";
import { useTheme } from "@/theme";
import { formatDateTimeMinuteOrFallback } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "restore-preview";

/**
 * The apply's one confirmation dialog (Replace-all, and/or the 38.5 D-47
 * unavailable-background question). Dismissing it cancels.
 */
function confirmApply(
  confirmation: RestoreApplyConfirmation,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      confirmation.title,
      confirmation.message,
      [
        {
          text: confirmation.cancelLabel,
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: confirmation.confirmLabel,
          style: confirmation.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
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
  host = DEFAULT_BACKUP_HOST,
}: RootStackScreenProps<"RestorePreview"> & { host?: BackupHost }) {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const [mode, setMode] = useState<RestoreMode>("merge");
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

  // Re-pick a file: intentionally stays targeting `Backup`, NOT the origin hub.
  // `Backup` exists in BOTH hosting stacks, so this reset resolves within
  // whichever stack currently hosts this screen — the user lands back on the
  // Backup screen to choose another file, which is the right destination for a
  // "choose file again" affordance regardless of entry point (review MEDIUM:
  // this site is deliberately not origin-routed, unlike the success/return sites).
  const returnToSelection = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: "Backup" }] });
  }, [navigation]);

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
      // Origin-aware success reset: the BASE route is the entry point's return
      // target (Backup tab → `Backup`, UNCHANGED; Settings entry → `Settings`
      // hub) so RestoreResult sits atop the right root. The RestoreResult that
      // lands is the same-stack copy — its own `host` drives its return button.
      navigation.reset({
        index: 1,
        routes: [
          { name: restoreReturnRouteName(host) },
          { name: "RestoreResult", params: toRestoreResultParams(result) },
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
    return (
      <ScrollView
        testID="restore-preview-expired"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to backup and restore"
          onPress={returnToSelection}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
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
    );
  }

  const { preview } = route.params;
  return (
    <ScrollView
      testID="restore-preview-screen"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomClearance },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        accessibilityState={{ disabled: applying }}
        disabled={applying}
        onPress={() => navigation.goBack()}
        style={[
          styles.back,
          { borderColor: colors.border, opacity: applying ? 0.6 : 1 },
        ]}
      >
        <Text style={{ color: colors.textSecondary }}>Back</Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.textPrimary }]}
      >
        Restore preview
      </Text>
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
          Source date: {formatDateTimeMinuteOrFallback(preview.exportedAt)}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Format version: {preview.backupFormatVersion}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Encryption:{" "}
          {preview.encrypted ? "Protected with a passphrase" : "Readable JSON"}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Contacts: {preview.contactCount} · Related rows:{" "}
          {preview.relatedRowCount} · Photos: {preview.photoCount} · Tombstones:{" "}
          {preview.tombstoneCount}
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
      <Pressable
        testID="restore-mode-merge"
        accessibilityRole="radio"
        accessibilityLabel="Merge backup"
        accessibilityState={{
          selected: mode === "merge",
          disabled: applying || modeLocked,
        }}
        disabled={applying || modeLocked}
        onPress={() => selectMode("merge")}
        style={[
          styles.card,
          {
            backgroundColor:
              mode === "merge" ? colors.surfaceElevated : colors.surface,
            borderColor: mode === "merge" ? colors.accent : colors.border,
          },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          Merge
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Add backup changes while keeping newer local data.
        </Text>
      </Pressable>
      <Pressable
        testID="restore-mode-replace"
        accessibilityRole="radio"
        accessibilityLabel="Replace all local data"
        accessibilityState={{
          selected: mode === "replace-all",
          disabled: applying || modeLocked,
        }}
        disabled={applying || modeLocked}
        onPress={() => selectMode("replace-all")}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: mode === "replace-all" ? colors.danger : colors.border,
          },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.danger }]}>
          Replace all
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Replace local data with this backup. This is destructive.
        </Text>
      </Pressable>
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
          accessibilityLabel="Restoring backup"
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Restoring backup…
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            This can take a moment. Orbit will only change local data after this
            backup is ready to apply.
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
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  back: {
    minHeight: 44,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
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
