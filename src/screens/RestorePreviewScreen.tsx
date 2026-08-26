import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RootStackScreenProps } from "@/navigation/types";
import { restorePreviewCache } from "@/screens/backup-restore-logic";
import { useTheme } from "@/theme";

type RestoreMode = "merge" | "replace-all";

export function RestorePreviewScreen({
  navigation,
  route,
}: RootStackScreenProps<"RestorePreview">) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(restorePreviewCache.read(route.params.token) === null);
  }, [route.params.token]);

  const returnToSelection = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: "Backup" }] });
  }, [navigation]);

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
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} style={[styles.back, { borderColor: colors.border }]}><Text style={{ color: colors.textSecondary }}>Back</Text></Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Restore preview</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Backup details</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Source date: {preview.exportedAt}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Format version: {preview.backupFormatVersion}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Encryption: {preview.encrypted ? "Protected with a passphrase" : "Readable JSON"}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Rows: {preview.rowCount} · Photos: {preview.photoCount}</Text>
      </View>
      <Pressable testID="restore-mode-merge" accessibilityRole="radio" accessibilityLabel="Merge backup" accessibilityState={{ selected: mode === "merge" }} onPress={() => setMode("merge")} style={[styles.card, { backgroundColor: mode === "merge" ? colors.surfaceElevated : colors.surface, borderColor: mode === "merge" ? colors.accent : colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Merge</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Add backup changes while keeping newer local data.</Text>
      </Pressable>
      <Pressable testID="restore-mode-replace" accessibilityRole="radio" accessibilityLabel="Replace all local data" accessibilityState={{ selected: mode === "replace-all" }} onPress={() => setMode("replace-all")} style={[styles.card, { backgroundColor: colors.surface, borderColor: mode === "replace-all" ? colors.danger : colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.danger }]}>Replace all</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Replace local data with this backup. This is destructive.</Text>
      </Pressable>
      <Pressable testID="restore-apply" accessibilityRole="button" accessibilityLabel={mode === "merge" ? "Merge backup" : "Replace and restore"} style={[styles.primaryButton, { backgroundColor: mode === "replace-all" ? colors.danger : colors.accent }]}>
        <Text style={{ color: colors.textPrimary }}>{mode === "merge" ? "Merge backup" : "Replace and restore"}</Text>
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
