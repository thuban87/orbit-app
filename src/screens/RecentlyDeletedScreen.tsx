import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button, ConfirmDialog } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import { purgeMemoryPermanently, restoreMemory } from "@/db/memories-dao";
import { listRecentlyDeleted, type MemoryRow } from "@/db/memories-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { MEMORY_TRASH_WINDOW_DAYS } from "@/services/memory-trash-sweep";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatDisplayDateOrFallback } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "recently-deleted";

function memoryLabel(memory: MemoryRow): string {
  return memory.custom_label ?? memory.value ?? "Untitled memory";
}

export function RecentlyDeletedScreen({
  route,
}: RootStackScreenProps<"RecentlyDeleted">) {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
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
        Logger.error(
          LOG_SCOPE,
          "failed to load recently deleted memories",
          error,
        );
        if (!cancelled) setRows([]);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const reload = () =>
    void load().catch((error) =>
      Logger.error(
        LOG_SCOPE,
        "failed to refresh recently deleted memories",
        error,
      ),
    );
  const restore = (id: number) =>
    void restoreMemory(getExecutor(), { id, contactId, now: localDateTime() })
      .then(reload)
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to restore memory", error),
      );
  const confirmPurge = () => {
    if (!pendingPurge) return;
    const memory = pendingPurge;
    setPendingPurge(null);
    void purgeMemoryPermanently(getExecutor(), { id: memory.id, contactId })
      .then(reload)
      .catch((error) =>
        Logger.error(LOG_SCOPE, "failed to purge memory", error),
      );
  };

  return (
    <View style={styles.root}>
      {/* House header (38.9 D-16, D-44). */}
      <ShellAppBar variant="child" title="Recently Deleted" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <AppText role="heading">Recently Deleted is empty</AppText>
            <AppText role="body" style={{ color: colors.textSecondary }}>
              Deleted memories appear here and are removed automatically after{" "}
              {MEMORY_TRASH_WINDOW_DAYS} days.
            </AppText>
          </View>
        ) : (
          rows.map((memory) => (
            <View
              key={memory.id}
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.copy}>
                <AppText role="body">{memoryLabel(memory)}</AppText>
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {/* 38.9 D-48: the date part of deleted_at, display only. */}
                  Deleted{" "}
                  {memory.deleted_at
                    ? formatDisplayDateOrFallback(
                        memory.deleted_at,
                        memory.deleted_at,
                      )
                    : ""}
                </AppText>
              </View>
              <View style={styles.actions}>
                <Button
                  role="primary"
                  label="Restore"
                  onPress={() => restore(memory.id)}
                />
                <Button
                  role="secondary"
                  label="Delete permanently"
                  onPress={() => setPendingPurge(memory)}
                />
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
  content: { gap: SPACING.md, padding: SPACING.base },
  copy: { flex: 1, gap: SPACING.xs },
  empty: { gap: SPACING.sm, paddingTop: SPACING.xl },
  root: { flex: 1 },
  row: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.md,
    padding: SPACING.base,
  },
});
