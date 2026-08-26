import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";

export function RestoreResultScreen({
  navigation,
  route,
}: RootStackScreenProps<"RestoreResult">) {
  const { colors } = useTheme();
  const { added, updated, newerLocalKept, deletionsApplied, replaceSafetySnapshot } = route.params;
  return (
    <ScrollView testID="restore-result-screen" style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Backup restored</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Added: {added} · Updated: {updated} · Newer local kept: {newerLocalKept} · Deletions applied: {deletionsApplied}</Text>
        {replaceSafetySnapshot === "verified" ? <Text style={[styles.body, { color: colors.textSecondary }]}>A verified backup of this device was created first.</Text> : null}
        {replaceSafetySnapshot === "not-configured" ? <Text style={[styles.body, { color: colors.textSecondary }]}>No automatic backup destination was configured.</Text> : null}
        <Pressable testID="restore-return-to-backup" accessibilityRole="button" accessibilityLabel="Return to Backup and Restore" onPress={() => navigation.reset({ index: 0, routes: [{ name: "Backup" }] })} style={[styles.primaryButton, { backgroundColor: colors.accent }]}><Text style={{ color: colors.textPrimary }}>Return to Backup & Restore</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 48 },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "600", lineHeight: 29 },
  body: { fontSize: 16, lineHeight: 24 },
  primaryButton: { minHeight: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
});
