// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, EmptyState } from "@/components/ui";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { NOT_SET } from "@/constants/glossary";
import { getExecutor } from "@/db/database";
import { isStoredPhotoPath } from "@/db/photo-relative-path";
import {
  readValueHistory,
  type ValueHistoryEntry,
  type ValueHistoryRead,
} from "@/db/value-history-dao";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { customValueDisplayText } from "@/profile/knowledge-presentation";
import type { FieldType } from "@/schemas/types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { formatDateTimeMinuteOrFallback } from "@/utils/dates";

/** The header title until the field's name is read, or when it is gone. */
const FALLBACK_TITLE = "History";

/**
 * One past value as a person reads it. The stored raw TEXT is shown as is
 * (display only, never rewritten, ADR-001); a Date reads through the one date
 * formatter (38.9 D-48), a Toggle reads Yes/No, a stored photo reads "Photo",
 * and an empty value reads "Not set".
 */
function pastValueText(type: FieldType | null, value: string | null): string {
  if (value == null || value === "") return NOT_SET;
  if (type === "toggle" && (value === "1" || value === "0"))
    return value === "1" ? "Yes" : "No";
  if (type === "photo" && isStoredPhotoPath(value)) return "Photo";
  return type === null ? value : customValueDisplayText(type, value);
}

/**
 * A custom field's past values for one person (38.12 D-106): newest first,
 * each with the time it was replaced, under the shared child header (D-08)
 * titled by the field's name. Read-only: no edit or delete. Reached from the
 * Profile's "View history" in every tab that hosts a Profile.
 */
export function ValueHistoryScreen({
  route,
}: RootStackScreenProps<"ValueHistory">) {
  const { colors } = useTheme();
  // The last row scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const { contactId, fieldDefId } = route.params;
  const [history, setHistory] = useState<ValueHistoryRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setHistory(await readValueHistory(getExecutor(), contactId, fieldDefId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [contactId, fieldDefId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const entries = failed ? [] : (history?.entries ?? []);
  const type = history?.field?.type ?? null;
  // The one empty-state component (38.9 D-20): a failed read offers Retry;
  // no history has nothing to do (D-71).
  const emptyState = failed ? (
    <EmptyState
      testID="value-history-failed"
      icon="warning"
      heading="Couldn't load the history"
      body="Nothing was changed. Try again in a moment."
      action={{ label: "Retry", onPress: () => void load() }}
    />
  ) : (
    <EmptyState
      testID="value-history-empty"
      icon="list"
      heading="No earlier values"
      body="When this field's value changes, the old value is kept here."
    />
  );

  return (
    <View style={styles.root}>
      <ShellAppBar
        variant="child"
        title={history?.field?.label ?? FALLBACK_TITLE}
      />
      {loading && history === null && !failed ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentText} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item: ValueHistoryEntry) => String(item.id)}
          contentContainerStyle={[
            entries.length === 0 ? styles.emptyList : styles.list,
            { paddingBottom: bottomClearance },
          ]}
          renderItem={({ item }: { item: ValueHistoryEntry }) => (
            <View
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppText role="body">{pastValueText(type, item.value)}</AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {`Replaced ${formatDateTimeMinuteOrFallback(item.created_at)}`}
              </AppText>
            </View>
          )}
          ListEmptyComponent={
            <ChromeScrim style={styles.emptyPanel} radius={RADII.lg}>
              {emptyState}
            </ChromeScrim>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { gap: SPACING.sm, padding: SPACING.base },
  emptyList: { flexGrow: 1, justifyContent: "center", padding: SPACING.base },
  emptyPanel: { alignItems: "center", gap: SPACING.sm, padding: SPACING.lg },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    gap: SPACING.xs,
    padding: SPACING.base,
  },
});
