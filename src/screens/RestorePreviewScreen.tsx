import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { applyRestore, type RestoreMode } from "@/backup/restore-apply";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  confirmReplaceAllRestore,
  createRestoreApplySingleFlight,
  type RestoreCacheEntry,
  replaceAllConfirmation,
  restoreApplyLabel,
  restoreApplyRecovery,
  restorePreviewCache,
  toRestoreResultParams,
} from "@/screens/backup-restore-logic";
import {
  createVerifiedPreRestoreSnapshot,
} from "@/services/backup/backup-service";
import {
  APPROVED_BACKUP_ENCRYPTION_PROFILE,
  createBackupEnvelopeCrypto,
} from "@/services/backup/encryption";
import { backupPassphraseStore } from "@/services/backup/passphrase-store";
import { createSafStorage } from "@/services/backup/saf-storage";
import { readStoredPhotoBase64 } from "@/services/backup/share-export";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "restore-preview";

function confirmReplace(destinationConfigured: boolean): Promise<boolean> {
  const confirmation = replaceAllConfirmation(destinationConfigured);
  return new Promise((resolve) => {
    Alert.alert(
      confirmation.title,
      confirmation.message,
      [
        { text: "Keep local data", style: "cancel", onPress: () => resolve(false) },
        { text: "Replace and restore", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
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
      encrypt: (contents, passphrase) => JSON.stringify(
        createBackupEnvelopeCrypto({ profiles: [APPROVED_BACKUP_ENCRYPTION_PROFILE] }).encrypt({
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
  const { colors } = useTheme();
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [expired, setExpired] = useState(
    () => restorePreviewCache.read(route.params.token) === null,
  );
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const executeRef = useRef<() => Promise<void>>(async () => {});
  const confirmedCandidateRef = useRef<RestoreCacheEntry | null>(null);
  const allowNavigationRef = useRef(false);
  const runSingleApply = useRef(createRestoreApplySingleFlight(() => executeRef.current())).current;

  useEffect(() => {
    setExpired(restorePreviewCache.read(route.params.token) === null);
  }, [route.params.token]);

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (applying && !allowNavigationRef.current) event.preventDefault();
  }), [applying, navigation]);

  const returnToSelection = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: "Backup" }] });
  }, [navigation]);

  executeRef.current = async () => {
    const cached = confirmedCandidateRef.current ?? restorePreviewCache.read(route.params.token);
    if (!cached) {
      setExpired(true);
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      const result = await applyRestore(getExecutor(), cached.manifest, mode, {
        createVerifiedPreRestoreSnapshot: createPreRestoreSnapshot,
      });
      if (result.status !== "applied") {
        setApplyError(restoreApplyRecovery(result.status).message);
        return;
      }
      // The success reset intentionally removes this route while `applying` is
      // still true; permit that internal navigation while retaining the guard
      // against user Back actions during the apply.
      allowNavigationRef.current = true;
      restorePreviewCache.discard(route.params.token);
      navigation.reset({
        index: 1,
        routes: [
          { name: "Backup" },
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
    if (applying || confirming) return;
    if (mode === "replace-all") {
      setConfirming(true);
      try {
        const confirmation = await confirmReplaceAllRestore(
          restorePreviewCache,
          route.params.token,
          async () => Boolean((await getAppSettings(getExecutor())).backupFolderUri),
          confirmReplace,
        );
        if (confirmation.status === "cancelled") return;
        if (confirmation.status === "expired") {
          setExpired(true);
          return;
        }
        confirmedCandidateRef.current = confirmation.candidate;
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to confirm pre-restore destination", error);
        setApplyError(restoreApplyRecovery("unexpected").message);
        return;
      } finally {
        setConfirming(false);
      }
    }
    await runSingleApply();
  }, [applying, confirming, mode, route.params.token, runSingleApply]);

  if (expired) {
    return (
      <ScrollView testID="restore-preview-expired" style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to backup and restore" onPress={returnToSelection} style={[styles.back, { borderColor: colors.border }]}><Text style={{ color: colors.textSecondary }}>Back</Text></Pressable>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Preview expired</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Choose the backup file again to preview it safely.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose file again" onPress={returnToSelection} style={[styles.primaryButton, { backgroundColor: colors.accent }]}><Text style={{ color: colors.textPrimary }}>Choose file again</Text></Pressable>
        </View>
      </ScrollView>
    );
  }

  const { preview } = route.params;
  return (
    <ScrollView testID="restore-preview-screen" style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: applying }} disabled={applying} onPress={() => navigation.goBack()} style={[styles.back, { borderColor: colors.border, opacity: applying ? 0.6 : 1 }]}><Text style={{ color: colors.textSecondary }}>Back</Text></Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Restore preview</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Backup details</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Source date: {preview.exportedAt}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Format version: {preview.backupFormatVersion}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Encryption: {preview.encrypted ? "Protected with a passphrase" : "Readable JSON"}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Contacts: {preview.contactCount} · Related rows: {preview.relatedRowCount} · Photos: {preview.photoCount} · Tombstones: {preview.tombstoneCount}</Text>
      </View>
      <Pressable testID="restore-mode-merge" accessibilityRole="radio" accessibilityLabel="Merge backup" accessibilityState={{ selected: mode === "merge", disabled: applying }} disabled={applying} onPress={() => setMode("merge")} style={[styles.card, { backgroundColor: mode === "merge" ? colors.surfaceElevated : colors.surface, borderColor: mode === "merge" ? colors.accent : colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Merge</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Add backup changes while keeping newer local data.</Text>
      </Pressable>
      <Pressable testID="restore-mode-replace" accessibilityRole="radio" accessibilityLabel="Replace all local data" accessibilityState={{ selected: mode === "replace-all", disabled: applying }} disabled={applying} onPress={() => setMode("replace-all")} style={[styles.card, { backgroundColor: colors.surface, borderColor: mode === "replace-all" ? colors.danger : colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.danger }]}>Replace all</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Replace local data with this backup. This is destructive.</Text>
      </Pressable>
      {applyError ? <View testID="restore-apply-error" accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.body, { color: colors.textSecondary }]}>{applyError}</Text></View> : null}
      {applying ? <View testID="restore-applying" accessibilityLiveRegion="polite" accessibilityLabel="Restoring backup" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Restoring backup…</Text><Text style={[styles.body, { color: colors.textSecondary }]}>This can take a moment. Orbit will only change local data after this backup is ready to apply.</Text></View> : null}
      <Pressable testID="restore-apply" accessibilityRole="button" accessibilityLabel={restoreApplyLabel(mode)} accessibilityState={{ disabled: applying || confirming }} disabled={applying || confirming} onPress={() => void beginApply()} style={[styles.primaryButton, { backgroundColor: mode === "replace-all" ? colors.danger : colors.accent, opacity: applying || confirming ? 0.6 : 1 }]}>
        <Text style={{ color: colors.textPrimary }}>{restoreApplyLabel(mode)}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  back: { minHeight: 44, alignSelf: "flex-start", borderWidth: 1, borderRadius: 10, justifyContent: "center", paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "600", lineHeight: 29 },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 8 },
  cardTitle: { fontSize: 20, fontWeight: "600", lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  primaryButton: { minHeight: 44, borderRadius: 8, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
});
