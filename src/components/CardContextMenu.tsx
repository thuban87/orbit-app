/**
 * Presentational per-contact action sheet for Dashboard Card View. Navigation
 * and writes are deliberately supplied by the HomeScreen host.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { BaseOverlay } from "@/components/ui/overlay-base";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";

export interface CardContextMenuProps {
  visible: boolean;
  contactId: number | null;
  name: string;
  isFavourite: boolean;
  isSnoozed: boolean;
  onViewProfile: () => void;
  onQuickLog: () => void;
  onLogInteraction: () => void;
  onMessage: () => void;
  onEditContact: () => void;
  onToggleFavourite: () => void;
  onToggleSnooze: () => void;
  onSelect: () => void;
  onRequestClose: () => void;
}

interface MenuAction {
  id: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

export function CardContextMenu({
  visible,
  contactId,
  name,
  isFavourite,
  isSnoozed,
  onViewProfile,
  onQuickLog,
  onLogInteraction,
  onMessage,
  onEditContact,
  onToggleFavourite,
  onToggleSnooze,
  onSelect,
  onRequestClose,
}: CardContextMenuProps) {
  const { colors } = useTheme();
  const actions: MenuAction[] = [
    {
      id: "view-profile",
      label: "View Profile",
      icon: "dashboard",
      onPress: onViewProfile,
    },
    { id: "quick-log", label: "Quick Log", icon: "add", onPress: onQuickLog },
    {
      id: "log-interaction",
      label: "Log Interaction",
      icon: "call",
      onPress: onLogInteraction,
    },
    { id: "message", label: "Message", icon: "message", onPress: onMessage },
    {
      id: "edit-contact",
      label: "Edit Contact",
      icon: "edit",
      onPress: onEditContact,
    },
    {
      id: "favourite",
      label: isFavourite ? "Unfavorite" : "Favorite",
      icon: "favorite",
      onPress: onToggleFavourite,
    },
    {
      id: "snooze",
      label: isSnoozed ? "Unsnooze" : "Snooze",
      icon: "snooze",
      onPress: onToggleSnooze,
    },
    { id: "select", label: "Select", icon: "select", onPress: onSelect },
  ];

  return (
    <BaseOverlay
      visible={visible}
      onRequestClose={onRequestClose}
      justify="flex-end"
      dismissable
      scrimAccessibilityLabel="Dismiss contact actions"
    >
      <SafeAreaView
        edges={["bottom"]}
        style={[
          styles.sheet,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}
      >
        <Text
          testID={contactId === null ? undefined : `card-context-menu-title-${contactId}`}
          numberOfLines={1}
          style={[styles.title, { color: colors.textSecondary }]}
        >
          {name}
        </Text>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            testID={`card-context-menu-${action.id}`}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              action.onPress();
              onRequestClose();
            }}
            style={[styles.action, { borderColor: colors.border }]}
          >
            <Icon name={action.icon} size="md" tone="textPrimary" />
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </SafeAreaView>
    </BaseOverlay>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  title: {
    fontFamily: TYPOGRAPHY.label.family,
    fontSize: TYPOGRAPHY.label.size,
    marginBottom: SPACING.sm,
  },
  action: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
    paddingVertical: SPACING.sm,
  },
  label: {
    fontFamily: TYPOGRAPHY.body.family,
    fontSize: TYPOGRAPHY.body.size,
  },
});
