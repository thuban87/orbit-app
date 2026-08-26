import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getAppSettings,
  recordAutomaticBackupHealthCore,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { inWriteTransaction } from "@/db/transaction";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  createManualExportService,
  type ManualExportResult,
} from "@/services/backup/backup-service";
import { backupPassphraseStore } from "@/services/backup/passphrase-store";
import {
  APPROVED_BACKUP_ENCRYPTION_PROFILE,
  createBackupEnvelopeCrypto,
} from "@/services/backup/encryption";
import {
  createExpoShareAdapter,
  createLocalExportFiles,
  readStoredPhotoBase64,
} from "@/services/backup/share-export";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  type BackupHealth,
  resolveBackupHealth,
  resolveBackupNudge,
} from "./backup-health-logic";

const LOG_SCOPE = "backup-screen";

function relativeTime(value: string): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "recently";
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - milliseconds) / 60_000));
  if (elapsedMinutes < 2) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} minutes ago`;
  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

function exportFailureCopy(result: ManualExportResult): string | null {
  return result.status === "shared"
    ? null
    : "Nothing was shared. Please try again.";
}

export function BackupScreen({ navigation }: RootStackScreenProps<"Backup">) {
  const { colors } = useTheme();
  const [health, setHealth] = useState<BackupHealth | null>(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    void (async () => {
      try {
        const exec = getExecutor();
        const [settings, meaningful] = await Promise.all([
          getAppSettings(exec),
          exec.getFirstAsync<{ meaningful: number }>(
            `SELECT EXISTS(
              SELECT 1 FROM contacts
              UNION ALL SELECT 1 FROM interactions
              UNION ALL SELECT 1 FROM events
              UNION ALL SELECT 1 FROM fuel
              UNION ALL SELECT 1 FROM contact_links
              UNION ALL SELECT 1 FROM custom_field_defs
              UNION ALL SELECT 1 FROM custom_field_values
              UNION ALL SELECT 1 FROM profile WHERE name IS NOT NULL OR photo IS NOT NULL
            ) AS meaningful`,
          ),
        ]);
        const nudge = resolveBackupNudge({
          hasMeaningfulData: meaningful?.meaningful === 1,
          lastAutomaticBackupAt: settings.lastAutomaticBackupAt,
          currentDataRevision: settings.dataRevision,
          lastBackupDataRevision: settings.lastBackupDataRevision,
          dismissed: settings.backupNudgeDismissed === 1,
        }, new Date());
        if (nudge.shouldResetDismissal) {
          await inWriteTransaction(exec, () =>
            recordAutomaticBackupHealthCore(exec, { backupNudgeDismissed: 0 }),
          );
        }
        if (cancelled) return;
        setHealth(resolveBackupHealth({
          folderUri: settings.backupFolderUri,
          folderName: settings.backupFolderName,
          folderAccessible: settings.backupFolderAccessible === 1,
          lastAutomaticBackupAt: settings.lastAutomaticBackupAt,
          currentDataRevision: settings.dataRevision,
          lastBackupDataRevision: settings.lastBackupDataRevision,
          intervalDays: settings.backupIntervalDays,
        }, new Date()));
        setEncryptionEnabled(settings.encryptionEnabled === 1);
        setShowNudge(nudge.shouldShow);
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to load backup health", error);
        if (!cancelled) setHealth(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  const openSettings = useCallback(
    (section?: "automatic" | "encryption") => navigation.navigate("BackupSettings", { section }),
    [navigation],
  );

  const dismissNudge = useCallback(async () => {
    try {
      await inWriteTransaction(getExecutor(), () =>
        recordAutomaticBackupHealthCore(getExecutor(), { backupNudgeDismissed: 1 }),
      );
      setShowNudge(false);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to dismiss backup nudge", error);
    }
  }, []);

  const runExport = useCallback(async (readableOverride: boolean) => {
    if (exporting) return;
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
      const message = exportFailureCopy(result);
      if (message) Alert.alert("Couldn't create export", message);
    } catch (error) {
      Logger.error(LOG_SCOPE, "manual export failed", error);
      Alert.alert("Couldn't create export", "Nothing was shared. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const onExport = useCallback(() => {
    if (!encryptionEnabled) {
      void runExport(false);
      return;
    }
    Alert.alert(
      "Export readable JSON?",
      "Anyone with this file can read its contents. Use this only when you need a portable JSON backup.",
      [
        { text: "Keep encrypted export", onPress: () => void runExport(false) },
        { text: "Export readable JSON", onPress: () => void runExport(true) },
      ],
    );
  }, [encryptionEnabled, runExport]);

  const heroAction = health?.kind === "not-configured" ? "Set up backups" : health?.kind === "lost-folder" ? "Choose folder" : "Manage backups";
  const heroDetail = health?.kind === "healthy"
    ? `Automatic backup: ${relativeTime(health.lastAutomaticBackupAt)}\n${health.automaticFileCount} backup${health.automaticFileCount === 1 ? "" : "s"} kept in ${health.folderName}`
    : health?.kind === "stale" && health.lastAutomaticBackupAt
      ? `Automatic backup: ${relativeTime(health.lastAutomaticBackupAt)}`
      : null;
  const healthColor = health?.kind === "healthy" ? colors.statusStable : colors.statusWobble;

  return (
    <ScrollView testID="backup-screen" style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable testID="backup-back" accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} style={[styles.back, { borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Backup & Restore</Text>
      </View>

      {health ? (
        <View testID={`backup-health-${health.kind}`} accessibilityLabel={`${health.headline}. ${"body" in health ? health.body : ""}`} style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.heroHeading}><View style={[styles.statusDot, { backgroundColor: healthColor }]} /><Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{health.headline}</Text></View>
          {"body" in health ? <Text style={[styles.body, { color: colors.textSecondary }]}>{health.body}</Text> : null}
          {heroDetail ? <Text style={[styles.detail, { color: colors.textSecondary }]}>{heroDetail}</Text> : null}
          <Pressable testID="backup-manage" accessibilityRole="button" accessibilityLabel={heroAction} onPress={() => openSettings("automatic")} style={styles.linkButton}>
            <Text style={{ color: colors.accent }}>{heroAction}</Text>
          </Pressable>
        </View>
      ) : <View testID="backup-health-loading" accessibilityLabel="Loading backup status" style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]} />}

      <View style={styles.actions}>
        <Pressable testID="backup-export" accessibilityRole="button" accessibilityLabel="Export now" accessibilityState={{ disabled: exporting }} disabled={exporting} onPress={onExport} style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: exporting ? 0.6 : 1 }]}>
          <Text style={[styles.actionIcon, { color: colors.accent }]}>⇧</Text><Text style={[styles.actionTitle, { color: colors.textPrimary }]}>Export now</Text><Text style={[styles.actionHelper, { color: colors.textSecondary }]}>Save a copy to share</Text>
        </Pressable>
        <Pressable testID="backup-restore" accessibilityRole="button" accessibilityLabel="Restore a backup" onPress={() => navigation.navigate("RestorePreview", { fileUri: null })} style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.actionIcon, { color: colors.textSecondary }]}>↥</Text><Text style={[styles.actionTitle, { color: colors.textPrimary }]}>Restore a backup</Text><Text style={[styles.actionHelper, { color: colors.textSecondary }]}>Preview before changing anything</Text>
        </Pressable>
      </View>

      <Pressable testID="backup-encryption" accessibilityRole="button" accessibilityLabel={`Encryption. ${encryptionEnabled ? "On — new backups are protected with your passphrase" : "Off — backups are readable JSON"}`} onPress={() => openSettings("encryption")} style={[styles.encryptionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.lock, { color: colors.textSecondary }]}>⌑</Text><View style={styles.encryptionCopy}><Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Encryption</Text><Text style={[styles.actionHelper, { color: colors.textSecondary }]}>{encryptionEnabled ? "On — new backups are protected with your passphrase" : "Off — backups are readable JSON"}</Text></View><Text style={{ color: colors.textSecondary }}>›</Text>
      </Pressable>

      {showNudge ? <View testID="backup-protect-nudge" style={[styles.nudge, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.nudgeCopy}><Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Protect your Orbit data</Text><Pressable accessibilityRole="button" accessibilityLabel="Set up automatic backups" onPress={() => openSettings("automatic")} style={styles.linkButton}><Text style={{ color: colors.accent }}>Set up automatic backups</Text></Pressable></View><Pressable testID="backup-dismiss-nudge" accessibilityRole="button" accessibilityLabel="Dismiss backup reminder" onPress={() => void dismissNudge()} style={styles.dismiss}><Text style={{ color: colors.textSecondary }}>×</Text></Pressable></View> : null}

      <View style={styles.privacy}><Text style={{ color: colors.textSecondary }}>⌾</Text><Text style={[styles.privacyText, { color: colors.textSecondary }]}>Backups include your contacts, notes, photos, and settings. API keys are never included.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 }, header: { gap: 16, paddingTop: 8 }, back: { minHeight: 44, alignSelf: "flex-start", borderWidth: 1, borderRadius: 10, justifyContent: "center", paddingHorizontal: 16 }, title: { fontSize: 24, fontWeight: "700" }, hero: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 }, placeholder: { height: 214, borderWidth: 1, borderRadius: 14 }, heroHeading: { flexDirection: "row", alignItems: "center", gap: 8 }, statusDot: { width: 10, height: 10, borderRadius: 5 }, heroTitle: { fontSize: 20, fontWeight: "700" }, body: { fontSize: 15, lineHeight: 21 }, detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, fontSize: 14, lineHeight: 20 }, linkButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }, actions: { flexDirection: "row", gap: 8 }, actionCard: { flex: 1, minHeight: 148, borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 }, actionIcon: { fontSize: 24 }, actionTitle: { fontSize: 16, fontWeight: "700" }, actionHelper: { fontSize: 13, lineHeight: 18 }, encryptionRow: { minHeight: 76, borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }, lock: { fontSize: 22 }, encryptionCopy: { flex: 1, gap: 4 }, rowTitle: { fontSize: 16, fontWeight: "700" }, nudge: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: "row", gap: 8 }, nudgeCopy: { flex: 1, gap: 4 }, dismiss: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }, privacy: { flexDirection: "row", gap: 8, paddingBottom: 24 }, privacyText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
