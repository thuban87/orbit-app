import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  type BackupHost,
  DEFAULT_BACKUP_HOST,
  restoreReturnLabel,
  restoreReturnRouteName,
} from "@/screens/backup-dualhome-logic";
import { useTheme } from "@/theme";

export function RestoreResultScreen({
  navigation,
  route,
  host = DEFAULT_BACKUP_HOST,
}: RootStackScreenProps<"RestoreResult"> & { host?: BackupHost }) {
  const { colors } = useTheme();
  const {
    added,
    updated,
    newerLocalKept,
    deletionsApplied,
    photosNeedingAttention,
    photoCleanupPending,
    scheduleResyncPending,
    replaceSafetySnapshot,
  } = route.params;
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
  return (
    <ScrollView
      testID="restore-result-screen"
      contentContainerStyle={styles.content}
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
          Backup restored
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Added: {added} · Updated: {updated} · Newer local kept:{" "}
          {newerLocalKept} · Deletions applied: {deletionsApplied}
        </Text>
        {pending ? (
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Your data is restored. {pending} will be retried the next time Orbit
            opens.
          </Text>
        ) : null}
        {replaceSafetySnapshot === "verified" ? (
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            A verified backup of this device was created first.
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
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 48 },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "600", lineHeight: 29 },
  body: { fontSize: 16, lineHeight: 24 },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
