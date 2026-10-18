import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/components/icons/Icon";
import { ShellAppBar } from "@/components/ShellAppBar";
import { SettingsRow, SettingsSectionCard } from "@/components/ui";
import {
  getAppSettings,
  recordAutomaticBackupHealthCore,
} from "@/db/app-settings-dao";
import { hasMeaningfulBackupData } from "@/db/backup-meaningful-read";
import { getExecutor, localDateTime } from "@/db/database";
import { inWriteTransaction } from "@/db/transaction";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import {
  chooseAutomaticBackupFolder,
  runAutomaticBackupNow,
} from "@/services/backup/backup-now";
import {
  createManualExportService,
  loadBackupForRestorePreview,
} from "@/services/backup/backup-service";
import {
  APPROVED_BACKUP_ENCRYPTION_PROFILE,
  createBackupEnvelopeCrypto,
} from "@/services/backup/encryption";
import { backupPassphraseStore } from "@/services/backup/passphrase-store";
import {
  createSafStorage,
  ownedAutomaticUris,
} from "@/services/backup/saf-storage";
import {
  createExpoShareAdapter,
  createLocalExportFiles,
  readStoredPhotoBase64,
} from "@/services/backup/share-export";
import {
  automaticSkippedPhotosLine,
  readAutomaticSkippedPhotos,
  skippedPhotosCopy,
} from "@/services/backup/skipped-photos";
import { choose, notice } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { plural } from "@/utils/plural";
import {
  consumeSharedBackup,
  pickBackupDocument,
} from "../../modules/orbit-backup-document-picker";
import {
  backupAppBarVariant,
  DEFAULT_RESTORE_HOST,
  shouldConsumeSharedBackup,
} from "./backup-dualhome-logic";
import {
  type BackUpNowOutcome,
  type BackupHealth,
  backUpNowSnackbar,
  backupWarningAction,
  backupWarningActionLabel,
  keptBackupsLine,
  manualExportFailureCopy,
  resolveBackupHealth,
  resolveBackupNudge,
} from "./backup-health-logic";
import { readRestoreDocument } from "./backup-restore-document";
import {
  backupIntakeFailureMessage,
  isEncryptedBackupEnvelope,
  restorePreviewCache,
  restorePreviewFailure,
} from "./backup-restore-logic";
import { backupFolderDisplayName } from "./backup-settings-logic";

const LOG_SCOPE = "backup-screen";

function relativeTime(value: string): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "recently";
  const elapsedMinutes = Math.max(
    0,
    Math.round((Date.now() - milliseconds) / 60_000),
  );
  if (elapsedMinutes < 2) return "just now";
  if (elapsedMinutes < 60) return `${plural(elapsedMinutes, "minute")} ago`;
  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 48) return `${plural(hours, "hour")} ago`;
  const days = Math.round(hours / 24);
  return `${plural(days, "day")} ago`;
}

