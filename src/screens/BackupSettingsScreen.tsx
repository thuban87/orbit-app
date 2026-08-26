import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  type AppSettings,
  getAppSettings,
  recordAutomaticBackupHealthCore,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { inWriteTransaction } from "@/db/transaction";
import type { RootStackScreenProps } from "@/navigation/types";
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
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  buildBackupSettingsPatch,
  validateEncryptionSetup,
} from "./backup-settings-logic";

const LOG_SCOPE = "backup-settings";
type EncryptionFlow = "setup" | "change" | "forgotten";
type ChangeMode = "reencrypt" | "future-only";

function encryptionErrorCopy(status: string): string {
  if (status === "wrong-current-passphrase")
    return "That passphrase doesn't match your current backup protection.";
  return "Orbit couldn't safely re-encrypt every accessible automatic backup. Reconnect the folder and try again.";
}

export function BackupSettingsScreen({
  navigation,
}: RootStackScreenProps<"BackupSettings">) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [intervalDays, setIntervalDays] = useState("");
  const [retentionDays, setRetentionDays] = useState("");
  const [intervalError, setIntervalError] = useState<string | null>(null);
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [encryptionFlow, setEncryptionFlow] = useState<EncryptionFlow>("setup");
  const [changeMode, setChangeMode] = useState<ChangeMode>("reencrypt");
  const [openingFolder, setOpeningFolder] = useState(false);
  const [savingEncryption, setSavingEncryption] = useState(false);
  const safStorage = useMemo(() => createSafStorage(), []);

  const reload = useCallback(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await getAppSettings(getExecutor());
        if (cancelled) return;
        setSettings(next);
        setIntervalDays(String(next.backupIntervalDays));
        setRetentionDays(String(next.backupRetentionDays));
        setIntervalError(null);
        setRetentionError(null);
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to load backup settings", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

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
    try {
      const result = await safStorage.requestDirectory(
        settings?.backupFolderUri ?? undefined,
      );
      if (!result.granted || !result.directoryUri) return;
      await inWriteTransaction(getExecutor(), () =>
        recordAutomaticBackupHealthCore(getExecutor(), {
          backupFolderUri: result.directoryUri,
          backupFolderName: "Selected backup folder",
          backupFolderAccessible: 1,
          backupFolderDiagnostic: null,
        }),
      );
      await reload();
    } catch (error) {
      Logger.error(LOG_SCOPE, "folder selection failed", error);
      Alert.alert("Couldn't choose folder", "Please try again.");
    }
  }, [reload, safStorage, settings?.backupFolderUri]);

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
        Alert.alert(
          "Open backup folder",
          "This folder can be opened from the Files app.",
        );
        return;
      }
      await safStorage.open(settings.backupFolderUri);
    } catch (error) {
      Logger.warn(LOG_SCOPE, "native folder launch rejected", error);
      Alert.alert(
        "Open backup folder",
        "This folder can be opened from the Files app.",
      );
    } finally {
      setOpeningFolder(false);
    }
  }, [
    openingFolder,
    safStorage,
    settings?.backupFolderAccessible,
    settings?.backupFolderUri,
  ]);

  const saveDays = useCallback(async () => {
    const result = buildBackupSettingsPatch({ intervalDays, retentionDays });
    if (result.patch === null) {
      setIntervalError(result.errors.intervalDays ?? null);
      setRetentionError(result.errors.retentionDays ?? null);
      return;
    }
    try {
      await updateAppSettings(getExecutor(), result.patch, localDateTime());
      await reload();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to save backup cadence", error);
      Alert.alert("Couldn't save backup settings", "Please try again.");
    }
  }, [intervalDays, reload, retentionDays]);

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
      await reload();
    } finally {
      setSavingEncryption(false);
    }
  }, [
    clearEncryptionFields,
    encryptionLifecycle,
    passphrase,
    reload,
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
      await backupPassphraseStore.setPassphrase(passphrase);
      clearEncryptionFields();
      setEncryptionFlow("setup");
      await reload();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to set future backup passphrase", error);
      setEncryptionError("Couldn't save the new passphrase. Please try again.");
    } finally {
      setSavingEncryption(false);
    }
  }, [
    clearEncryptionFields,
    currentPassphrase,
    encryptionFlow,
    passphrase,
    reload,
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
      await reload();
    } finally {
      setSavingEncryption(false);
    }
  }, [
    changeMode,
    clearEncryptionFields,
    currentPassphrase,
    passphrase,
    reload,
    saveFuturePassphrase,
    settings?.backupFolderUri,
    validateNewPassphrase,
  ]);

  const disableEncryption = useCallback(() => {
    Alert.alert(
      "Turn off encryption?",
      "New backups will be readable JSON. Existing encrypted files will keep their passphrase.",
      [
        { text: "Keep encryption on", style: "cancel" },
        {
          text: "Turn off encryption",
          style: "destructive",
          onPress: () =>
            void (async () => {
              const result = await encryptionLifecycle.disable(true);
              if (result.status !== "disabled") {
                Alert.alert(
                  "Couldn't turn off encryption",
                  "Please try again.",
                );
                return;
              }
              clearEncryptionFields();
              await reload();
            })(),
        },
      ],
    );
  }, [clearEncryptionFields, encryptionLifecycle, reload]);

  const startChange = useCallback(() => {
    clearEncryptionFields();
    setEncryptionFlow("change");
    setChangeMode("reencrypt");
  }, [clearEncryptionFields]);

  const startForgotten = useCallback(() => {
    Alert.alert(
      "I forgot my passphrase",
      "Old encrypted backups can't be opened or re-encrypted without their passphrase.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set a new passphrase for future backups",
          onPress: () => {
            clearEncryptionFields();
            setEncryptionFlow("forgotten");
          },
        },
      ],
    );
  }, [clearEncryptionFields]);

  const encryptionEnabled = settings?.encryptionEnabled === 1;
  const folderConfigured =
    settings?.backupFolderUri !== null &&
    settings?.backupFolderUri !== undefined;
  const folderAccessible = settings?.backupFolderAccessible === 1;
  const setupFlow = !encryptionEnabled || encryptionFlow === "forgotten";

  return (
    <ScrollView
      testID="backup-settings-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="backup-settings-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Backup settings
        </Text>
      </View>
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
          Automatic backups
        </Text>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          Orbit writes a new backup after you open the app when your schedule is
          due and your data has changed.
        </Text>
        {folderConfigured && !folderAccessible ? (
          <Text
            testID="backup-settings-lost-folder"
            style={[styles.error, { color: colors.statusWobble }]}
          >
            Backup folder needs reconnecting. Pick it again to resume automatic
            backups.
          </Text>
        ) : null}
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
          {folderConfigured ? "Backup folder" : "Choose backup folder"}
        </Text>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          {settings?.backupFolderName ??
            "Choose a folder to start protecting your data."}
        </Text>
        <Pressable
          testID="backup-settings-choose-folder"
          accessibilityRole="button"
          accessibilityLabel={
            folderConfigured ? "Change backup folder" : "Choose backup folder"
          }
          onPress={() => void chooseFolder()}
          style={[styles.outlineButton, { borderColor: colors.accent }]}
        >
          <Text style={{ color: colors.accent }}>
            {folderConfigured ? "Change folder" : "Choose backup folder"}
          </Text>
        </Pressable>
        {folderConfigured ? (
          <Pressable
            testID="backup-settings-open-folder"
            accessibilityRole="button"
            accessibilityLabel={`Open backup folder: ${settings?.backupFolderName ?? "selected folder"}`}
            accessibilityState={{
              disabled: openingFolder || !folderAccessible,
            }}
            disabled={openingFolder || !folderAccessible}
            onPress={() => void openFolder()}
            style={[
              styles.linkButton,
              { opacity: openingFolder || !folderAccessible ? 0.6 : 1 },
            ]}
          >
            <Text style={{ color: colors.accent }}>Open backup folder</Text>
          </Pressable>
        ) : null}
        {folderConfigured ? (
          <>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Back up every (days)
            </Text>
            <TextInput
              testID="backup-settings-interval"
              accessibilityLabel="Backup cadence in days"
              value={intervalDays}
              onChangeText={(value) => {
                setIntervalDays(value);
                setIntervalError(null);
              }}
              keyboardType="number-pad"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: intervalError ? colors.danger : colors.border,
                },
              ]}
            />
            {intervalError ? (
              <Text style={[styles.error, { color: colors.danger }]}>
                {intervalError}
              </Text>
            ) : null}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Keep backups for (days)
            </Text>
            <TextInput
              testID="backup-settings-retention"
              accessibilityLabel="Backup retention in days"
              value={retentionDays}
              onChangeText={(value) => {
                setRetentionDays(value);
                setRetentionError(null);
              }}
              keyboardType="number-pad"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: retentionError ? colors.danger : colors.border,
                },
              ]}
            />
            {retentionError ? (
              <Text style={[styles.error, { color: colors.danger }]}>
                {retentionError}
              </Text>
            ) : null}
            <Pressable
              testID="backup-settings-save-days"
              accessibilityRole="button"
              accessibilityLabel="Save backup schedule"
              onPress={() => void saveDays()}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            >
              <Text style={{ color: colors.background }}>Save schedule</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
          Encryption
        </Text>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          {encryptionEnabled
            ? "On — new backups are protected with your passphrase"
            : "Off — backups are readable JSON"}
        </Text>
        {setupFlow ? (
          <>
            <Text style={[styles.help, { color: colors.textSecondary }]}>
              If you forget this passphrase, Orbit can't recover encrypted
              backups.
            </Text>
            <Text style={[styles.help, { color: colors.textSecondary }]}>
              Use a long, unique passphrase you can keep safely.
            </Text>
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
                { color: colors.textPrimary, borderColor: colors.border },
              ]}
            />
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
                { color: colors.textPrimary, borderColor: colors.border },
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
              <Text style={{ color: colors.background }}>
                {encryptionFlow === "forgotten"
                  ? "Set a new passphrase for future backups"
                  : "Turn on encryption"}
              </Text>
            </Pressable>
          </>
        ) : encryptionFlow === "change" ? (
          <>
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
                { color: colors.textPrimary, borderColor: colors.border },
              ]}
            />
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
                { color: colors.textPrimary, borderColor: colors.border },
              ]}
            />
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
                { color: colors.textPrimary, borderColor: colors.border },
              ]}
            />
            <Pressable
              testID="backup-settings-reencrypt-choice"
              accessibilityRole="radio"
              accessibilityState={{ selected: changeMode === "reencrypt" }}
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
              <Text style={[styles.help, { color: colors.textSecondary }]}>
                Manually shared files retain their old passphrase.
              </Text>
            </Pressable>
            <Pressable
              testID="backup-settings-future-choice"
              accessibilityRole="radio"
              accessibilityState={{ selected: changeMode === "future-only" }}
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
              <Text style={{ color: colors.background }}>
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
              <Text style={{ color: colors.accent }}>Change encryption</Text>
            </Pressable>
            <Pressable
              testID="backup-settings-forgot-passphrase"
              accessibilityRole="button"
              accessibilityLabel="I forgot my passphrase"
              onPress={startForgotten}
              style={styles.linkButton}
            >
              <Text style={{ color: colors.accent }}>
                I forgot my passphrase
              </Text>
            </Pressable>
            <Pressable
              testID="backup-settings-disable-encryption"
              accessibilityRole="button"
              accessibilityLabel="Turn off encryption"
              onPress={disableEncryption}
              style={[styles.outlineButton, { borderColor: colors.danger }]}
            >
              <Text style={{ color: colors.danger }}>Turn off encryption</Text>
            </Pressable>
          </>
        )}
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
  title: { fontSize: 24, fontWeight: "600", lineHeight: 29 },
  group: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 12 },
  groupTitle: { fontSize: 20, fontWeight: "600", lineHeight: 24 },
  rowTitle: { fontSize: 16, fontWeight: "600", lineHeight: 24 },
  fieldLabel: { fontSize: 14, fontWeight: "400", lineHeight: 21 },
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
