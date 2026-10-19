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
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { Sheet } from "@/components/ui/Sheet";
import {
  FAVORITE,
  FAVORITES,
  LOG_INTERACTION,
  MOVE_TO_BIN,
} from "@/constants/glossary";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { resolveFontFamily, TYPOGRAPHY } from "@/theme/tokens/typography";

export interface BulkActionSurfaceProps {
  selectedCount: number;
  /** A confirmed bulk write is running (D-41): "Working…" shows. */
  pending: boolean;
  /** "Select All" or "Deselect all" (D-40). */
  selectAllLabel: string;
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
  onPress: () => void;
}

interface SheetRow {
  id: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

export function BulkActionSurface({
  selectedCount,
  pending,
  selectAllLabel,
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
  const disabled = selectedCount === 0 || pending;

  const buttons: BarButton[] = [
    { id: "quick-log", label: "Quick Log", icon: "add", onPress: onQuickLog },
    { id: "snooze", label: "Snooze", icon: "snooze", onPress: onSnooze },
    {
      id: "favorite",
      label: FAVORITE,
      icon: "favorite",
      onPress: onAddFavourites,
    },
    {
      id: "more",
      label: "More…",
      icon: "overflow",
      onPress: () => setMoreVisible(true),
    },
  ];

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
      onPress: closeThen(onLogInteraction),
    },
    {
      id: "remove-favorites",
      label: `Remove from ${FAVORITES}`,
      icon: "favorite",
      onPress: closeThen(onRemoveFavourites),
    },
    {
      id: "set-category",
      label: "Set Category",
      icon: "category",
      onPress: closeThen(onSetCategory),
    },
  ];
  // Careful (sensitive) actions stay a separate group (D-18; ADR-102).
  const carefulRows: SheetRow[] = [
    {
      id: "frequency",
      label: "Change Contact Frequency",
      icon: "frequency",
      onPress: closeThen(onChangeFrequency),
    },
    {
      // "Move to Bin" is the user-facing name for archive (38.11 D-69).
      id: "archive",
      label: MOVE_TO_BIN,
      icon: "archive",
      onPress: closeThen(onArchive),
    },
  ];

  const renderRow = (row: SheetRow) => (
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

  return (
    <>
      <View
        testID="dashboard-selection-bar"
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
            onPress={onToggleSelectAll}
            style={styles.selectAll}
          >
            <Icon name="select-all" size="sm" tone="accentText" />
            <Text style={[styles.selectAllLabel, { color: colors.accentText }]}>
              {selectAllLabel}
            </Text>
          </Pressable>
        </View>
        <View style={styles.buttonRow}>
          {buttons.map((button) => (
            <Pressable
              key={button.id}
              testID={`bulk-action-${button.id}`}
              accessibilityRole="button"
              accessibilityLabel={button.label}
              accessibilityState={{ disabled, busy: pending }}
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
          ))}
        </View>
      </View>
      <Sheet
        visible={moreVisible}
        onRequestClose={() => setMoreVisible(false)}
        variant="compact"
      >
        <Text
          testID="bulk-more-title"
          style={[styles.sheetTitle, { color: colors.textPrimary }]}
        >
          {selectedCount} selected
        </Text>
        {routineRows.map(renderRow)}
        <Text
          testID="bulk-more-careful-heading"
          accessibilityRole="header"
          style={[styles.sheetSection, { color: colors.textSecondary }]}
        >
          Careful actions
        </Text>
        {carefulRows.map(renderRow)}
      </Sheet>
    </>
  );
}

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
    marginBottom: SPACING.sm,
  },
  sheetSection: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.caption.family,
      TYPOGRAPHY.caption.weight,
    ),
    fontSize: TYPOGRAPHY.caption.size,
    letterSpacing: 1,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
    marginTop: SPACING.base,
    textTransform: "uppercase",
  },
  sheetRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: SPACING.base,
    minHeight: 52,
  },
  sheetRowLabel: {
    fontFamily: resolveFontFamily(
      TYPOGRAPHY.body.family,
      TYPOGRAPHY.body.weight,
    ),
    fontSize: TYPOGRAPHY.body.size,
    lineHeight: TYPOGRAPHY.body.lineHeight,
  },
});
