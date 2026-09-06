/**
 * Presentational action surface for Dashboard Card View multi-select mode.
 * The host owns all writes, navigation, dialogs, pickers, and feedback; this
 * component deliberately contains only explicit, guarded action affordances.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { Sheet } from "@/components/ui/Sheet";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";

export interface BulkActionSurfaceProps {
  selectedCount: number;
  onQuickLog: () => void;
  onLogInteraction: () => void;
  onAddFavourites: () => void;
  onRemoveFavourites: () => void;
  onSnooze: () => void;
  onUnsnooze: () => void;
  onSetCategory: () => void;
  onArchive: () => void;
  onChangeFrequency: () => void;
  onExit: () => void;
}

interface BulkAction {
  id: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

export function BulkActionSurface({
  selectedCount,
  onQuickLog,
  onLogInteraction,
  onAddFavourites,
  onRemoveFavourites,
  onSnooze,
  onUnsnooze,
  onSetCategory,
  onArchive,
  onChangeFrequency,
  onExit,
}: BulkActionSurfaceProps) {
  const { colors } = useTheme();
  const [sensitiveVisible, setSensitiveVisible] = useState(false);
  const disabled = selectedCount === 0;
  const actions: BulkAction[] = [
    { id: "quick-log", label: "Quick Log", icon: "add", onPress: onQuickLog },
    {
      id: "log-interaction",
      label: "Log Interaction",
      icon: "call",
      onPress: onLogInteraction,
    },
    {
      id: "add-favorites",
      label: "Add to Favorites",
      icon: "favorite",
      onPress: onAddFavourites,
    },
    {
      id: "remove-favorites",
      label: "Remove from Favorites",
      icon: "favorite",
      onPress: onRemoveFavourites,
    },
    { id: "snooze", label: "Snooze", icon: "snooze", onPress: onSnooze },
    {
      id: "unsnooze",
      label: "Unsnooze",
      icon: "snooze",
      onPress: onUnsnooze,
    },
    {
      id: "set-category",
      label: "Set Category",
      icon: "category",
      onPress: onSetCategory,
    },
    { id: "archive", label: "Archive", icon: "archive", onPress: onArchive },
  ];

  return (
    <>
      <View testID="dashboard-selection-bulk-actions" style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            testID={`bulk-action-${action.id}`}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.action,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceElevated,
                opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Icon name={action.icon} size="sm" tone="textPrimary" />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          testID="bulk-action-sensitive-operations"
          accessibilityRole="button"
          accessibilityLabel="More sensitive operations"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => setSensitiveVisible(true)}
          style={({ pressed }) => [
            styles.action,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceElevated,
              opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Icon name="overflow" size="sm" tone="textPrimary" />
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
            More
          </Text>
        </Pressable>
        <Pressable
          testID="bulk-action-exit"
          accessibilityRole="button"
          accessibilityLabel="Exit selection"
          onPress={onExit}
          style={[styles.action, { borderColor: colors.border }]}
        >
          <Icon name="close" size="sm" tone="textPrimary" />
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Done</Text>
        </Pressable>
      </View>
      <Sheet
        visible={sensitiveVisible}
        onRequestClose={() => setSensitiveVisible(false)}
        variant="compact"
      >
        <Text style={[styles.sheetTitle, { color: colors.textSecondary }]}>
          Sensitive Operations
        </Text>
        <Pressable
          testID="bulk-sensitive-frequency"
          accessibilityRole="button"
          accessibilityLabel="Change Contact Frequency"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            setSensitiveVisible(false);
            onChangeFrequency();
          }}
          style={[styles.sensitiveAction, { borderColor: colors.border }]}
        >
          <Icon name="frequency" size="md" tone="textPrimary" />
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
            Change Contact Frequency
          </Text>
        </Pressable>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  action: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: SPACING.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
  },
  actionLabel: { fontFamily: TYPOGRAPHY.label.family, fontSize: TYPOGRAPHY.label.size },
  sheetTitle: {
    fontFamily: TYPOGRAPHY.label.family,
    fontSize: TYPOGRAPHY.label.size,
    marginBottom: SPACING.sm,
  },
  sensitiveAction: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
  },
});
