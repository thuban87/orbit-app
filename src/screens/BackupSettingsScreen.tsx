// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, SettingsRow, SettingsSectionCard } from "@/components/ui";
import {
  type AppSettings,
  getAppSettings,
  recordAutomaticBackupHealthCore,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { inWriteTransaction } from "@/db/transaction";
import {
  loadedData,
  type ReadPhase,
  readLoading,
  runGatedRead,
} from "@/logic/read-phase";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { chooseAutomaticBackupFolder } from "@/services/backup/backup-now";
import {
  createAutomaticBackupReencryptionService,
  createBackupEncryptionLifecycle,
} from "@/services/backup/backup-service";
import {
  APPROVED_BACKUP_ENCRYPTION_PROFILE,
  createBackupEnvelopeCrypto,
} from "@/services/backup/encryption";
import { backupPassphraseStore } from "@/services/backup/passphrase-store";
import { createSafStorage } from "@/services/backup/saf-storage";
import { confirm, notice } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import { readBackupFolderDisplayName } from "../../modules/orbit-backup-document-picker";
import {
  type BackupDayController,
  type BackupSettingsSection,
  backupFolderDisplayName,
  backupSettingsPresentation,
  backupSettingsScrollOffset,
  commitThenRefresh,
  createBackupDayController,
  encryptionErrorCopy,
  resolveBackupFolderName,
  subscribeBackgroundLeaveFlush,
  validateEncryptionSetup,
} from "./backup-settings-logic";

const LOG_SCOPE = "backup-settings";

/**
 * The backup schedule's save-on-leave controller (38.9 D-34). ONE instance for
 * the app process (review C4-L1), created lazily so the factory stays pure: a
 * remounted screen attaches to the same per-field state, so its newer edits
 * supersede an older mount's pending drain, and writes started by a leave
 * settle after unmount. The snackbar store is global, so a failure after
 * unmount still shows (D-27).
 */
let sharedDayController: BackupDayController | null = null;
function backupDayController(): BackupDayController {
  sharedDayController ??= createBackupDayController({
    write: (patch) => updateAppSettings(getExecutor(), patch, localDateTime()),
    onWriteFailed: (error) => {
      Logger.error(LOG_SCOPE, "failed to save backup cadence", error);
      showSnackbar({ kind: "error", label: "Couldn't save backup settings" });
    },
  });
  return sharedDayController;
}

type EncryptionFlow = "setup" | "change" | "forgotten";
type ChangeMode = "reencrypt" | "future-only";

export function BackupSettingsScreen({
  navigation,
  route,
}: RootStackScreenProps<"BackupSettings">) {
  const { colors } = useTheme();
  // D-64: the section this page was opened for (Backup's hero and warning
  // links open "automatic", its Encryption row "encryption"). Scrolled to
  // once per request, after the groups have laid out.
  const requestedSection = route.params?.section;
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Partial<Record<BackupSettingsSection, number>>>(
    {},
  );
  const scrolledFor = useRef<BackupSettingsSection | null>(null);
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  // RG-035 / D-24: settings are UNKNOWN until a read succeeds. Nothing below
  // may present a known encryption, folder or passphrase-setup state from an
  // unread or unreadable row — `backupSettingsPresentation` gates the groups.
  const [settingsPhase, setSettingsPhase] =
    useState<ReadPhase<AppSettings>>(readLoading);
  const settings = loadedData(settingsPhase);
  // D-34: the day fields' text and errors come from the shared controller;
  // this screen only forwards events to it and renders what it reports.
  const dayController = backupDayController();
  const [days, setDays] = useState(() => dayController.getSnapshot());
  const intervalDays = days.interval.text;
  const retentionDays = days.retention.text;
  const intervalError = days.interval.error;
  const retentionError = days.retention.error;
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [encryptionFlow, setEncryptionFlow] = useState<EncryptionFlow>("setup");
  const [changeMode, setChangeMode] = useState<ChangeMode>("reencrypt");
  const [openingFolder, setOpeningFolder] = useState(false);
  const [savingEncryption, setSavingEncryption] = useState(false);
  const safStorage = useMemo(() => createSafStorage(), []);
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);

  /**
   * The one settings read (38.3 RG-035). Awaitable and NEVER rejects: only the
   * latest request may publish, the first read shows loading, a re-read keeps
   * the loaded view until it settles, and any failure — including a re-read
   * after a committed write — lands in the read-error state rather than a
   * stale known view or the write's own failure path (D-04, D-24). Form
   * fields are seeded only from a successful current read, and the day fields
   * only where the controller allows it (D-34: a refresh never overwrites
   * newer or still-saving typing, nor reverts a commit made after it began).
   */
  const readSettings = useCallback(async (): Promise<void> => {
    const readStartedSeq = dayController.beginRead();
    await runGatedRead({
      gate: readAuthority,
      read: () => getAppSettings(getExecutor()),
      publish: setSettingsPhase,
      onLoaded: (next) => dayController.loaded(readStartedSeq, next),
      onError: (error) =>
        Logger.error(LOG_SCOPE, "failed to load backup settings", error),
    });
  }, [dayController, readAuthority]);

  // Attach before the focus effect below runs, so the attach-time reset of
  // idle fields precedes this mount's first read (review C5-M3). Unmount is
  // the last leave-flush backstop; the controller finishes any write itself.
  useEffect(() => {
    const detach = dayController.attach(() =>
      setDays(dayController.getSnapshot()),
    );
    setDays(dayController.getSnapshot());
    return () => {
      dayController.leave();
      detach();
    };
  }, [dayController]);

  // D-34 leave-flush backstop: the app going to the background (Home with a
  // day field still focused) saves what is typed, through the same leave path
  // (same validation, same error snackbar), in case Android then kills the app
  // (38.9-03 out-of-scope finding #1, folded into 38.9-06).
  useEffect(
    () => subscribeBackgroundLeaveFlush(AppState, dayController),
    [dayController],
  );

  // D-34 leave-flush backstop: removal by header or system Back. Saving on
  // leave is not a prompt, so this never calls preventDefault (on Android a
  // focused TextInput is not reliably blurred before the screen goes; H3).
  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => {
        dayController.leave();
      }),
    [dayController, navigation],
  );

  useFocusEffect(
    useCallback(() => {
      // Regaining focus (e.g. a tab switch back; the Settings stack stays
      // mounted) resets idle day fields before this read (review C7-L1).
      dayController.focus();
      void readSettings();
      return () => {
        // Losing focus is leaving the fields (D-34): save what is typed.
        dayController.leave();
        readAuthority.invalidate();
      };
    }, [dayController, readAuthority, readSettings]),
  );

  const encryptionLifecycle = useMemo(
    () =>
      createBackupEncryptionLifecycle(backupPassphraseStore, {
        getEncryptionEnabled: async () =>
          (await getAppSettings(getExecutor())).encryptionEnabled === 1,
        setEncryptionEnabled: async (enabled) =>
          inWriteTransaction(getExecutor(), () =>
            recordAutomaticBackupHealthCore(getExecutor(), {
              encryptionEnabled: enabled ? 1 : 0,
            }),
          ),
      }),
    [],
  );

  const clearEncryptionFields = useCallback(() => {
    setCurrentPassphrase("");
    setPassphrase("");
    setConfirmation("");
    setEncryptionError(null);
  }, []);

  const chooseFolder = useCallback(async () => {
    await commitThenRefresh({
      // The one folder chooser, shared with the Backup page's "Choose a
      // folder" (38.12 D-115).
      commit: () =>
        chooseAutomaticBackupFolder({
          exec: getExecutor(),
          folders: safStorage,
          // D-143: the provider's own folder name, else the URI derivation.
          folderName: (uri) =>
            resolveBackupFolderName(uri, readBackupFolderDisplayName),
        }),
      refresh: readSettings,
      onCommitFailed: (error) => {
        Logger.error(LOG_SCOPE, "folder selection failed", error);
        showSnackbar({
          kind: "error",
          label: "Couldn't choose folder. Please try again.",
        });
      },
    });
  }, [readSettings, safStorage]);

  const openFolder = useCallback(async () => {
    if (
      !settings?.backupFolderUri ||
      settings.backupFolderAccessible !== 1 ||
      openingFolder
    )
      return;
    setOpeningFolder(true);
    try {
      if (!(await safStorage.canOpen(settings.backupFolderUri))) {
        void notice({
          title: "Open backup folder",
          message: "This folder can be opened from the Files app.",
        });
        return;
      }
      await safStorage.open(settings.backupFolderUri);
    } catch (error) {
      Logger.warn(LOG_SCOPE, "native folder launch rejected", error);
      void notice({
        title: "Open backup folder",
        message: "This folder can be opened from the Files app.",
      });
    } finally {
      setOpeningFolder(false);
    }
  }, [
    openingFolder,
    safStorage,
    settings?.backupFolderAccessible,
    settings?.backupFolderUri,
  ]);

  const validateNewPassphrase = useCallback(() => {
    const validation = validateEncryptionSetup(passphrase, confirmation);
    if (!validation.ok) {
      setEncryptionError(validation.error);
      return false;
    }
    return true;
  }, [confirmation, passphrase]);

  const enableEncryption = useCallback(async () => {
    if (!validateNewPassphrase()) return;
    setSavingEncryption(true);
    try {
      const result = await encryptionLifecycle.enable(passphrase);
      if (result.status !== "enabled") {
        setEncryptionError("Couldn't turn on encryption. Please try again.");
        return;
      }
      clearEncryptionFields();
      await readSettings();
    } finally {
      setSavingEncryption(false);
    }
  }, [
    clearEncryptionFields,
    encryptionLifecycle,
    passphrase,
    readSettings,
    validateNewPassphrase,
  ]);

  const saveFuturePassphrase = useCallback(async () => {
    if (!validateNewPassphrase()) return;
    const active = await backupPassphraseStore.getPassphrase();
    if (
      encryptionFlow === "change" &&
      (active.status !== "present" || active.passphrase !== currentPassphrase)
    ) {
      setEncryptionError(
        "That passphrase doesn't match your current backup protection.",
      );
      return;
    }
    setSavingEncryption(true);
    try {
      await commitThenRefresh({
        commit: async () => {
          await backupPassphraseStore.setPassphrase(passphrase);
          clearEncryptionFields();
          setEncryptionFlow("setup");
          return true;
        },
        refresh: readSettings,
        onCommitFailed: (error) => {
          Logger.error(
            LOG_SCOPE,
            "failed to set future backup passphrase",
            error,
          );
          setEncryptionError(
            "Couldn't save the new passphrase. Please try again.",
          );
        },
      });
    } finally {
      setSavingEncryption(false);
    }
  }, [
    clearEncryptionFields,
    currentPassphrase,
    encryptionFlow,
    passphrase,
    readSettings,
    validateNewPassphrase,
  ]);

  const changeEncryption = useCallback(async () => {
    if (!validateNewPassphrase()) return;
    if (!currentPassphrase) {
      setEncryptionError(
        "That passphrase doesn't match your current backup protection.",
      );
      return;
    }
    if (changeMode === "future-only" || !settings?.backupFolderUri) {
      await saveFuturePassphrase();
      return;
    }
    setSavingEncryption(true);
    try {
      const result = await createAutomaticBackupReencryptionService({
        directoryUri: settings.backupFolderUri,
        now: new Date(),
        crypto: createBackupEnvelopeCrypto({
          profiles: [APPROVED_BACKUP_ENCRYPTION_PROFILE],
        }),
        profile: APPROVED_BACKUP_ENCRYPTION_PROFILE,
        passphrases: backupPassphraseStore,
        storage: createSafStorage(),
      }).change({ currentPassphrase, nextPassphrase: passphrase });
      if (result.status !== "changed") {
        setEncryptionError(encryptionErrorCopy(result.status));
        return;
      }
      clearEncryptionFields();
      setEncryptionFlow("setup");
      await readSettings();
    } finally {
      setSavingEncryption(false);
    }
  }, [
    changeMode,
    clearEncryptionFields,
    currentPassphrase,
    passphrase,
    readSettings,
    saveFuturePassphrase,
    settings?.backupFolderUri,
    validateNewPassphrase,
  ]);

  const disableEncryption = useCallback(async () => {
    // D-06 / ADR-086: destructive, so Back and the scrim cannot dismiss it.
    const confirmed = await confirm({
      title: "Turn off encryption?",
      message:
        "New backups will be readable JSON. Existing encrypted files will keep their passphrase.",
      cancelLabel: "Keep encryption on",
      confirmLabel: "Turn off encryption",
      destructive: true,
    });
    if (!confirmed) return;
    const result = await encryptionLifecycle.disable(true);
    if (result.status !== "disabled") {
      showSnackbar({
        kind: "error",
        label: "Couldn't turn off encryption. Please try again.",
      });
      return;
    }
    clearEncryptionFields();
    await readSettings();
  }, [clearEncryptionFields, encryptionLifecycle, readSettings]);

  const startChange = useCallback(() => {
    clearEncryptionFields();
    setEncryptionFlow("change");
    setChangeMode("reencrypt");
  }, [clearEncryptionFields]);

  const startForgotten = useCallback(async () => {
    const confirmed = await confirm({
      title: "I forgot my passphrase",
      message:
        "Old encrypted backups can't be opened or re-encrypted without their passphrase.",
      confirmLabel: "Set a new passphrase for future backups",
    });
    if (!confirmed) return;
    clearEncryptionFields();
    setEncryptionFlow("forgotten");
  }, [clearEncryptionFields]);

  // Every known-state flag derives from the gated presentation: unknown
  // settings render neither groups nor a summary (RG-035, D-24).
  const presentation = backupSettingsPresentation(settingsPhase);
  const encryptionEnabled = presentation.encryptionSummary === "on";
  const { folderConfigured, folderAccessible } = presentation;
  const setupFlow = !encryptionEnabled || encryptionFlow === "forgotten";
  // D-143: the provider's own name for the folder (Drive included), looked up
  // for the current URI; until it answers, D-62's URI derivation. Nothing
  // stored is repaired.
  const folderUri = settings?.backupFolderUri ?? null;
  const [providerFolderName, setProviderFolderName] = useState<{
    readonly uri: string;
    readonly name: string;
  } | null>(null);
  useEffect(() => {
    if (!folderUri) return;
    let cancelled = false;
    void resolveBackupFolderName(folderUri, readBackupFolderDisplayName).then(
      (name) => {
        if (!cancelled) setProviderFolderName({ uri: folderUri, name });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [folderUri]);
  const folderName = folderConfigured
    ? providerFolderName?.uri === folderUri && providerFolderName
      ? providerFolderName.name
      : backupFolderDisplayName(folderUri)
    : null;

  // Scroll to the requested section once its offset is known; a new request
  // (the page re-opened for another section) scrolls again.
  const scrollToRequestedSection = useCallback(() => {
    if (scrolledFor.current === requestedSection) return;
    const offset = backupSettingsScrollOffset(
      requestedSection,
      sectionOffsets.current,
    );
    if (offset === null) return;
    scrolledFor.current = requestedSection ?? null;
    scrollRef.current?.scrollTo({ y: offset, animated: false });
  }, [requestedSection]);

  useEffect(() => {
    scrollToRequestedSection();
  }, [scrollToRequestedSection]);

  const onSectionLayout = useCallback(
    (section: BackupSettingsSection, y: number) => {
      sectionOffsets.current[section] = y;
      scrollToRequestedSection();
    },
    [scrollToRequestedSection],
  );

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Backup settings" />
      <ScrollView
        ref={scrollRef}
        testID="backup-settings-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        {settingsPhase.phase === "loading" ? (
          <View
            testID="backup-settings-loading"
            accessibilityLabel="Loading backup settings"
            style={styles.readState}
          >
            <ActivityIndicator color={colors.accentText} />
          </View>
        ) : null}
        {settingsPhase.phase === "error" ? (
          <View
            testID="backup-settings-read-error"
            style={[
              styles.group,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
              {"Couldn't read backup settings"}
            </Text>
            <Text style={[styles.help, { color: colors.textSecondary }]}>
              Orbit can&apos;t show your backup folder or encryption status
              right now.
            </Text>
            <Pressable
              testID="backup-settings-retry"
              accessibilityRole="button"
              accessibilityLabel="Retry reading backup settings"
              onPress={() => void readSettings()}
              style={[styles.outlineButton, { borderColor: colors.accent }]}
            >
              <Text style={{ color: colors.accentText }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {presentation.showGroups ? (
          <>
            {/* D-119: the folder and the schedule are shared Settings rows. */}
            <View
              testID="backup-settings-section-automatic"
              onLayout={(event) =>
                onSectionLayout("automatic", event.nativeEvent.layout.y)
              }
            >
              <SettingsSectionCard title="Automatic backups">
                <View style={styles.cardText}>
                  <Text style={[styles.help, { color: colors.textSecondary }]}>
                    Orbit writes a new backup after you open the app when your
                    schedule is due and your data has changed.
                  </Text>
                  {folderConfigured && !folderAccessible ? (
                    <Text
                      testID="backup-settings-lost-folder"
                      style={[styles.error, { color: colors.statusWobble }]}
                    >
                      Backup folder needs reconnecting. Pick it again to resume
                      automatic backups.
                    </Text>
                  ) : null}
                </View>
                <SettingsRow
                  testID="backup-settings-choose-folder"
                  title={
                    folderConfigured ? "Backup folder" : "Choose backup folder"
                  }
                  subtitle={
                    folderName ??
                    "Choose a folder to start protecting your data."
                  }
                  accessibilityLabel={
                    folderConfigured
                      ? `Change backup folder. ${folderName}`
                      : "Choose backup folder"
                  }
                  onPress={() => void chooseFolder()}
                />
                {folderConfigured ? (
                  <SettingsRow
                    testID="backup-settings-open-folder"
                    title="Open backup folder"
                    accessibilityLabel={`Open backup folder: ${folderName}`}
                    disabled={openingFolder || !folderAccessible}
                    onPress={() => void openFolder()}
                  />
                ) : null}
                {folderConfigured ? (
                  <SettingsRow title="Back up every (days)">
                    <TextInput
                      testID="backup-settings-interval"
                      accessibilityLabel="Days between backups"
                      value={intervalDays}
                      onChangeText={(value) =>
                        dayController.changeText("interval", value)
                      }
                      onBlur={() => dayController.commitField("interval")}
                      onSubmitEditing={() =>
                        dayController.commitField("interval")
                      }
                      keyboardType="number-pad"
                      style={[
                        styles.input,
                        {
                          color: colors.textPrimary,
                          borderColor: intervalError
                            ? colors.danger
                            : colors.border,
                        },
                      ]}
                    />
                    {intervalError ? (
                      <Text style={[styles.error, { color: colors.danger }]}>
                        {intervalError}
                      </Text>
                    ) : null}
                  </SettingsRow>
                ) : null}
                {folderConfigured ? (
                  <SettingsRow title="Keep backups for (days)">
                    <TextInput
                      testID="backup-settings-retention"
                      accessibilityLabel="Backup retention in days"
                      value={retentionDays}
                      onChangeText={(value) =>
                        dayController.changeText("retention", value)
                      }
                      onBlur={() => dayController.commitField("retention")}
                      onSubmitEditing={() =>
                        dayController.commitField("retention")
                      }
                      keyboardType="number-pad"
                      style={[
                        styles.input,
                        {
                          color: colors.textPrimary,
                          borderColor: retentionError
                            ? colors.danger
                            : colors.border,
                        },
                      ]}
                    />
                    {retentionError ? (
                      <Text style={[styles.error, { color: colors.danger }]}>
                        {retentionError}
                      </Text>
                    ) : null}
                  </SettingsRow>
                ) : null}
              </SettingsSectionCard>
            </View>
            {/* D-119: Encryption in the shared section card; its forms keep
                their own layout inside it. */}
            <View
              testID="backup-settings-section-encryption"
              onLayout={(event) =>
                onSectionLayout("encryption", event.nativeEvent.layout.y)
              }
            >
              <SettingsSectionCard title="Encryption">
                <View style={styles.cardBody}>
                  <Text style={[styles.help, { color: colors.textSecondary }]}>
                    {encryptionEnabled
                      ? "On — new backups are protected with your passphrase"
                      : "Off — backups are readable JSON"}
                  </Text>
                  {setupFlow ? (
                    <>
                      <Text
                        style={[styles.help, { color: colors.textSecondary }]}
                      >
                        If you forget this passphrase, Orbit can't recover
                        encrypted backups.
                      </Text>
                      <Text
                        style={[styles.help, { color: colors.textSecondary }]}
                      >
                        Use a long, unique passphrase you can keep safely.
                      </Text>
                      <AppText role="label" importantForAccessibility="no">
                        Passphrase
                      </AppText>
                      <TextInput
                        testID="backup-settings-passphrase"
                        accessibilityLabel="Passphrase"
                        secureTextEntry
                        value={passphrase}
                        onChangeText={(value) => {
                          setPassphrase(value);
                          setEncryptionError(null);
                        }}
                        style={[
                          styles.input,
                          {
                            color: colors.textPrimary,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <AppText role="label" importantForAccessibility="no">
                        Confirm passphrase
                      </AppText>
                      <TextInput
                        testID="backup-settings-confirm-passphrase"
                        accessibilityLabel="Confirm passphrase"
                        secureTextEntry
                        value={confirmation}
                        onChangeText={(value) => {
                          setConfirmation(value);
                          setEncryptionError(null);
                        }}
                        style={[
                          styles.input,
                          {
                            color: colors.textPrimary,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      {encryptionError ? (
                        <Text style={[styles.error, { color: colors.danger }]}>
                          {encryptionError}
                        </Text>
                      ) : null}
                      <Pressable
                        testID="backup-settings-enable-encryption"
                        accessibilityRole="button"
                        accessibilityLabel={
                          encryptionFlow === "forgotten"
                            ? "Set a new passphrase for future backups"
                            : "Turn on encryption"
                        }
                        accessibilityState={{ disabled: savingEncryption }}
                        disabled={savingEncryption}
                        onPress={() =>
                          void (encryptionFlow === "forgotten"
                            ? saveFuturePassphrase()
                            : enableEncryption())
                        }
                        style={[
                          styles.primaryButton,
                          {
                            backgroundColor: colors.accent,
                            opacity: savingEncryption ? 0.6 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.onAccent }}>
                          {encryptionFlow === "forgotten"
                            ? "Set a new passphrase for future backups"
                            : "Turn on encryption"}
                        </Text>
                      </Pressable>
                    </>
                  ) : encryptionFlow === "change" ? (
                    <>
                      <AppText role="label" importantForAccessibility="no">
                        Current passphrase
                      </AppText>
                      <TextInput
                        testID="backup-settings-current-passphrase"
                        accessibilityLabel="Current passphrase"
                        secureTextEntry
                        value={currentPassphrase}
                        onChangeText={(value) => {
                          setCurrentPassphrase(value);
                          setEncryptionError(null);
                        }}
                        style={[
                          styles.input,
                          {
                            color: colors.textPrimary,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <AppText role="label" importantForAccessibility="no">
                        New passphrase
                      </AppText>
                      <TextInput
                        testID="backup-settings-new-passphrase"
                        accessibilityLabel="New passphrase"
                        secureTextEntry
                        value={passphrase}
                        onChangeText={(value) => {
                          setPassphrase(value);
                          setEncryptionError(null);
                        }}
                        style={[
                          styles.input,
                          {
                            color: colors.textPrimary,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <AppText role="label" importantForAccessibility="no">
                        Confirm new passphrase
                      </AppText>
                      <TextInput
                        testID="backup-settings-confirm-new-passphrase"
                        accessibilityLabel="Confirm new passphrase"
                        secureTextEntry
                        value={confirmation}
                        onChangeText={(value) => {
                          setConfirmation(value);
                          setEncryptionError(null);
                        }}
                        style={[
                          styles.input,
                          {
                            color: colors.textPrimary,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <Pressable
                        testID="backup-settings-reencrypt-choice"
                        accessibilityRole="radio"
                        accessibilityState={{
                          selected: changeMode === "reencrypt",
                        }}
                        accessibilityLabel="Re-encrypt accessible automatic backups"
                        onPress={() => setChangeMode("reencrypt")}
                        style={[
                          styles.choice,
                          {
                            borderColor:
                              changeMode === "reencrypt"
                                ? colors.borderStrong
                                : colors.border,
                            backgroundColor:
                              changeMode === "reencrypt"
                                ? colors.surfaceElevated
                                : colors.surface,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.textPrimary }}>
                          Re-encrypt accessible automatic backups
                        </Text>
                        <Text
                          style={[styles.help, { color: colors.textSecondary }]}
                        >
                          Manually shared files retain their old passphrase.
                        </Text>
                      </Pressable>
                      <Pressable
                        testID="backup-settings-future-choice"
                        accessibilityRole="radio"
                        accessibilityState={{
                          selected: changeMode === "future-only",
                        }}
                        accessibilityLabel="Use the new passphrase for future backups only"
                        onPress={() => setChangeMode("future-only")}
                        style={[
                          styles.choice,
                          {
                            borderColor:
                              changeMode === "future-only"
                                ? colors.borderStrong
                                : colors.border,
                            backgroundColor:
                              changeMode === "future-only"
                                ? colors.surfaceElevated
                                : colors.surface,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.textPrimary }}>
                          Use the new passphrase for future backups only
                        </Text>
                      </Pressable>
                      {encryptionError ? (
                        <Text style={[styles.error, { color: colors.danger }]}>
                          {encryptionError}
                        </Text>
                      ) : null}
                      <Pressable
                        testID="backup-settings-save-change"
                        accessibilityRole="button"
                        accessibilityLabel="Save encryption change"
                        accessibilityState={{ disabled: savingEncryption }}
                        disabled={savingEncryption}
                        onPress={() => void changeEncryption()}
                        style={[
                          styles.primaryButton,
                          {
                            backgroundColor: colors.accent,
                            opacity: savingEncryption ? 0.6 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.onAccent }}>
                          Save encryption change
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        testID="backup-settings-change-encryption"
                        accessibilityRole="button"
                        accessibilityLabel="Change encryption"
                        onPress={startChange}
                        style={styles.linkButton}
                      >
                        <Text style={{ color: colors.accentText }}>
                          Change encryption
                        </Text>
                      </Pressable>
                      <Pressable
                        testID="backup-settings-forgot-passphrase"
                        accessibilityRole="button"
                        accessibilityLabel="I forgot my passphrase"
                        onPress={startForgotten}
                        style={styles.linkButton}
                      >
                        <Text style={{ color: colors.accentText }}>
                          I forgot my passphrase
                        </Text>
                      </Pressable>
                      <Pressable
                        testID="backup-settings-disable-encryption"
                        accessibilityRole="button"
                        accessibilityLabel="Turn off encryption"
                        onPress={disableEncryption}
                        style={[
                          styles.outlineButton,
                          { borderColor: colors.danger },
                        ]}
                      >
                        <Text style={{ color: colors.danger }}>
                          Turn off encryption
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </SettingsSectionCard>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 24 },
  group: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 12 },
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  cardText: { padding: 16, gap: 12 },
  cardBody: { padding: 16, gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: "600", lineHeight: 24 },
  help: { fontSize: 14, lineHeight: 21 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  error: { fontSize: 14, lineHeight: 21 },
  outlineButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  linkButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  choice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
});
