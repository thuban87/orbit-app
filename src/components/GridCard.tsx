/**
 * Presentational avatar-first Dashboard card. Data, navigation, and favourite
 * writes remain owned by the CardGrid/HomeScreen host.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import {
  ringVisual,
  type StatusDisplayState,
} from "@/components/contact-card-ring";
import { StatusGlyph } from "@/components/icons/StatusGlyph";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { DashboardSearchResult } from "@/logic/dashboard-search-match";
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
  highlights: ReadonlyArray<{
    readonly start: number;
    readonly length: number;
  }>;
  color: string;
}) {
  const sorted = [...highlights].sort(
    (left, right) => left.start - right.start,
  );
  let cursor = 0;
  return (
    <>
      {sorted.map((highlight, index) => {
        const start = Math.max(cursor, Math.min(highlight.start, text.length));
        const end = Math.max(
          start,
          Math.min(start + highlight.length, text.length),
        );
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

export interface GridCardProps {
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
  /** Reserved for Plan 04's compact adaptive third content line. */
  line3?: { text: string; iconName?: IconName } | null;
  /** Reserved for Plan 04's search-mode card presentation. */
  searchResult?: DashboardSearchResult | null;
  /** Reserved for Plan 04's name/fuel search fallback. */
  searchSnippet?: string | null;
}

export function GridCard({
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
  searchResult,
  searchSnippet = null,
}: GridCardProps) {
  const { colors } = useTheme();
  const displayState: StatusDisplayState = isSnoozed(snoozeUntil, now)
    ? "snoozed"
    : status;
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
          ? formatMatchCategories(
              searchResult.matches.map((match) => match.sourceKind),
            )
          : [],
        searchResult?.moreMatchesLabel,
      )
    : null;
  const displayedSearchSnippet =
    strongestMatch?.snippet ?? (searchResult === null ? searchSnippet : null);

  return (
    <Pressable
      testID={`dashboard-grid-card-${contactId}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.card}
    >
      <GlassSurface blurAvailable={false} density="dense" style={styles.surface}>
        <Pressable
          testID={`dashboard-grid-card-favourite-${contactId}`}
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

        <View style={styles.avatarArea}>
          <View
            testID={`dashboard-grid-card-ring-${contactId}`}
            accessible={false}
            accessibilityElementsHidden
            style={[
              styles.statusRing,
              {
                borderColor: ring.color,
                borderWidth: ring.width,
                opacity: ring.opacity,
              },
            ]}
          />
          <Avatar
            photo={photo}
            name={name}
            contactId={contactId}
            size={SPACING["2xl"]}
            cacheBust={modifiedAt}
          />
          {displayState !== null ? (
            <View
              accessible={false}
              accessibilityElementsHidden
              style={styles.statusGlyph}
            >
              <StatusGlyph state={displayState} size="sm" />
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          <Text
            testID={`dashboard-grid-card-name-${contactId}`}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.name, { color: colors.textPrimary }]}
          >
            {name}
          </Text>
          {isSearchMode ? (
            <Text
              testID={`dashboard-grid-card-match-explanation-${contactId}`}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.recency, { color: colors.textSecondary }]}
            >
              {searchExplanation}
            </Text>
          ) : (
            <Text
              testID={`dashboard-grid-card-recency-${contactId}`}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.recency, { color: colors.textSecondary }]}
            >
              {recency}
            </Text>
          )}
          {isSearchMode ? (
            <Text
              testID={`dashboard-grid-card-search-snippet-${contactId}`}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.recency,
                styles.line3Text,
                { color: colors.textSecondary },
              ]}
            >
              <HighlightedSnippet
                text={displayedSearchSnippet ?? ""}
                highlights={strongestMatch?.highlights ?? []}
                color={colors.textPrimary}
              />
            </Text>
          ) : (
            <View style={styles.line3}>
              {line3?.iconName ? (
                <Icon name={line3.iconName} size="sm" tone="textSecondary" />
              ) : null}
              <Text
                testID={`dashboard-grid-card-line3-${contactId}`}
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.recency,
                  styles.line3Text,
                  { color: colors.textSecondary },
                ]}
              >
                {line3?.text ?? ""}
              </Text>
            </View>
          )}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
  },
  surface: {
    minHeight: SPACING["2xl"] * 3,
    padding: SPACING.md,
  },
  favouriteButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    justifyContent: "center",
    minHeight: SPACING["2xl"],
    minWidth: SPACING["2xl"],
    marginBottom: -SPACING.sm,
    marginEnd: -SPACING.sm,
    marginTop: -SPACING.sm,
  },
  avatarArea: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -SPACING.sm,
    padding: SPACING.xs,
    position: "relative",
  },
  statusRing: {
    borderRadius: RADII.full,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  statusGlyph: {
    alignItems: "center",
    bottom: -SPACING.xs,
    height: ICON_SIZE.sm,
    justifyContent: "center",
    position: "absolute",
    right: -SPACING.xs,
    width: ICON_SIZE.sm,
  },
  content: {
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.md,
    minWidth: 0,
  },
  name: {
    fontFamily: TYPOGRAPHY.label.family,
    fontSize: TYPOGRAPHY.label.size,
    fontWeight: TYPOGRAPHY.label.weight,
    lineHeight: TYPOGRAPHY.label.lineHeight,
    textAlign: "center",
  },
  recency: {
    fontFamily: TYPOGRAPHY.caption.family,
    fontSize: TYPOGRAPHY.caption.size,
    fontWeight: TYPOGRAPHY.caption.weight,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
    textAlign: "center",
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
});
