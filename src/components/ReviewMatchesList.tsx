// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * Review matches list (38.12 D-107, D-15, D-51). A one-column list: each row
 * shows the incoming person, "Might be: <Orbit name> (+N)" and the evidence
 * for that named contact. Tapping a row inspects that one person (the host
 * opens MatchChoiceSheet); long-press enters multi-select, and the bulk bar
 * puts its actions on the bar itself as buttons. There is no centred
 * "Choose action" dialog here (D-107: "The two centred dialogs go";
 * convergence c2 B-4). Reconcile keeps CandidateCardGrid and its chooser.
 *
 * The row's "Might be" line and evidence come from `item.candidates`, which
 * the host fills with the SAME filtered and ordered choices the sheet offers
 * (D-52; convergence c2 B-10, c3 D-3), so the row never names a candidate the
 * sheet hides.
 *
 * Accessibility reuses the Reconcile card contract
 * (`buildCandidateCardAccessibility`, `CANDIDATE_SELECTION_ACTION`), so the
 * Select/Deselect action mirrors the long-press. All colours via `useTheme()`.
 */
import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import type {
  CandidateChoice,
  CandidateItem,
} from "@/components/CandidateCardGrid";
import {
  buildCandidateCardAccessibility,
  CANDIDATE_CARD_FAILURE_COPY,
  CANDIDATE_SELECTION_ACTION,
} from "@/components/candidate-card-a11y";
import { isBulkActionAvailable } from "@/components/candidate-card-grid-actions";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

// The row/choice shapes are shared with Reconcile's grid; Review matches
// callers import them from here so they do not depend on the grid itself.
export type { CandidateChoice, CandidateItem };

/** Review matches' bulk actions (the grid has its own, fix-pass queue 3). */
export type BulkAction = "link" | "import-new" | "skip";

/** Row avatar diameter (40), the existing-contact choice size. */
const ROW_AVATAR_SIZE = SPACING["2xl"] - SPACING.sm;

/** The bulk bar's button labels (D-107 sheet wording). */
export const REVIEW_MATCHES_ACTION_LABELS: Record<BulkAction, string> = {
  link: "Link",
  "import-new": "Import as new",
  skip: "Skip",
};

/**
 * "Might be: <first> (+N)" from the row's filtered/ordered choices; null when
 * no candidate survives the filter (the row then shows no "Might be" line).
 */
export function mightBeLine(
  candidates: readonly CandidateChoice[] | undefined,
): string | null {
  const first = candidates?.[0];
  if (!first) return null;
  const more = (candidates?.length ?? 0) - 1;
  return more > 0
    ? `Might be: ${first.name} (+${more})`
    : `Might be: ${first.name}`;
}

export interface ReviewMatchesListProps {
  items: CandidateItem[];
  /** Today's DuplicateReview bulk set (link, import-new, skip). */
  bulkActions: BulkAction[];
  /** A row tapped outside multi-select: settle that one person. */
  onInspect: (item: CandidateItem) => void;
  onBulkAction: (
    action: BulkAction,
    items: CandidateItem[],
  ) => Promise<void> | void;
  isActionEligible?: (
    action: BulkAction,
    selectedItems: readonly CandidateItem[],
  ) => boolean;
  /** Shows the "Checking for matches…" line instead of the list. */
  loading?: boolean;
}

