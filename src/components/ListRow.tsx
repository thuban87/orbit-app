/**
 * Dense, presentational dashboard List row. Reads and navigation remain owned
 * by HomeScreen; this component only renders the shared DashboardRow fields.
 *
 * TABLE-DRIVEN BACKING (38.5-06 / D-08, D-09, D-10): the row's backing comes
 * from the per-combination art treatment table (`contactsListEntries`), decided
 * by the pure `listRowBacking`:
 *   - `full` (the None backgrounds and Standard Light · Paper in the signed
 *     v3 table): the solid `surface` fill, root palette;
 *   - `seeThrough`: no fill; an absolute-fill `surface` tint at the cell opacity,
 *     and the whole row inside `GlassForegroundScope`. While the row is swiped
 *     (the list host passes `swipeTranslation`), the tint rises to
 *     `SWIPE_ROW_BACKING_OPACITY` on the UI thread (review WR-01, D-48;
 *     `list-row-swipe-backing.ts`);
 *   - `none`: neither; root palette.
 * Every colour read (ring, name, meta, snippet, highlight) comes from the
 * `ScopedPalette` render prop, so it resolves inside the scope when there is
 * one. The category chip paints an OPAQUE `surfaceElevated` fill, so its text
 * keeps the ROOT palette through `useUnscopedTheme()` (C2-L4).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Avatar } from "@/components/Avatar";
import {
  ringVisual,
  type StatusDisplayState,
} from "@/components/contact-card-ring";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { StatusGlyph } from "@/components/icons/StatusGlyph";
import { ScopedPalette } from "@/components/ui/ScopedPalette";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { DashboardSearchResult } from "@/logic/dashboard-search-match";
import { GlassForegroundScope, useUnscopedTheme } from "@/theme";
import { listRowBacking } from "@/theme/art-treatments";
import { ICON_SIZE } from "@/theme/tokens/icon-size";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { resolveFontFamily, TYPOGRAPHY } from "@/theme/tokens/typography";
import { useArtTreatment } from "@/theme/use-art-treatment";
import { isSnoozed } from "@/utils/dates";
import {
  buildRowAccessibilityDescription,
  buildSearchRowContext,
  formatListRecency,
  formatMatchCategories,
  formatMatchExplanation,
} from "./list-row-content";
import { swipeRowTintOpacity } from "./list-row-swipe-backing";

/**
 * A see-through row's tint while it can be swiped (review WR-01, D-48). The
 * opacity follows the swipe translation shared value on the UI thread: the
 * signed level at rest, `SWIPE_ROW_BACKING_OPACITY` while the row is moved.
 * Never driven from React state.
 */
