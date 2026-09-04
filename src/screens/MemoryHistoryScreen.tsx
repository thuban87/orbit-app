import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { AppText, Button } from "@/components/ui";
import {
  editHistoryEntry,
  promoteToCurrentValue,
  setCurrentStateValue,
} from "@/db/current-state-history-dao";
import {
  getCurrentStateHistory,
  getCurrentStateValue,
  type CurrentStateEntryRow,
} from "@/db/current-state-history-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  CURRENT_STATE_FIELD_REGISTRY,
  type CurrentStateFieldKey,
} from "@/db/memory-registry";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "memory-history";

export function MemoryHistoryScreen({
  navigation,
  route,
}: RootStackScreenProps<"MemoryHistory">) {
  const { colors } = useTheme();
  const { contactId, fieldKey } = route.params;
  const [current, setCurrent] = useState<CurrentStateEntryRow | null>(null);
  const [history, setHistory] = useState<CurrentStateEntryRow[]>([]);
  const [newDraft, setNewDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState<CurrentStateEntryRow | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const title = CURRENT_STATE_FIELD_REGISTRY[fieldKey].displayName;
  const load = useCallback(
    async (cancelled: () => boolean = () => false) => {
      const exec = getExecutor();
      const [nextCurrent, nextHistory] = await Promise.all([
        getCurrentStateValue(exec, contactId, fieldKey),
        getCurrentStateHistory(exec, contactId, fieldKey),
      ]);
      if (!cancelled()) {
        setCurrent(nextCurrent);
        setHistory(nextHistory);
      }
    },
    [contactId, fieldKey],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void load(() => cancelled).catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load current-state history", error);
        if (!cancelled) {
          setCurrent(null);
          setHistory([]);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const reload = () =>
    void load().catch((error) =>
      Logger.error(LOG_SCOPE, "failed to refresh current-state history", error),
    );
  const priorEntries = useMemo(
    () => history.filter((row) => row.is_current === 0),
    [history],
  );
  const setNewValue = () => {
    const value = newDraft?.trim() ?? "";
    if (!value) return;
    void setCurrentStateValue(getExecutor(), {
      contactId,
      fieldKey,
      value,
      now: localDateTime(),
    })
      .then(() => {
        setNewDraft(null);
        reload();
      })
      .catch((error) => Logger.error(LOG_SCOPE, "failed to set current value", error));
  };
  const saveEdit = () => {
    const value = editDraft.trim();
    if (!editing || !value) return;
    void editHistoryEntry(getExecutor(), {
      contactId,
      fieldKey,
      entryId: editing.id,
      value,
      now: localDateTime(),
    })
      .then(() => {
        setEditing(null);
        setEditDraft("");
        reload();
      })
      .catch((error) => Logger.error(LOG_SCOPE, "failed to edit history entry", error));
  };
  const makeCurrent = (entryId: number) =>
    void promoteToCurrentValue(getExecutor(), {
      contactId,
      fieldKey,
      targetId: entryId,
      now: localDateTime(),
    })
      .then(reload)
      .catch((error) => Logger.error(LOG_SCOPE, "failed to promote history entry", error));

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
        <AppText accessibilityRole="header" role="display">{title}</AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {current ? (
          <View style={[styles.current, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText role="caption" style={{ color: colors.textSecondary }}>most recent</AppText>
            <AppText role="body">{current.value}</AppText>
          </View>
        ) : (
          <View style={styles.empty}>
            <AppText role="heading">Not set yet</AppText>
          </View>
        )}
        {newDraft === null ? (
          <Button role="primary" label="Set new value" onPress={() => setNewDraft("")} />
        ) : (
          <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              accessibilityLabel={`New ${title} value`}
              value={newDraft}
              onChangeText={setNewDraft}
              placeholder="Set a new value"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
            />
            <View style={styles.formActions}>
              <Button role="secondary" label="Cancel" onPress={() => setNewDraft(null)} />
              <Button role="primary" label="Save" onPress={setNewValue} disabled={!newDraft.trim()} />
            </View>
          </View>
        )}
        {current ? (
          <View style={styles.history}>
            <AppText role="heading">Earlier entries</AppText>
            {priorEntries.length === 0 ? (
              <AppText role="body" style={{ color: colors.textSecondary }}>No earlier entries</AppText>
            ) : (
              priorEntries.map((entry) => (
                <View key={entry.id} style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <AppText role="body">{entry.value}</AppText>
                  <AppText role="caption" style={{ color: colors.textSecondary }}>{entry.created_at}</AppText>
                  {editing?.id === entry.id ? (
                    <View style={styles.editForm}>
                      <TextInput
                        accessibilityLabel={`Edit ${title} history value`}
                        value={editDraft}
                        onChangeText={setEditDraft}
                        placeholder="Edit value"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                      />
                      <View style={styles.formActions}>
                        <Button role="secondary" label="Cancel" onPress={() => setEditing(null)} />
                        <Button role="primary" label="Save" onPress={saveEdit} disabled={!editDraft.trim()} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.formActions}>
                      <Button role="secondary" label="Edit" onPress={() => { setEditing(entry); setEditDraft(entry.value); }} />
                      <Button role="tertiary" label="Make current" onPress={() => makeCurrent(entry.id)} />
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  content: { gap: SPACING.md, padding: SPACING.base },
  current: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: SPACING.xs, padding: SPACING.base },
  editForm: { gap: SPACING.sm },
  empty: { paddingTop: SPACING.xl },
  entry: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: SPACING.sm, padding: SPACING.base },
  form: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: SPACING.sm, padding: SPACING.base },
  formActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  header: { alignItems: "center", flexDirection: "row", gap: SPACING.md, padding: SPACING.base },
  history: { gap: SPACING.sm },
  input: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, minHeight: 44, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  root: { flex: 1 },
});