export function ReviewMatchesList({
  items,
  bulkActions,
  onInspect,
  onBulkAction,
  isActionEligible,
  loading = false,
}: ReviewMatchesListProps) {
  const { colors } = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<CandidateItem["id"]>>(
    new Set(),
  );
  const [imageErrors, setImageErrors] = useState<Set<CandidateItem["id"]>>(
    new Set(),
  );
  const [failedIds, setFailedIds] = useState<Set<CandidateItem["id"]>>(
    new Set(),
  );

  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const multiSelect = selectedItems.length > 0;

  const toggleSelection = (item: CandidateItem) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const runBulkAction = async (action: BulkAction) => {
    if (!isBulkActionAvailable(action, selectedItems, isActionEligible)) return;
    const targets = selectedItems;
    if (targets.length === 0) return;
    try {
      await onBulkAction(action, targets);
      setFailedIds((current) => {
        const next = new Set(current);
        for (const item of targets) next.delete(item.id);
        return next;
      });
      setSelectedIds(new Set());
    } catch {
      // Keep the rest of the list usable and mark the affected rows retryable.
      setFailedIds(
        (current) => new Set([...current, ...targets.map((item) => item.id)]),
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.progress}>
        <Text style={{ color: colors.textSecondary }}>
          Checking for matches…
        </Text>
      </View>
    );
  }

  const availableActions = bulkActions.filter(
    (action) =>
      REVIEW_MATCHES_ACTION_LABELS[action] !== undefined &&
      isBulkActionAvailable(action, selectedItems, isActionEligible),
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          const failed = failedIds.has(item.id);
          const showPhoto = item.photoUri != null && !imageErrors.has(item.id);
          const mightBe = mightBeLine(item.candidates);
          const a11y = buildCandidateCardAccessibility({
            name: item.name,
            recommendationText: mightBe,
            evidenceHint: item.evidenceHint,
            failureText: failed ? CANDIDATE_CARD_FAILURE_COPY : null,
            selected,
            selectionMode: multiSelect,
          });
          return (
            <Pressable
              testID={`review-match-row-${item.id}`}
              accessibilityRole="button"
              {...a11y}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === CANDIDATE_SELECTION_ACTION)
                  toggleSelection(item);
              }}
              onPress={() =>
                multiSelect ? toggleSelection(item) : onInspect(item)
              }
              onLongPress={() => toggleSelection(item)}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.borderStrong : colors.border,
                },
                selected && styles.rowSelected,
              ]}
            >
              {item.photo ? (
                <Avatar
                  photo={item.photo}
                  name={item.name}
                  contactId={item.id}
                  size={ROW_AVATAR_SIZE}
                />
              ) : showPhoto ? (
                <Image
                  accessibilityLabel={`Photo of ${item.name}`}
                  source={{ uri: item.photoUri ?? undefined }}
                  contentFit="cover"
                  onError={() =>
                    setImageErrors((current) => new Set([...current, item.id]))
                  }
                  style={styles.photo}
                />
              ) : (
                <Avatar
                  photo={null}
                  name={item.name}
                  contactId={item.id}
                  size={ROW_AVATAR_SIZE}
                />
              )}
              <View style={styles.rowText}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.name, { color: colors.textPrimary }]}
                >
                  {item.name}
                </Text>
                {mightBe ? (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.mightBe, { color: colors.textPrimary }]}
                  >
                    {mightBe}
                  </Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.hint, { color: colors.textSecondary }]}
                >
                  {item.evidenceHint}
                </Text>
                {failed ? (
                  <Text style={[styles.error, { color: colors.textSecondary }]}>
                    {CANDIDATE_CARD_FAILURE_COPY}
                  </Text>
                ) : null}
              </View>
              {multiSelect ? (
                // Non-border selected mark (filled vs outline glyph); the
                // state itself is announced via accessibilityState.
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Icon
                    name="select"
                    state={selected ? "active" : "default"}
                    size="md"
                    tone={selected ? "accentText" : "textSecondary"}
                  />
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      {multiSelect ? (
        <View
          testID="review-matches-bulk-bar"
          style={[
            styles.bulkBar,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.bulkCount, { color: colors.textPrimary }]}>
            {selectedItems.length} selected
          </Text>
          <View style={styles.bulkActions}>
            {availableActions.map((action) => (
              <View key={action} style={styles.bulkAction}>
                <Button
                  role="secondary"
                  testID={`review-matches-bulk-${action}`}
                  label={REVIEW_MATCHES_ACTION_LABELS[action] ?? action}
                  onPress={() => void runBulkAction(action)}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { gap: SPACING.sm, padding: SPACING.base },
  row: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
    padding: SPACING.md,
  },
  rowSelected: { borderWidth: 2 },
  photo: {
    width: ROW_AVATAR_SIZE,
    height: ROW_AVATAR_SIZE,
    borderRadius: ROW_AVATAR_SIZE / 2,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600" },
  mightBe: { fontSize: 14, fontWeight: "400" },
  hint: { fontSize: 13, fontWeight: "400" },
  error: { fontSize: 13, fontWeight: "600" },
  progress: { alignItems: "center", justifyContent: "center", minHeight: 120 },
  bulkBar: {
    borderTopWidth: 1,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  bulkCount: { fontSize: 16, fontWeight: "600" },
  bulkActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  bulkAction: { flexGrow: 1 },
});
