/**
 * Dense, presentational dashboard List row. Reads and navigation remain owned
 * by HomeScreen; this component only renders the shared DashboardRow fields.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { StatusGlyph } from "@/components/icons/StatusGlyph";
import { Icon } from "@/components/icons/Icon";
import {
  ringVisual,
  type StatusDisplayState,
} from "@/components/contact-card-ring";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { DashboardSearchResult } from "@/logic/dashboard-search-match";
import type { IconName } from "@/components/icons/icon-registry";
import { useTheme } from "@/theme";
import { ICON_SIZE } from "@/theme/tokens/icon-size";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { isSnoozed } from "@/utils/dates";
import {
  buildRowAccessibilityDescription,
  formatMatchCategories,
  formatMatchExplanation,
  formatListRecency,
} from "./list-row-content";

function HighlightedSnippet({
  text,
  highlights,
  color,
}: {
  text: string;
  highlights: ReadonlyArray<{ readonly start: number; readonly length: number }>;
  color: string;
}) {
  const sorted = [...highlights].sort((left, right) => left.start - right.start);
  let cursor = 0;
  return (
    <>
      {sorted.map((highlight, index) => {
        const start = Math.max(cursor, Math.min(highlight.start, text.length));
        const end = Math.max(start, Math.min(start + highlight.length, text.length));
        const before = text.slice(cursor, start);
        const matched = text.slice(start, end);
        cursor = end;
        return (
          <Text key={`${highlight.start}-${highlight.length}-${index}`}>
            {before}
            <Text style={[styles.highlight, { color }]}>{matched}</Text>
          </Text>
        );
      })}
      {text.slice(cursor)}
    </>
  );
}

export interface ListRowProps {
  contactId: number;
  name: string;
  photo: string | null;
  modifiedAt: string;
  categoryLabel: string | null;
  lastContact: string | null;
  snoozeUntil: string | null;
  status: ProfileStatus | null;
  /** Captured once by HomeScreen for a deterministic render pass. */
  now: string;
  onPress: () => void;
  /** The current binary favourite membership, owned by HomeScreen. */
  isFavourite?: boolean;
  onToggleFavourite?: () => void;
  /** The selected adaptive third content line, owned by HomeScreen. */
  line3?: { text: string; iconName?: IconName } | null;
  /** Gesture-equivalent actions injected by the list host. */
  onLogInteraction?: () => void;
  onEditContact?: () => void;
  /** Reserved for Plan 06's search-specific row presentation. */
  searchResult?: DashboardSearchResult | null;
  /** Name/fuel search fallback; present only when `searchResult` is null. */
  searchSnippet?: string | null;
}

