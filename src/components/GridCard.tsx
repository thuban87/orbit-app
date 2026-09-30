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
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { StatusGlyph } from "@/components/icons/StatusGlyph";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ScopedPalette } from "@/components/ui/ScopedPalette";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { DashboardSearchResult } from "@/logic/dashboard-search-match";
import { useTheme } from "@/theme";
import { ICON_SIZE } from "@/theme/tokens/icon-size";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { resolveFontFamily, TYPOGRAPHY } from "@/theme/tokens/typography";
import { isSnoozed } from "@/utils/dates";
import {
  GRID_CARD_BORDER,
  GRID_CARD_PADDING,
  GRID_CORNER_HIT,
  GRID_CORNER_INSET,
  GRID_CORNER_OPTICAL_OFFSET,
  type GridCardGeometry,
} from "./grid-card-geometry";
import {
  buildRowAccessibilityDescription,
  buildSearchRowContext,
  formatListRecency,
  formatMatchCategories,
  formatMatchExplanation,
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

/**
 * The corner glyph's padding inside its hit box (D-07): the box sits inside the
 * GlassSurface border, so the visible glyph lands GRID_CORNER_INSET from the
 * card's outer edge.
 */
const CORNER_GLYPH_PADDING =
  GRID_CORNER_INSET - GRID_CARD_BORDER + GRID_CORNER_OPTICAL_OFFSET;

export interface GridCardProps {
  contactId: number;
  /**
   * The photo size and ring box for this grid width (38.6 D-06), from
   * `gridCardGeometry`. The ring box is a fixed square (not stretched to the
   * card width), so the full-radius ring stays a circle (D-73a).
   */
  geometry: GridCardGeometry;
  name: string;
  photo: string | null;
  categoryLabel: string | null;
  lastContact: string | null;
  snoozeUntil: string | null;
  status: ProfileStatus | null;
  /** Captured once by HomeScreen for a deterministic render pass. */
  now: string;
  onPress: () => void;
  /** Opens the host-owned per-contact action menu. */
  onLongPress?: () => void;
  /** Assistive-tech equivalents for the normal-mode card menu actions. */
  onViewProfile?: () => void;
  onQuickLog?: () => void;
  onLogInteraction?: () => void;
  onMessage?: () => void;
  onEditContact?: () => void;
  onSelect?: () => void;
  /** Selection-mode presentation and card-level toggle behavior. */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
  geometry,
  name,
  photo,
  categoryLabel,
  lastContact,
  snoozeUntil,
  status,
  now,
  onPress,
  onLongPress,
  onViewProfile,
  onQuickLog,
  onLogInteraction,
  onMessage,
  onEditContact,
  onSelect,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  isFavourite = false,
  onToggleFavourite,
  searchResult,
  searchSnippet = null,
}: GridCardProps) {
  const { colors } = useTheme();
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
  // Announce the search context this card renders (RG-031 AUD-UIA-007). Normal
  // Grid intentionally omits List's adaptive line three (38.1), so it has none.
  const baseAccessibilityLabel = buildRowAccessibilityDescription({
    name,
    category: categoryLabel,
    recency,
    isFavourite,
    displayState,
    context: isSearchMode
      ? buildSearchRowContext(searchExplanation, displayedSearchSnippet)
      : null,
  });
  const accessibilityLabel = selectionMode
    ? `${baseAccessibilityLabel} ${selected ? "Selected." : "Not selected."}`
    : baseAccessibilityLabel;
  const accessibilityActions = [
    onViewProfile && { name: "view-profile", label: "View Profile" },
    onQuickLog && { name: "quick-log", label: "Quick Log" },
    onLogInteraction && { name: "log-interaction", label: "Log Interaction" },
    onMessage && { name: "message", label: "Message" },
    onEditContact && { name: "edit-contact", label: "Edit Contact" },
    onSelect && { name: "select", label: "Select" },
  ].filter(Boolean) as { name: string; label: string }[];

  return (
    <Pressable
      testID={`dashboard-grid-card-${contactId}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={
        !selectionMode && accessibilityActions.length > 0
          ? accessibilityActions
          : undefined
      }
      onAccessibilityAction={(event) => {
        switch (event.nativeEvent.actionName) {
          case "view-profile":
            onViewProfile?.();
            break;
          case "quick-log":
            onQuickLog?.();
            break;
          case "log-interaction":
            onLogInteraction?.();
            break;
          case "message":
            onMessage?.();
            break;
          case "edit-contact":
            onEditContact?.();
            break;
          case "select":
            onSelect?.();
            break;
        }
      }}
      onPress={selectionMode ? (onToggleSelect ?? onPress) : onPress}
      onLongPress={selectionMode ? undefined : onLongPress}
      style={styles.card}
    >
      <GlassSurface
        blurAvailable={false}
        density="dense"
        treatment="contact-entry"
        style={styles.surface}
        contentStyle={styles.surfaceContent}
      >
        <ScopedPalette>
          {(scoped) => {
            // The status ring reads the scoped palette so it matches the scoped
            // StatusGlyph inside this card (D-24 on-glass status variants, D-34).
            const ring = ringVisual(
              displayState === "snoozed" ? null : displayState,
              scoped,
            );
            return (
              <>
                {/* D-07: the corner controls sit at the card corners, above the
                    photo. Each 48×48 hit area is anchored at its corner and
                    extends inward (GlassSurface clips, and Android does not
                    deliver touches outside parent bounds). */}
                {selectionMode ? (
                  <Pressable
                    testID={`dashboard-grid-card-select-${contactId}`}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${selected ? "Deselect" : "Select"} ${name}`}
                    accessibilityState={{ checked: selected }}
                    hitSlop={SPACING.sm}
                    onPress={onToggleSelect}
                    style={[styles.corner, styles.cornerLeft]}
                  >
                    <Icon
                      name="select"
                      state={selected ? "active" : "default"}
                      size="md"
                      tone={selected ? "accentText" : "textSecondary"}
                    />
                  </Pressable>
                ) : null}

                {selectionMode ? (
                  <View
                    testID={`dashboard-grid-card-favourite-${contactId}`}
                    accessible={false}
                    accessibilityElementsHidden
                    style={[styles.corner, styles.cornerRight]}
                  >
                    <Icon
                      name="favorite"
                      state={isFavourite ? "active" : "default"}
                      size="md"
                      tone={isFavourite ? "accentText" : "textSecondary"}
                    />
                  </View>
                ) : (
                  <Pressable
                    testID={`dashboard-grid-card-favourite-${contactId}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFavourite ? "Remove favourite" : "Add favourite"
                    }
                    accessibilityState={{ selected: isFavourite }}
                    hitSlop={SPACING.sm}
                    onPress={onToggleFavourite}
                    style={[styles.corner, styles.cornerRight]}
                  >
                    <Icon
                      name="favorite"
                      state={isFavourite ? "active" : "default"}
                      size="md"
                      tone={isFavourite ? "accentText" : "textSecondary"}
                    />
                  </Pressable>
                )}

                <View style={styles.layout}>
                  <View
                    style={[
                      styles.avatarArea,
                      {
                        height: geometry.ringBox,
                        // avatarTop is measured from the card's OUTER edge;
                        // this View sits inside the 1 px border.
                        marginTop: geometry.avatarTop - GRID_CARD_BORDER,
                        width: geometry.ringBox,
                      },
                    ]}
                  >
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
                      size={geometry.avatarSize}
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

                  {/* D-08: fill line 1 first; only the overflow goes to line 2
                      (Android's default highQuality strategy balances lines). */}
                  <Text
                    testID={`dashboard-grid-card-name-${contactId}`}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    textBreakStrategy="simple"
                    style={[styles.name, { color: colors.textPrimary }]}
                  >
                    {name}
                  </Text>

                  {/* D-09: the FlatList row stretches every card to the row's
                      height; pinning the secondary lines to the bottom makes a
                      one-line name reserve line 2 only in a row where another
                      name wraps. No text measurement, no second layout pass. */}
                  <View style={styles.secondary}>
                    {isSearchMode ? (
                      <Text
                        testID={`dashboard-grid-card-match-explanation-${contactId}`}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                          styles.recency,
                          { color: scoped.textSecondary },
                        ]}
                      >
                        {searchExplanation}
                      </Text>
                    ) : (
                      <Text
                        testID={`dashboard-grid-card-recency-${contactId}`}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                          styles.recency,
                          { color: scoped.textSecondary },
                        ]}
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
                          { color: scoped.textSecondary },
                        ]}
                      >
                        <HighlightedSnippet
                          text={displayedSearchSnippet ?? ""}
                          highlights={strongestMatch?.highlights ?? []}
                          color={colors.textPrimary}
                        />
                      </Text>
                    ) : null}
                  </View>
                </View>
              </>
            );
          }}
        </ScopedPalette>
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
    flexGrow: 1,
    minHeight: SPACING["2xl"] * 3,
    padding: 0,
  },
  surfaceContent: {
    flexGrow: 1,
  },
  corner: {
    height: GRID_CORNER_HIT,
    justifyContent: "flex-start",
    paddingTop: CORNER_GLYPH_PADDING,
    position: "absolute",
    top: 0,
    width: GRID_CORNER_HIT,
    zIndex: 1,
  },
  cornerLeft: {
    alignItems: "flex-start",
    left: 0,
    paddingLeft: CORNER_GLYPH_PADDING,
  },
  cornerRight: {
    alignItems: "flex-end",
    paddingRight: CORNER_GLYPH_PADDING,
    right: 0,
  },
  layout: {
    alignItems: "center",
    flexGrow: 1,
    minWidth: 0,
    paddingBottom: GRID_CARD_PADDING,
    paddingHorizontal: GRID_CARD_PADDING,
    paddingTop: 0,
  },
  avatarArea: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
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
  secondary: {
    alignItems: "center",
    alignSelf: "stretch",
    gap: SPACING.xs,
    marginTop: "auto",
    minWidth: 0,
    paddingTop: SPACING.xs,
  },
  name: {
    alignSelf: "stretch",
    marginTop: SPACING.md,
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.label.family,
      TYPOGRAPHY.label.weight,
    ),
    fontSize: TYPOGRAPHY.label.size,
    fontWeight: TYPOGRAPHY.label.weight,
    lineHeight: TYPOGRAPHY.label.lineHeight,
    textAlign: "center",
  },
  recency: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.caption.family,
      TYPOGRAPHY.caption.weight,
    ),
    fontSize: TYPOGRAPHY.caption.size,
    fontWeight: TYPOGRAPHY.caption.weight,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
    textAlign: "center",
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
});
