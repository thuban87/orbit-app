import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import {
  type BackupHost,
  DEFAULT_BACKUP_HOST,
  restoreReturnLabel,
  restoreReturnRouteName,
} from "@/screens/backup-dualhome-logic";
import {
  restoredPhotosMissingCopy,
  skippedPhotosCopy,
} from "@/services/backup/skipped-photos";
import { useTheme } from "@/theme";

export function RestoreResultScreen({
  navigation,
  route,
  host = DEFAULT_BACKUP_HOST,
}: RootStackScreenProps<"RestoreResult"> & { host?: BackupHost }) {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const {
    added,
    updated,
    newerLocalKept,
    deletionsApplied,
    photosNeedingAttention,
    photoCleanupPending,
    scheduleResyncPending,
    replaceSafetySnapshot,
    replaceSafetySnapshotSkippedPhotos,
    restoredPhotosMissing,
  } = route.params;
  // 38.6 D-24 / D-26: photos left out of the safety backup, and skipped-photo
  // rows this phone had no photo for either. Each has its own copy (D-33).
  const safetySkipped = skippedPhotosCopy(replaceSafetySnapshotSkippedPhotos);
  const restoredMissing = restoredPhotosMissingCopy(restoredPhotosMissing);
  const pending = [
    photosNeedingAttention > 0
      ? `${photosNeedingAttention} photo${photosNeedingAttention === 1 ? "" : "s"}`
      : null,
    photoCleanupPending > 0 ? "photo cleanup" : null,
    scheduleResyncPending ? "reminders" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const returnLabel = restoreReturnLabel(host);
  // The shared header and its Back (38.9 D-16). The success reset leaves
  // [hub, RestoreResult], so Back lands on the return hub, like the button.
  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Backup restored" />
      <ScrollView
        testID="restore-result-screen"
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
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Added: {added} · Updated: {updated} · Newer local kept:{" "}
            {newerLocalKept} · Deletions applied: {deletionsApplied}
          </Text>
          {restoredMissing ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {restoredMissing}
            </Text>
          ) : null}
          {pending ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Your data is restored. {pending} will be retried the next time
              Orbit opens.
            </Text>
          ) : null}
          {replaceSafetySnapshot === "verified" ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              A verified backup of this device was created first.
              {safetySkipped ? ` ${safetySkipped}` : ""}
            </Text>
          ) : null}
          {replaceSafetySnapshot === "not-configured" ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              No automatic backup destination was configured.
            </Text>
          ) : null}
          <Pressable
            testID="restore-return-to-backup"
            accessibilityRole="button"
            accessibilityLabel={returnLabel}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: restoreReturnRouteName(host) }],
              })
            }
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: colors.onAccent }}>{returnLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 16 },
  body: { fontSize: 16, lineHeight: 24 },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