export function ListRow({
  contactId,
  name,
  photo,
  modifiedAt,
  categoryLabel,
  lastContact,
  snoozeUntil,
  status,
  now,
  onPress,
  isFavourite = false,
  onToggleFavourite,
  line3 = null,
  onLogInteraction,
  onEditContact,
  searchResult,
  searchSnippet = null,
}: ListRowProps) {
  const { colors } = useTheme();
  const displayState: StatusDisplayState = isSnoozed(snoozeUntil, now)
    ? "snoozed"
    : status;
  // Snooze has a neutral border; all other states reuse their shared hue.
  const ring = ringVisual(
    displayState === "snoozed" ? null : displayState,
    colors,
  );
  const recency = formatListRecency(lastContact, now);
  const accessibilityLabel = buildRowAccessibilityDescription({
    name,
    category: categoryLabel,
    recency,
    isFavourite,
    displayState,
  });
  const isSearchMode = searchResult !== undefined;
  const strongestMatch = searchResult?.matches[0];
  const searchExplanation = isSearchMode
    ? formatMatchExplanation(
        searchResult?.totalMatchCount ?? 1,
        searchResult
          ? formatMatchCategories(searchResult.matches.map((match) => match.sourceKind))
          : [],
        searchResult?.moreMatchesLabel,
      )
    : null;
  const displayedSearchSnippet =
    strongestMatch?.snippet ?? (searchResult === null ? searchSnippet : null);

  return (
    <Pressable
      testID={`dashboard-list-row-${contactId}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={
        onLogInteraction && onEditContact
          ? [
              { name: "log-interaction", label: "Log Interaction" },
              { name: "edit-contact", label: "Edit Contact" },
            ]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "log-interaction") {
          onLogInteraction?.();
        } else if (event.nativeEvent.actionName === "edit-contact") {
          onEditContact?.();
        }
      }}
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: ring.color },
      ]}
    >
      <Avatar
        photo={photo}
        name={name}
        contactId={contactId}
        size={SPACING["2xl"]}
        cacheBust={modifiedAt}
      />
      <View style={styles.content}>
        <Text
          testID={`dashboard-list-row-name-${contactId}`}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.name, { color: colors.textPrimary }]}
        >
          {name}
        </Text>
        {isSearchMode ? (
          <Text
            testID={`dashboard-list-row-match-explanation-${contactId}`}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.meta, { color: colors.textSecondary }]}
          >
            {searchExplanation}
          </Text>
        ) : (
          <View style={styles.metaRow}>
            <Text
              testID={`dashboard-list-row-meta-${contactId}`}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.meta, styles.recency, { color: colors.textSecondary }]}
            >
              {recency}
            </Text>
            {categoryLabel !== null ? (
              <>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>·</Text>
                <View
                  testID={`dashboard-list-row-category-${contactId}`}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.meta, { color: colors.textSecondary }]}
                  >
                    {categoryLabel}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        )}
        {isSearchMode ? (
          displayedSearchSnippet !== null ? (
            <Text
              testID={`dashboard-list-row-search-snippet-${contactId}`}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.meta, styles.line3Text, { color: colors.textSecondary }]}
            >
              <HighlightedSnippet
                text={displayedSearchSnippet}
                highlights={strongestMatch?.highlights ?? []}
                color={colors.textPrimary}
              />
            </Text>
          ) : null
        ) : (
          <View style={styles.line3}>
            {line3?.iconName ? (
              <Icon name={line3.iconName} size="sm" tone="textSecondary" />
            ) : null}
            <Text
              testID={`dashboard-list-row-line3-${contactId}`}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.meta, styles.line3Text, { color: colors.textSecondary }]}
            >
              {line3?.text ?? ""}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.trailing}>
        <Pressable
          testID={`dashboard-list-row-favourite-${contactId}`}
          accessibilityRole="button"
          accessibilityLabel={isFavourite ? "Remove favourite" : "Add favourite"}
          accessibilityState={{ selected: isFavourite }}
          hitSlop={SPACING.sm}
          onPress={onToggleFavourite}
          style={styles.favouriteButton}
        >
          <Icon
            name="favorite"
            state={isFavourite ? "active" : "default"}
            size="md"
            tone={isFavourite ? "accent" : "textSecondary"}
          />
        </Pressable>
        {displayState !== null ? (
          <View
            accessible={false}
            accessibilityElementsHidden
            style={styles.statusGlyph}
          >
            <StatusGlyph state={displayState} size="md" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderRadius: RADII.lg,
    borderWidth: SPACING.xs / 2,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: SPACING["2xl"] + SPACING.lg,
    padding: SPACING.md,
  },
  content: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  name: {
    fontFamily: TYPOGRAPHY.body.family,
    fontSize: TYPOGRAPHY.body.size,
    fontWeight: TYPOGRAPHY.body.weight,
    lineHeight: TYPOGRAPHY.body.lineHeight,
  },
  meta: {
    fontFamily: TYPOGRAPHY.caption.family,
    fontSize: TYPOGRAPHY.caption.size,
    fontWeight: TYPOGRAPHY.caption.weight,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.xs,
    minWidth: 0,
  },
  recency: {
    flexShrink: 1,
  },
  categoryChip: {
    borderRadius: RADII.sm,
    flexShrink: 1,
    maxWidth: SPACING["2xl"] * 3,
    paddingHorizontal: SPACING.xs,
  },
  line3: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.xs,
    minWidth: 0,
  },
  line3Text: {
    flex: 1,
  },
  highlight: {
    fontFamily: TYPOGRAPHY.label.family,
    fontSize: TYPOGRAPHY.label.size,
    fontWeight: TYPOGRAPHY.label.weight,
    lineHeight: TYPOGRAPHY.label.lineHeight,
  },
  trailing: {
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  favouriteButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: SPACING["2xl"],
    minWidth: SPACING["2xl"],
  },
  statusGlyph: {
    height: ICON_SIZE.md,
    width: ICON_SIZE.md,
  },
});
