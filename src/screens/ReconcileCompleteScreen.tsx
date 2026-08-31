import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getExecutor } from "@/db/database";
import {
  reconcileCompletionCounts,
  type ReconcileCompletionCounts,
} from "@/db/reconcile-session-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";

function interactionLabel(count: number): string {
  return `${count} interaction${count === 1 ? "" : "s"}`;
}

function footerEntry(label: string, count: number, colors: ReturnType<typeof useTheme>["colors"]) {
  return (
    <View key={label} style={[styles.footerEntry, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.footerText, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.countDetail, { color: colors.textSecondary }]}>{interactionLabel(count)}</Text>
    </View>
  );
}

/** Calm durable summary for both non-empty and zero-change linked-contact checks. */
export function ReconcileCompleteScreen({ navigation, route }: RootStackScreenProps<"ReconcileComplete">) {
  const { colors } = useTheme();
  const [counts, setCounts] = useState<ReconcileCompletionCounts | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setCounts(await reconcileCompletionCounts(getExecutor(), route.params.sessionId));
    setFailed(false);
  }, [route.params.sessionId]);
  useEffect(() => { void load().catch(() => setFailed(true)); }, [load]);

  if (failed || counts === null) return <View style={[styles.root, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Check complete</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Couldn&apos;t load the check summary. Please go back and try again.</Text></View>;
  return <View testID="reconcile-complete-screen" style={[styles.root, { backgroundColor: colors.background }]}>
    <Text style={[styles.title, { color: colors.textPrimary }]}>Check complete</Text>
    <View style={styles.counts}>
      {footerEntry("Checked", counts.checked, colors)}
      {footerEntry("Changed", counts.changed, colors)}
      {footerEntry("Updated", counts.updated, colors)}
      {footerEntry("Kept Orbit values", counts.keptOrbitValues, colors)}
      {footerEntry("Source missing", counts.sourceMissing, colors)}
    </View>
    <View style={styles.actions}>
      {counts.unresolved > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="View unresolved" onPress={() => navigation.navigate("ReconcileGrid", { sessionId: route.params.sessionId })} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.textPrimary }}>View unresolved</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => navigation.reset({ index: 0, routes: [{ name: "Home" }] })} style={[styles.doneButton, { backgroundColor: colors.accent }]}><Text style={{ color: colors.background }}>Done</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, padding: 16, gap: 16 }, title: { fontSize: 24, fontWeight: "700" }, body: { fontSize: 15, lineHeight: 21 }, counts: { gap: 10 }, footerEntry: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, gap: 2 }, footerText: { fontSize: 16, fontWeight: "600" }, countDetail: { fontSize: 13 }, actions: { gap: 10, marginTop: "auto" }, secondaryButton: { minHeight: 44, justifyContent: "center", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }, doneButton: { minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 } });
