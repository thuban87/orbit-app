/**
 * The Card-view selection bar (38.13 D-69, mockup M3b) and its More… sheet
 * (D-75). It sits at the bottom of Contacts, directly above the tab bar, as
 * the last in-flow child of HomeScreen's root view (D-72).
 *
 * Row 1: [✕] "N selected" … Select All. Row 2: four equal bordered buttons,
 * icon over label: Quick Log, Snooze, Favorite, More….
 *
 * Presentational only: the host owns every write, dialog, picker, navigation
 * and feedback, and the More… sheet closes itself before it calls the host.
 *
 * The More… sheet opens sized to its rows (38.13 D-87, amending D-71): compact
 * when every row fits, taller when not, through the bulk Set Category sheet's
 * rule (`bulkMoreSheetVariantFor` → `sizedSheetVariantFor`, D-85). Its rows
 * are laid out from the same geometry the prediction reads.
 */
import { useIsFocused } from "@react-navigation/native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BULK_MORE_ROW_ICON_GAP,
  BULK_MORE_ROW_MIN_HEIGHT,
  BULK_MORE_SECTION_GAP,
  BULK_MORE_SECTION_LETTER_SPACING,
  BULK_MORE_TITLE_GAP,
  bulkMoreSheetVariantFor,
} from "@/components/bulk-sheet-fit";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { Sheet } from "@/components/ui/Sheet";
import { useSheetFitEnvironment } from "@/components/use-sheet-fit-environment";
import {
  FAVORITE,
  FAVORITES,
  LOG_INTERACTION,
  MOVE_TO_BIN,
} from "@/constants/glossary";
import type { BulkActionAvailability } from "@/logic/dashboard-selection-applicability";
import { useWindowObstacle } from "@/navigation/use-window-measurement";
import { useDashboardSelectionStore } from "@/stores/dashboard-selection-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { resolveFontFamily, TYPOGRAPHY } from "@/theme/tokens/typography";

export interface BulkActionSurfaceProps {
  selectedCount: number;
  /** A confirmed bulk write is running (D-41): "Working…" shows. */
  pending: boolean;
  /**
   * An action holds the bulk claim while it reads what it applies to, before
   * any write (Favorite, Remove from Favorites, Snooze). The buttons are
   * disabled and announce busy, so a second tap is not silently dropped, but
   * "Working…" does not show: no write is running yet (D-41; 38.13 review
   * A-IN-01). Default false.
   */
  reading?: boolean;
  /** "Select All" or "Deselect all" (D-40). */
  selectAllLabel: string;
  /**
   * What applies to the current selection (D-40, D-74, D-75, D-77): from
   * `selectionApplicability`. Favorite and Snooze count only selected Bound
   * people; Remove from Favorites shows only when one is a favourite.
   */
  availability: BulkActionAvailability;
  onExit: () => void;
  onToggleSelectAll: () => void;
  onQuickLog: () => void;
  /** Opens the shared snooze sheet (38.11 D-82; D-16). */
  onSnooze: () => void;
  onAddFavourites: () => void;
  // The More… sheet's rows (D-75).
  onLogInteraction: () => void;
  onRemoveFavourites: () => void;
  onSetCategory: () => void;
  onChangeFrequency: () => void;
  onArchive: () => void;
}

interface BarButton {
  id: string;
  label: string;
  icon: IconName;
  enabled: boolean;
  onPress: () => void;
}

type SheetRow = BarButton;

