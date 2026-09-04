import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button, ConfirmDialog } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import { purgeMemoryPermanently, restoreMemory } from "@/db/memories-dao";
import { listRecentlyDeleted, type MemoryRow } from "@/db/memories-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { MEMORY_TRASH_WINDOW_DAYS } from "@/services/memory-trash-sweep";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "recently-deleted";

function memoryLabel(memory: MemoryRow): string {
  return memory.custom_label ?? memory.value ?? "Untitled memory";
}

export function RecentlyDeletedScreen({
  navigation,
  route,
}: RootStackScreenProps<"RecentlyDeleted">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [pendingPurge, setPendingPurge] = useState<MemoryRow | null>(null);

  const load = useCallback(
    async (cancelled: () => boolean = () => false) => {
      const nextRows = await listRecentlyDeleted(getExecutor(), contactId);
      if (!cancelled()) setRows(nextRows);
    },
    [contactId],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void load(() => cancelled).catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load recently deleted memories", error);
        if (!cancelled) setRows([]);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const reload = () =>
    void load().catch((error) =>
      Logger.error(LOG_SCOPE, "failed to refresh recently deleted memories", error),
    );
  const restore = (id: number) =>
    void restoreMemory(getExecutor(), { id, contactId, now: localDateTime() })
      .then(reload)
      .catch((error) => Logger.error(LOG_SCOPE, "failed to restore memory", error));
  const confirmPurge = () => {
    if (!pendingPurge) return;
    const memory = pendingPurge;
    setPendingPurge(null);
    void purgeMemoryPermanently(getExecutor(), { id: memory.id, contactId })
      .then(reload)
      .catch((error) => Logger.error(LOG_SCOPE, "failed to purge memory", error));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <AppText role="caption">Back</AppText>
        </Pressable>
        <AppText accessibilityRole="header" role="display">
          Recently Deleted
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <AppText role="heading">Recently Deleted is empty</AppText>
            <AppText role="body" style={{ color: colors.textSecondary }}>
              Deleted memories appear here and are removed automatically after {MEMORY_TRASH_WINDOW_DAYS} days.
            </AppText>
          </View>
        ) : (
          rows.map((memory) => (
            <View key={memory.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.copy}>
                <AppText role="body">{memoryLabel(memory)}</AppText>
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  Deleted {memory.deleted_at}
                </AppText>
              </View>
              <View style={styles.actions}>
                <Button role="primary" label="Restore" onPress={() => restore(memory.id)} />
                <Button role="secondary" label="Delete permanently" onPress={() => setPendingPurge(memory)} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <ConfirmDialog
        visible={pendingPurge !== null}
        onRequestClose={() => setPendingPurge(null)}
        onCancel={() => setPendingPurge(null)}
        title="Delete permanently?"
        message="This memory can't be recovered."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={confirmPurge}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: SPACING.sm },
  back: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  content: { gap: SPACING.md, padding: SPACING.base },
  copy: { flex: 1, gap: SPACING.xs },
  empty: { gap: SPACING.sm, paddingTop: SPACING.xl },
  header: { alignItems: "center", flexDirection: "row", gap: SPACING.md, padding: SPACING.base },
  root: { flex: 1 },
  row: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: SPACING.md, padding: SPACING.base },
});