export function BackupScreen({
  navigation,
  route,
}: RootStackScreenProps<"Backup">) {
  // 38.12 D-68: the host travels as a route param (absent = settings).
  const host = route.params?.host ?? DEFAULT_RESTORE_HOST;
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const [health, setHealth] = useState<BackupHealth | null>(null);
  // D-24: photos the latest automatic backup left out (device-local record).
  const [automaticSkippedLine, setAutomaticSkippedLine] = useState<
    string | null
  >(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Synchronous single-flight for Export (38.9 review WR-01): set from the
  // first tap — before the readable-JSON prompt — until the export settles.
  // `exporting` state alone is read from a stale closure, and a duplicate
  // identical confirm resolves false at once, which here would mean "run an
  // encrypted export" while the first prompt is still open.
  const exportInFlightRef = useRef(false);
  const [restoreStage, setRestoreStage] = useState<
    "idle" | "loading" | "passphrase"
  >("idle");
  const [selectedEncryptedContents, setSelectedEncryptedContents] = useState<
    string | null
  >(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  // D-124: the restore passphrase starts hidden; the eye button reveals it.
  const [passphraseVisible, setPassphraseVisible] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  // D-115: "Back up now" / "Choose a folder" on the warning card. The ref is
  // the synchronous single-flight (a double tap starts one write, T-38.12-39);
  // the state draws the button busy.
  const warningActionInFlightRef = useRef(false);
  const [warningActionBusy, setWarningActionBusy] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    void (async () => {
      try {
        const exec = getExecutor();
        const [settings, meaningful, skippedRecord] = await Promise.all([
          getAppSettings(exec),
          hasMeaningfulBackupData(exec),
          readAutomaticSkippedPhotos(),
        ]);
        const nudge = resolveBackupNudge(
          {
            hasMeaningfulData: meaningful,
            lastAutomaticBackupAt: settings.lastAutomaticBackupAt,
            currentDataRevision: settings.dataRevision,
            lastBackupDataRevision: settings.lastBackupDataRevision,
            dismissed: settings.backupNudgeDismissed === 1,
          },
          new Date(),
        );
        if (nudge.shouldResetDismissal) {
          await inWriteTransaction(exec, () =>
            recordAutomaticBackupHealthCore(exec, { backupNudgeDismissed: 0 }),
          );
        }
        if (cancelled) return;
        const healthInput = {
          folderUri: settings.backupFolderUri,
          // D-62: the folder's real name, from its URI at display time.
          folderName: settings.backupFolderUri
            ? backupFolderDisplayName(settings.backupFolderUri)
            : null,
          folderAccessible: settings.backupFolderAccessible === 1,
          folderDiagnostic: settings.backupFolderDiagnostic,
          lastAutomaticBackupAt: settings.lastAutomaticBackupAt,
          currentDataRevision: settings.dataRevision,
          lastBackupDataRevision: settings.lastBackupDataRevision,
          intervalDays: settings.backupIntervalDays,
        };
        setHealth(resolveBackupHealth(healthInput, new Date()));
        setAutomaticSkippedLine(
          automaticSkippedPhotosLine(
            skippedRecord,
            settings.lastAutomaticBackupAt,
          ),
        );
        setEncryptionEnabled(settings.encryptionEnabled === 1);
        setShowNudge(nudge.shouldShow);
        // D-62: the hero counts the owned automatic backups really in the
        // folder. Listed after the card is drawn, so a slow provider never
        // holds the card back; a failed listing leaves the count unknown.
        if (settings.backupFolderUri && settings.backupFolderAccessible === 1) {
          try {
            const automaticFileCount = ownedAutomaticUris(
              await createSafStorage().list(settings.backupFolderUri),
            ).length;
            if (cancelled) return;
            setHealth(
              resolveBackupHealth(
                { ...healthInput, automaticFileCount },
                new Date(),
              ),
            );
          } catch (error) {
            Logger.warn(LOG_SCOPE, "could not count kept backups", error);
          }
        }
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to load backup health", error);
        if (!cancelled) {
          setHealth(null);
          setAutomaticSkippedLine(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  const openSettings = useCallback(
    (section?: "automatic" | "encryption") =>
      navigation.navigate("BackupSettings", { section }),
    [navigation],
  );

  // D-115: the automatic backup's own write-verify-record function, with no
  // due gate; then a snackbar, and the reload clears the warning on success.
  const backUpNow = useCallback(async () => {
    let outcome: BackUpNowOutcome;
    try {
      outcome = await runAutomaticBackupNow({ exec: getExecutor() });
    } catch (error) {
      Logger.error(LOG_SCOPE, "back up now failed", error);
      outcome = { status: "error" };
    }
    showSnackbar(backUpNowSnackbar(outcome, skippedPhotosCopy));
  }, []);

  const chooseFolder = useCallback(async () => {
    try {
      await chooseAutomaticBackupFolder({
        exec: getExecutor(),
        folderName: backupFolderDisplayName,
      });
    } catch (error) {
      Logger.error(LOG_SCOPE, "folder selection failed", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't choose folder. Please try again.",
      });
    }
  }, []);

  const runWarningAction = useCallback(
    async (action: "back-up-now" | "choose-folder") => {
      if (warningActionInFlightRef.current) return;
      warningActionInFlightRef.current = true;
      setWarningActionBusy(true);
      try {
        if (action === "back-up-now") await backUpNow();
        else await chooseFolder();
      } finally {
        warningActionInFlightRef.current = false;
        setWarningActionBusy(false);
        reload();
      }
    },
    [backUpNow, chooseFolder, reload],
  );

  const dismissNudge = useCallback(async () => {
    try {
      await inWriteTransaction(getExecutor(), () =>
        recordAutomaticBackupHealthCore(getExecutor(), {
          backupNudgeDismissed: 1,
        }),
      );
      setShowNudge(false);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to dismiss backup nudge", error);
    }
  }, []);

  const runExport = useCallback(async (readableOverride: boolean) => {
    exportInFlightRef.current = true;
    setExporting(true);
    try {
      const settings = await getAppSettings(getExecutor());
      const result = await createManualExportService({
        exec: getExecutor(),
        exportedAt: localDateTime(),
        readPhotoBase64: readStoredPhotoBase64,
        files: createLocalExportFiles(),
        share: createExpoShareAdapter(),
        encryption: {
          enabled: settings.encryptionEnabled === 1,
          passphrase: await backupPassphraseStore.getPassphrase(),
          crypto: createBackupEnvelopeCrypto({
            profiles: [APPROVED_BACKUP_ENCRYPTION_PROFILE],
          }),
          profile: APPROVED_BACKUP_ENCRYPTION_PROFILE,
        },
      }).shareExport({ readableOverride });
      const message = manualExportFailureCopy(result);
      if (message) {
        // 38.9 D-27: an over-cap export cannot be retried, so it is a
        // blocking notice; any other failure is a retryable error snackbar.
        if (result.status === "too-large") {
          void notice({ title: "Couldn't create export", message });
        } else {
          showSnackbar({
            kind: "error",
            label: `Couldn't create export. ${message}`,
          });
        }
      }
      // D-24: the export completed without some unreadable photos.
      const skipped =
        result.status === "shared"
          ? skippedPhotosCopy(result.skippedPhotos)
          : null;
      if (skipped) {
        showSnackbar({ kind: "success", label: `Export shared. ${skipped}` });
      }
    } catch (error) {
      Logger.error(LOG_SCOPE, "manual export failed", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't create export. Nothing was shared. Please try again.",
      });
    } finally {
      exportInFlightRef.current = false;
      setExporting(false);
    }
  }, []);

  const onExport = useCallback(async () => {
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    if (!encryptionEnabled) {
      void runExport(false);
      return;
    }
    // 38.12 D-63: two export choices and a Cancel. D-149 (owner): with
    // encryption on, the encrypted export is the primary button; the readable
    // export runs only from its own explicit secondary button (V6). Cancel,
    // Back and the scrim export nothing and release the single-flight claim.
    const choice = await choose({
      title: "Export your data?",
      message:
        "The encrypted export needs your backup passphrase to open. Anyone with a readable JSON file can read its contents, so use it only when you need a portable JSON backup.",
      confirmLabel: "Export encrypted",
      secondaryLabel: "Export readable JSON",
      cancelLabel: "Cancel",
    });
    if (choice === "cancel") {
      exportInFlightRef.current = false;
      return;
    }
    void runExport(choice === "secondary");
  }, [encryptionEnabled, runExport]);

  const validateRestore = useCallback(
    async (contents: string, passphrase?: string) => {
      setRestoreStage("loading");
      setRestoreMessage(null);
      // Let the loading announcement paint before a native crypto implementation
      // performs decrypt/parse/validation work on this JS turn.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      try {
        const candidate = await loadBackupForRestorePreview(getExecutor(), {
          contents,
          passphrase,
          crypto: createBackupEnvelopeCrypto({
            profiles: [APPROVED_BACKUP_ENCRYPTION_PROFILE],
          }),
        });
        if (candidate.status !== "ready") {
          const failure = restorePreviewFailure(candidate.reason);
          setRestoreMessage(failure.message);
          setRestoreStage(
            failure.step === "passphrase" ? "passphrase" : "idle",
          );
          if (failure.step === "selection") setSelectedEncryptedContents(null);
          return;
        }
        const previewRoute = restorePreviewCache.store(candidate);
        setSelectedEncryptedContents(null);
        setRestorePassphrase("");
        setPassphraseVisible(false);
        setRestoreStage("idle");
        // The host travels on to the preview and the result (D-68).
        navigation.navigate("RestorePreview", { ...previewRoute, host });
      } catch (error) {
        Logger.error(LOG_SCOPE, "restore preview validation failed", error);
        setSelectedEncryptedContents(null);
        setRestoreStage("idle");
        setRestoreMessage(
          "Couldn't restore this backup. Your local data hasn't changed. Please try again.",
        );
      }
    },
    [host, navigation],
  );

  const loadRestoreDocument = useCallback(
    async (uri: string) => {
      if (restoreStage === "loading") return;
      setRestoreMessage(null);
      try {
        const contents = await readRestoreDocument(uri);
        if (isEncryptedBackupEnvelope(contents)) {
          setSelectedEncryptedContents(contents);
          setRestorePassphrase("");
          setPassphraseVisible(false);
          setRestoreStage("passphrase");
          return;
        }
        void validateRestore(contents);
      } catch (error) {
        Logger.error(LOG_SCOPE, "restore document selection failed", error);
        setRestoreStage("idle");
        setRestoreMessage(
          "Couldn't restore this backup. Your local data hasn't changed. Please try again.",
        );
      }
    },
    [restoreStage, validateRestore],
  );

  const chooseRestore = useCallback(async () => {
    if (restoreStage === "loading") return;
    setRestoreMessage(null);
    try {
      const picked = await pickBackupDocument();
      const { uri, failed } = picked;
      if (failed) {
        setRestoreMessage(backupIntakeFailureMessage(picked));
        return;
      }
      if (!uri) return;
      await loadRestoreDocument(uri);
    } catch (error) {
      Logger.error(LOG_SCOPE, "restore document picker failed", error);
      setRestoreStage("idle");
      setRestoreMessage(
        "Couldn't open the file picker. You can also open Files, pick your JSON backup, tap Share, then choose Orbit.",
      );
    }
  }, [restoreStage, loadRestoreDocument]);

  useFocusEffect(
    useCallback(() => {
      // Backup is Settings-only after Phase 38. This surviving host drains the
      // shared-backup singleton; ordinary visits are safe because native
      // consumption returns `{ uri: null }` when no share is staged.
      if (!shouldConsumeSharedBackup(host)) return;
      let cancelled = false;
      void consumeSharedBackup()
        .then((shared) => {
          const { uri, failed } = shared;
          if (cancelled) return;
          if (failed) {
            setRestoreStage("idle");
            setRestoreMessage(backupIntakeFailureMessage(shared));
          } else if (uri) void loadRestoreDocument(uri);
        })
        .catch((error: unknown) => {
          Logger.error(
            LOG_SCOPE,
            "shared restore document could not be read",
            error,
          );
          if (!cancelled) {
            setRestoreStage("idle");
            setRestoreMessage(
              "Couldn't restore this backup. Your local data hasn't changed. Please try again.",
            );
          }
        });
      return () => {
        cancelled = true;
      };
    }, [host, loadRestoreDocument]),
  );

  const continueEncryptedRestore = useCallback(() => {
    if (!selectedEncryptedContents || !restorePassphrase) return;
    void validateRestore(selectedEncryptedContents, restorePassphrase);
  }, [restorePassphrase, selectedEncryptedContents, validateRestore]);

  const warningAction = backupWarningAction(health);
  const encryptionSummary = encryptionEnabled
    ? "On — new backups are protected with your passphrase"
    : "Off — backups are readable JSON";
  const heroDetail =
    health?.kind === "healthy"
      ? `Automatic backup: ${relativeTime(health.lastAutomaticBackupAt)}\n${keptBackupsLine(health.automaticFileCount, health.folderName)}`
      : (health?.kind === "stale" || health?.kind === "too-large") &&
          health.lastAutomaticBackupAt
        ? `Automatic backup: ${relativeTime(health.lastAutomaticBackupAt)}`
        : null;
  const healthColor =
    health?.kind === "healthy" ? colors.statusStable : colors.statusWobble;

  return (
    <ScrollView
      testID="backup-screen"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomClearance },
      ]}
    >
      {/* D-64: the page title is the hub row's own label (D-25). */}
      <ShellAppBar variant={backupAppBarVariant(host)} title="Data & Backup" />

      {health ? (
        <View
          testID={`backup-health-${health.kind}`}
          accessibilityLabel={`${health.headline}. ${"body" in health ? health.body : ""}`}
          style={[
            styles.hero,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.heroHeading}>
            <View
              style={[styles.statusDot, { backgroundColor: healthColor }]}
            />
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {health.headline}
            </Text>
          </View>
          {"body" in health ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {health.body}
            </Text>
          ) : null}
          {heroDetail ? (
            <Text style={[styles.detail, { color: colors.textSecondary }]}>
              {heroDetail}
            </Text>
          ) : null}
          {automaticSkippedLine ? (
            <Text
              testID="backup-automatic-skipped-photos"
              style={[styles.detail, { color: colors.textSecondary }]}
            >
              {automaticSkippedLine}
            </Text>
          ) : null}
          {warningAction ? (
            <Pressable
              testID="backup-warning-action"
              accessibilityRole="button"
              accessibilityLabel={backupWarningActionLabel(warningAction)}
              accessibilityState={{
                disabled: warningActionBusy,
                busy: warningActionBusy,
              }}
              disabled={warningActionBusy}
              onPress={() => void runWarningAction(warningAction)}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.accent,
                  opacity: warningActionBusy ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.onAccent }}>
                {backupWarningActionLabel(warningAction)}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="backup-manage"
            accessibilityRole="button"
            accessibilityLabel="Backup settings"
            onPress={() => openSettings("automatic")}
            style={styles.linkButton}
          >
            <Text style={{ color: colors.accentText }}>Backup settings</Text>
          </Pressable>
        </View>
      ) : (
        <View
          testID="backup-health-loading"
          accessibilityLabel="Loading backup status"
          style={[
            styles.placeholder,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        />
      )}

      <View style={styles.actions}>
        <Pressable
          testID="backup-export"
          accessibilityRole="button"
          accessibilityLabel="Export now"
          accessibilityState={{ disabled: exporting }}
          disabled={exporting}
          onPress={onExport}
          style={[
            styles.actionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: exporting ? 0.6 : 1,
            },
          ]}
        >
          <Icon name="backup-export" size="lg" tone="accentText" />
          <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
            Export now
          </Text>
          <Text style={[styles.actionHelper, { color: colors.textSecondary }]}>
            Save a copy to share
          </Text>
        </Pressable>
        <Pressable
          testID="backup-restore"
          accessibilityRole="button"
          accessibilityLabel="Restore a backup"
          accessibilityState={{ disabled: restoreStage === "loading" }}
          disabled={restoreStage === "loading"}
          onPress={() => void chooseRestore()}
          style={[
            styles.actionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: restoreStage === "loading" ? 0.6 : 1,
            },
          ]}
        >
          <Icon name="backup-restore" size="lg" tone="textSecondary" />
          <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
            Restore a backup
          </Text>
          <Text style={[styles.actionHelper, { color: colors.textSecondary }]}>
            Preview before changing anything
          </Text>
        </Pressable>
      </View>

      {restoreStage === "loading" ? (
        <View
          testID="restore-preview-loading"
          accessibilityLiveRegion="polite"
          accessibilityLabel="Checking backup before preview"
          style={[
            styles.restoreNotice,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
            Checking backup…
          </Text>
          <Text style={[styles.actionHelper, { color: colors.textSecondary }]}>
            Orbit will only show a preview after this backup is ready.
          </Text>
        </View>
      ) : null}
      {restoreStage === "passphrase" ? (
        <View
          testID="restore-passphrase-prompt"
          style={[
            styles.restoreNotice,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
            Enter backup passphrase
          </Text>
          <Text style={[styles.actionHelper, { color: colors.textSecondary }]}>
            This encrypted backup needs its passphrase before Orbit can preview
            it.
          </Text>
          <View
            style={[
              styles.passphraseField,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <TextInput
              testID="restore-passphrase-input"
              secureTextEntry={!passphraseVisible}
              autoCapitalize="none"
              autoCorrect={false}
              value={restorePassphrase}
              onChangeText={setRestorePassphrase}
              accessibilityLabel="Backup passphrase"
              placeholder="Passphrase"
              placeholderTextColor={colors.textPlaceholder}
              style={[styles.passphraseInput, { color: colors.textPrimary }]}
            />
            <Pressable
              testID="restore-passphrase-visibility"
              accessibilityRole="button"
              accessibilityLabel={
                passphraseVisible ? "Hide passphrase" : "Show passphrase"
              }
              onPress={() => setPassphraseVisible((visible) => !visible)}
              style={styles.passphraseToggle}
            >
              <Icon
                name={passphraseVisible ? "hide-secret" : "show-secret"}
                tone="textSecondary"
              />
            </Pressable>
          </View>
          <View style={styles.restorePromptActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose another backup"
              onPress={() => {
                setSelectedEncryptedContents(null);
                setRestorePassphrase("");
                setPassphraseVisible(false);
                setRestoreStage("idle");
                void chooseRestore();
              }}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textSecondary }}>
                Choose another backup
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                restoreMessage
                  ? "Try passphrase again"
                  : "Continue to preview backup"
              }
              accessibilityState={{ disabled: !restorePassphrase }}
              disabled={!restorePassphrase}
              onPress={continueEncryptedRestore}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.accent,
                  opacity: restorePassphrase ? 1 : 0.6,
                },
              ]}
            >
              <Text style={{ color: colors.onAccent }}>
                {restoreMessage
                  ? "Try passphrase again"
                  : "Continue to preview backup"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {restoreMessage ? (
        <View
          testID="restore-selection-error"
          accessibilityLiveRegion="polite"
          style={[
            styles.restoreNotice,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.actionHelper, { color: colors.textSecondary }]}>
            {restoreMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose another file"
            onPress={() => void chooseRestore()}
            style={styles.linkButton}
          >
            <Text style={{ color: colors.accentText }}>
              Choose another file
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* D-119: the encryption row is the shared Settings row in its card. */}
      <SettingsSectionCard>
        <SettingsRow
          testID="backup-encryption"
          title="Encryption"
          subtitle={encryptionSummary}
          accessibilityLabel={`Encryption. ${encryptionSummary}`}
          onPress={() => openSettings("encryption")}
        />
      </SettingsSectionCard>

      {showNudge ? (
        <View
          testID="backup-protect-nudge"
          style={[
            styles.nudge,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.nudgeCopy}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
              Protect your Orbit data
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set up automatic backups"
              onPress={() => openSettings("automatic")}
              style={styles.linkButton}
            >
              <Text style={{ color: colors.accentText }}>
                Set up automatic backups
              </Text>
            </Pressable>
          </View>
          <Pressable
            testID="backup-dismiss-nudge"
            accessibilityRole="button"
            accessibilityLabel="Dismiss backup reminder"
            onPress={() => void dismissNudge()}
            style={styles.dismiss}
          >
            <Icon name="close" tone="textSecondary" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.privacy}>
        <Icon name="backup-privacy" size="sm" tone="textSecondary" />
        <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
          Backups include your contacts, notes, photos, and settings. API keys
          are never included.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  header: { gap: 16, paddingTop: 8 },
  back: {
    minHeight: 44,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  title: { fontSize: 24, fontWeight: "700" },
  hero: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  placeholder: { height: 214, borderWidth: 1, borderRadius: 14 },
  heroHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  heroTitle: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 21 },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  linkButton: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  actions: { flexDirection: "row", gap: 8 },
  actionCard: {
    flex: 1,
    minHeight: 148,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  actionTitle: { fontSize: 16, fontWeight: "700" },
  actionHelper: { fontSize: 13, lineHeight: 18 },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  nudge: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    gap: 8,
  },
  nudgeCopy: { flex: 1, gap: 4 },
  dismiss: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  privacy: { flexDirection: "row", gap: 8, paddingBottom: 24 },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 18 },
  restoreNotice: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 8 },
  passphraseField: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  passphraseInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  passphraseToggle: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  restorePromptActions: { gap: 8 },
  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
});