export function BulkActionSurface({
  selectedCount,
  pending,
  reading = false,
  selectAllLabel,
  availability,
  onExit,
  onToggleSelectAll,
  onQuickLog,
  onSnooze,
  onAddFavourites,
  onLogInteraction,
  onRemoveFavourites,
  onSetCategory,
  onChangeFrequency,
  onArchive,
}: BulkActionSurfaceProps) {
  const { colors } = useTheme();
  const [moreVisible, setMoreVisible] = useState(false);
  const sheetFit = useSheetFitEnvironment();
  // 38.13 D-80 (review R1-05): the bar's window rect feeds the root snackbar
  // so an Undo pill sits above it. Published only while selecting AND Home is
  // focused (as OrreryObstacle gates on focus): bulk Log Interaction opens
  // GroupLog / LogContact with selection still on, and a pill there must not
  // be lifted by a bar nobody can see. Refocusing publishes it again.
  const selectionMode = useDashboardSelectionStore((state) => state.mode);
  const focused = useIsFocused();
  const obstacle = useWindowObstacle(
    "dashboard-selection-bar",
    selectionMode && focused,
  );
  // A running write, or an action's pre-write read (A-IN-01), disables every
  // action; otherwise each follows its own applicability flag (D-40).
  // Favorite always adds and never flips (D-74).
  const busy = pending || reading;
  const enabledNow = (enabled: boolean) => enabled && !busy;

  const buttons: BarButton[] = [
    {
      id: "quick-log",
      label: "Quick Log",
      icon: "add",
      enabled: availability.canQuickLog,
      onPress: onQuickLog,
    },
    {
      id: "snooze",
      label: "Snooze",
      icon: "snooze",
      enabled: availability.canSnooze,
      onPress: onSnooze,
    },
    {
      id: "favorite",
      label: FAVORITE,
      icon: "favorite",
      enabled: availability.canAddFavorites,
      onPress: onAddFavourites,
    },
    {
      id: "more",
      label: "More…",
      icon: "overflow",
      enabled: availability.canOpenMore,
      onPress: () => setMoreVisible(true),
    },
  ];

  // D-87: the sheet keeps the rows, title and size it opened with while it
  // fades closed (as the sized Set Category sheet does, D-85 / B-WR-02), so a
  // row that a just-chosen action removes cannot shrink it mid-fade. Busy
  // state stays live.
  const openedWith = useRef({ availability, selectedCount });
  if (moreVisible) openedWith.current = { availability, selectedCount };
  const sheetAvailability = openedWith.current.availability;

  // Each row closes the sheet before it calls the host (D-75).
  const closeThen = (run: () => void) => () => {
    setMoreVisible(false);
    run();
  };
  const routineRows: SheetRow[] = [
    {
      id: "log-interaction",
      label: LOG_INTERACTION,
      icon: "call",
      enabled: sheetAvailability.canLogInteraction,
      onPress: closeThen(onLogInteraction),
    },
    // D-75: shown only when a selected Bound person is a favourite; removes
    // every selected favourite.
    ...(sheetAvailability.showRemoveFavorites
      ? [
          {
            id: "remove-favorites",
            label: `Remove from ${FAVORITES}`,
            icon: "favorite" as const,
            enabled: true,
            onPress: closeThen(onRemoveFavourites),
          },
        ]
      : []),
    {
      id: "set-category",
      label: "Set Category",
      icon: "category",
      enabled: sheetAvailability.canSetCategory,
      onPress: closeThen(onSetCategory),
    },
  ];
  // Careful (sensitive) actions stay a separate group (D-18; ADR-102).
  const carefulRows: SheetRow[] = [
    {
      id: "frequency",
      label: "Change Contact Frequency",
      icon: "frequency",
      enabled: sheetAvailability.canChangeFrequency,
      onPress: closeThen(onChangeFrequency),
    },
    {
      // "Move to Bin" is the user-facing name for archive (38.11 D-69).
      id: "archive",
      label: MOVE_TO_BIN,
      icon: "archive",
      enabled: sheetAvailability.canMoveToBin,
      onPress: closeThen(onArchive),
    },
  ];

  // D-87: sized from the rows this selection shows (Remove from Favorites
  // only when it applies), the title and the careful heading.
  const moreTitle = `${openedWith.current.selectedCount} selected`;
  const moreSectionLabel = MORE_CAREFUL_HEADING;
  const moreVariant = bulkMoreSheetVariantFor({
    ...sheetFit,
    title: moreTitle,
    rowLabels: [...routineRows, ...carefulRows].map((row) => row.label),
    sectionLabel: moreSectionLabel.toUpperCase(),
  });

  const renderRow = (row: SheetRow) => {
    const disabled = !enabledNow(row.enabled);
    return (
      <Pressable
        key={row.id}
        testID={`bulk-more-${row.id}`}
        accessibilityRole="button"
        accessibilityLabel={row.label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={row.onPress}
        style={({ pressed }) => [
          styles.sheetRow,
          {
            borderBottomColor: colors.border,
            opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <Icon name={row.icon} size="md" tone="textPrimary" />
        <Text style={[styles.sheetRowLabel, { color: colors.textPrimary }]}>
          {row.label}
        </Text>
      </Pressable>
    );
  };

  const closeMore = () => setMoreVisible(false);
  const moreSheetContent = (
    <>
      <Text
        testID="bulk-more-title"
        style={[styles.sheetTitle, { color: colors.textPrimary }]}
      >
        {moreTitle}
      </Text>
      {routineRows.map(renderRow)}
      <Text
        testID="bulk-more-careful-heading"
        accessibilityRole="header"
        style={[styles.sheetSection, { color: colors.textSecondary }]}
      >
        {moreSectionLabel}
      </Text>
      {carefulRows.map(renderRow)}
    </>
  );

  return (
    <>
      <View
        testID="dashboard-selection-bar"
        ref={obstacle.ref}
        onLayout={obstacle.onLayout}
        collapsable={false}
        style={[
          styles.bar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            testID="bulk-action-exit"
            accessibilityRole="button"
            accessibilityLabel="Exit selection"
            onPress={onExit}
            hitSlop={SPACING.xs}
            style={styles.exit}
          >
            <Icon name="close" size="md" tone="textPrimary" />
          </Pressable>
          <Text
            testID="dashboard-selection-count"
            accessibilityLiveRegion="polite"
            style={[styles.count, { color: colors.textPrimary }]}
          >
            {selectedCount} selected
          </Text>
          {pending ? (
            <Text
              testID="dashboard-selection-working"
              accessibilityLiveRegion="polite"
              style={[styles.working, { color: colors.textSecondary }]}
            >
              Working…
            </Text>
          ) : null}
          <View style={styles.headerSpacer} />
          <Pressable
            testID="dashboard-selection-select-all"
            accessibilityRole="button"
            accessibilityLabel={selectAllLabel}
            accessibilityState={{ disabled: !availability.canToggleSelectAll }}
            disabled={!availability.canToggleSelectAll}
            onPress={onToggleSelectAll}
            style={[
              styles.selectAll,
              { opacity: availability.canToggleSelectAll ? 1 : 0.5 },
            ]}
          >
            <Icon name="select-all" size="sm" tone="accentText" />
            <Text style={[styles.selectAllLabel, { color: colors.accentText }]}>
              {selectAllLabel}
            </Text>
          </Pressable>
        </View>
        <View style={styles.buttonRow}>
          {buttons.map((button) => {
            const disabled = !enabledNow(button.enabled);
            return (
              <Pressable
                key={button.id}
                testID={`bulk-action-${button.id}`}
                accessibilityRole="button"
                accessibilityLabel={button.label}
                accessibilityState={{ disabled, busy }}
                disabled={disabled}
                onPress={button.onPress}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Icon name={button.icon} size="md" tone="textPrimary" />
                <Text
                  numberOfLines={1}
                  style={[styles.buttonLabel, { color: colors.textPrimary }]}
                >
                  {button.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {moreVariant === "expanded" ? (
        <Sheet
          visible={moreVisible}
          onRequestClose={closeMore}
          variant="expanded"
        >
          {/* An expanded Sheet's body does not scroll; its consumer owns the
              scroll (Sheet.tsx). */}
          <ScrollView testID="bulk-more-scroll" style={styles.sheetScroll}>
            {moreSheetContent}
          </ScrollView>
        </Sheet>
      ) : (
        <Sheet
          visible={moreVisible}
          onRequestClose={closeMore}
          variant={moreVariant === "compact" ? "compact" : "detail"}
        >
          {moreSheetContent}
        </Sheet>
      )}
    </>
  );
}

/** The careful-group heading (drawn upper-cased). */
const MORE_CAREFUL_HEADING = "Careful actions";

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.xs,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    minHeight: 44,
  },
  exit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  count: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.heading.family,
      TYPOGRAPHY.heading.weight,
    ),
    fontSize: TYPOGRAPHY.body.size,
    lineHeight: TYPOGRAPHY.body.lineHeight,
  },
  working: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.caption.family,
      TYPOGRAPHY.caption.weight,
    ),
    fontSize: TYPOGRAPHY.caption.size,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
  },
  headerSpacer: {
    flex: 1,
  },
  selectAll: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.xs,
    minHeight: 44,
    paddingHorizontal: SPACING.xs,
  },
  selectAllLabel: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.label.family,
      TYPOGRAPHY.label.weight,
    ),
    fontSize: TYPOGRAPHY.label.size,
    lineHeight: TYPOGRAPHY.label.lineHeight,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  button: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: SPACING.xs,
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  buttonLabel: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.label.family,
      TYPOGRAPHY.label.weight,
    ),
    fontSize: TYPOGRAPHY.label.size,
    lineHeight: TYPOGRAPHY.label.lineHeight,
  },
  sheetTitle: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.heading.family,
      TYPOGRAPHY.heading.weight,
    ),
    fontSize: TYPOGRAPHY.heading.size,
    lineHeight: TYPOGRAPHY.heading.lineHeight,
    marginBottom: BULK_MORE_TITLE_GAP,
  },
  sheetSection: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.caption.family,
      TYPOGRAPHY.caption.weight,
    ),
    fontSize: TYPOGRAPHY.caption.size,
    letterSpacing: BULK_MORE_SECTION_LETTER_SPACING,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
    marginTop: BULK_MORE_SECTION_GAP,
    textTransform: "uppercase",
  },
  sheetRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: BULK_MORE_ROW_ICON_GAP,
    minHeight: BULK_MORE_ROW_MIN_HEIGHT,
  },
  sheetScroll: { flex: 1 },
  sheetRowLabel: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.body.family,
      TYPOGRAPHY.body.weight,
    ),
    fontSize: TYPOGRAPHY.body.size,
    lineHeight: TYPOGRAPHY.body.lineHeight,
    // A long label wraps inside the row at large text instead of running
    // past the sheet edge; the D-87 prediction counts the wrapped lines.
    flexShrink: 1,
  },
});