function SwipeRowTint({
  color,
  restOpacity,
  translation,
}: {
  color: string;
  restOpacity: number;
  translation: SharedValue<number>;
}) {
  const swipeOpacity = useAnimatedStyle(() => ({
    opacity: swipeRowTintOpacity(restOpacity, translation.value) ?? restOpacity,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.tint,
        { backgroundColor: color },
        swipeOpacity,
      ]}
    />
  );
}

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
      {sorted.map((highlight) => {
        const start = Math.max(cursor, Math.min(highlight.start, text.length));
        const end = Math.max(
          start,
          Math.min(start + highlight.length, text.length),
        );
        const before = text.slice(cursor, start);
        const matched = text.slice(start, end);
        cursor = end;
        return (
          <Text key={`${highlight.start}-${highlight.length}`}>
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
  /**
   * The list host's swipe translation (px), mirrored from `ReanimatedSwipeable`.
   * A see-through row raises its tint while it is non-zero (D-48).
   */
  swipeTranslation?: SharedValue<number>;
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
  swipeTranslation,
}: ListRowProps) {
  const backing = listRowBacking(useArtTreatment("contactsListEntries"));
  // The chip's opaque fill keeps the root text hierarchy inside a scope (C2-L4).
  const { colors: rootColors } = useUnscopedTheme();
  const displayState: StatusDisplayState = isSnoozed(snoozeUntil, now)
    ? "snoozed"
    : status;
  const recency = formatListRecency(lastContact, now);
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
  // Announce exactly the context this row renders (RG-031 AUD-UIA-007): the
  // search explanation + displayed snippet, else the adaptive line three.
  const accessibilityLabel = buildRowAccessibilityDescription({
    name,
    category: categoryLabel,
    recency,
    isFavourite,
    displayState,
    context: isSearchMode
      ? buildSearchRowContext(searchExplanation, displayedSearchSnippet)
      : (line3?.text ?? null),
  });

  const row = (
    <ScopedPalette>
      {(scoped) => {
        // Snooze has a neutral border; all other states reuse their shared hue.
        const ring = ringVisual(
          displayState === "snoozed" ? null : displayState,
          scoped,
        );
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
              backing.solidFill ? { backgroundColor: scoped.surface } : null,
              { borderColor: ring.color },
            ]}
          >
            {backing.tintOpacity !== null && swipeTranslation !== undefined ? (
              <SwipeRowTint
                color={scoped.surface}
                restOpacity={backing.tintOpacity}
                translation={swipeTranslation}
              />
            ) : backing.tintOpacity !== null ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.tint,
                  {
                    backgroundColor: scoped.surface,
                    opacity: backing.tintOpacity,
                  },
                ]}
              />
            ) : null}
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
                style={[styles.name, { color: scoped.textPrimary }]}
              >
                {name}
              </Text>
              {isSearchMode ? (
                <Text
                  testID={`dashboard-list-row-match-explanation-${contactId}`}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.meta, { color: scoped.textSecondary }]}
                >
                  {searchExplanation}
                </Text>
              ) : (
                <View style={styles.metaRow}>
                  <Text
                    testID={`dashboard-list-row-meta-${contactId}`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.meta,
                      styles.recency,
                      { color: scoped.textSecondary },
                    ]}
                  >
                    {recency}
                  </Text>
                  {categoryLabel !== null ? (
                    <>
                      <Text
                        style={[styles.meta, { color: scoped.textSecondary }]}
                      >
                        ·
                      </Text>
                      <View
                        testID={`dashboard-list-row-category-${contactId}`}
                        style={[
                          styles.categoryChip,
                          { backgroundColor: rootColors.surfaceElevated },
                        ]}
                      >
                        {/* Opaque chip: root palette, even under a see-through
                            row's glass scope (C2-L4). */}
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={[
                            styles.meta,
                            { color: rootColors.textSecondary },
                          ]}
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
                    style={[
                      styles.meta,
                      styles.line3Text,
                      { color: scoped.textSecondary },
                    ]}
                  >
                    <HighlightedSnippet
                      text={displayedSearchSnippet}
                      highlights={strongestMatch?.highlights ?? []}
                      color={scoped.textPrimary}
                    />
                  </Text>
                ) : null
              ) : (
                <View style={styles.line3}>
                  {line3?.iconName ? (
                    <Icon
                      name={line3.iconName}
                      size="sm"
                      tone="textSecondary"
                    />
                  ) : null}
                  <Text
                    testID={`dashboard-list-row-line3-${contactId}`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.meta,
                      styles.line3Text,
                      { color: scoped.textSecondary },
                    ]}
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
                accessibilityLabel={
                  isFavourite ? "Remove favourite" : "Add favourite"
                }
                accessibilityState={{ selected: isFavourite }}
                hitSlop={SPACING.sm}
                onPress={onToggleFavourite}
                style={styles.favouriteButton}
              >
                <Icon
                  name="favorite"
                  state={isFavourite ? "active" : "default"}
                  size="md"
                  tone={isFavourite ? "accentText" : "textSecondary"}
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
      }}
    </ScopedPalette>
  );

  return backing.scoped ? (
    <GlassForegroundScope>{row}</GlassForegroundScope>
  ) : (
    row
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
  tint: {
    borderRadius: RADII.lg,
  },
  content: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  name: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.body.family,
      TYPOGRAPHY.body.weight,
    ),
    fontSize: TYPOGRAPHY.body.size,
    fontWeight: TYPOGRAPHY.body.weight,
    lineHeight: TYPOGRAPHY.body.lineHeight,
  },
  meta: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.caption.family,
      TYPOGRAPHY.caption.weight,
    ),
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
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.label.family,
      TYPOGRAPHY.label.weight,
    ),
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
