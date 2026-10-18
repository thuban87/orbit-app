// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's AppText `role` is a typography role, not ARIA.
/**
 * The "Review now" list (38.12 D-121; D-70, D-24): after a type change that
 * flagged values, the people whose value for this field needs fixing. Each row
 * opens Edit Contact at that field, where the problem is explained. The list
 * reloads on focus, so a person drops off once their value is fixed; an empty
 * list says there is nothing left to fix.
 *
 * Read-only: it lists through `listContactsWithUnreadableValues` (the shared
 * `isFlaggedCustomValue` predicate, C-4) and never writes a value (CLAUDE.md
 * custom-field invariants).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, EmptyState } from "@/components/ui";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { getExecutor } from "@/db/database";
import { listDefs } from "@/db/field-defs-dao";
import {
  listContactsWithUnreadableValues,
  type UnreadableValueRow,
} from "@/db/field-values-dao";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "custom-field-review";

type ReviewState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; label: string; rows: UnreadableValueRow[] };

/** The child header's title (D-121). */
export function customFieldReviewTitle(label: string | null): string {
  return label ? `${label} — needs fixing` : "Needs fixing";
}

export function CustomFieldReviewScreen({
  navigation,
  route,
}: RootStackScreenProps<"CustomFieldReview">) {
  const { fieldDefId } = route.params;
  const { colors } = useTheme();
  // The last row scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const [state, setState] = useState<ReviewState>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [defs, rows] = await Promise.all([
        listDefs(exec, { includeQuarantined: true }),
        listContactsWithUnreadableValues(exec, fieldDefId),
      ]);
      const label = defs.find((def) => def.id === fieldDefId)?.label ?? "";
      setState({ status: "ready", label, rows });
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load the review list", err);
      setState({ status: "failed" });
    }
  }, [fieldDefId]);

  // Reload on every focus: returning from Edit Contact drops a fixed person.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const title = customFieldReviewTitle(
    state.status === "ready" ? state.label : null,
  );
  const rows = state.status === "ready" ? state.rows : [];

  const emptyState =
    state.status === "failed" ? (
      <EmptyState
        testID="custom-field-review-failed"
        icon="warning"
        heading="Couldn't load this list"
        body="Try again in a moment."
        action={{ label: "Try again", onPress: () => void load() }}
      />
    ) : state.status === "loading" ? null : (
      <EmptyState
        testID="custom-field-review-empty"
        icon="check"
        heading="Nothing left to fix"
        body="Every value in this field now fits its type."
      />
    );

  return (
    <View testID="custom-field-review-screen" style={styles.root}>
      <ShellAppBar variant="child" title={title} />
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.contactId)}
        contentContainerStyle={[
          rows.length === 0 ? styles.emptyList : styles.list,
          { paddingBottom: bottomClearance },
        ]}
        renderItem={({ item }) => (
          <Pressable
            testID={`custom-field-review-row-${item.contactId}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, saved as ${item.value}`}
            accessibilityHint="Opens Edit Contact at this field"
            onPress={() =>
              navigation.navigate("Edit", {
                contactId: item.contactId,
                focusFieldDefId: fieldDefId,
              })
            }
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Avatar
              photo={item.photo}
              name={item.name}
              contactId={item.contactId}
              size={40}
            />
            <View style={styles.rowCopy}>
              <AppText role="label" numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText
                role="caption"
                numberOfLines={2}
                style={{ color: colors.textSecondary }}
              >
                {item.value}
              </AppText>
            </View>
            <Icon name="forward" tone="textSecondary" size="sm" />
          </Pressable>
        )}
        ListEmptyComponent={
          emptyState ? (
            <ChromeScrim style={styles.emptyPanel} radius={RADII.lg}>
              {emptyState}
            </ChromeScrim>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { gap: SPACING.sm, padding: SPACING.base },
  emptyList: { flexGrow: 1, justifyContent: "center", padding: SPACING.base },
  emptyPanel: { alignItems: "center", gap: SPACING.sm, padding: SPACING.lg },
  row: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.base,
  },
  rowCopy: { flex: 1, gap: SPACING.xs },
});
