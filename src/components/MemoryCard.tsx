import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import type { MemoryRow } from "@/db/memories-read";
import {
  MEMORY_TYPE_REGISTRY,
  PROVISIONAL_MEMORY_LABEL,
} from "@/db/memory-registry";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatDisplayDateOrFallback } from "@/utils/dates";
import { Icon } from "./icons/Icon";
import { normaliseLinkUrl } from "./LinksEditor";
import { AppText } from "./ui";

export function memoryTypeLabel(memory: MemoryRow): string {
  // D-86: any memory's label wins, so a converted custom memory keeps it.
  return (
    memory.custom_label ??
    MEMORY_TYPE_REGISTRY[memory.type as keyof typeof MEMORY_TYPE_REGISTRY]
      ?.displayName ??
    PROVISIONAL_MEMORY_LABEL
  );
}

export function openMemoryLink(url: string): void {
  void Linking.openURL(normaliseLinkUrl(url)).catch(() => {});
}

export interface MemoryCardProps {
  memory: MemoryRow;
  onPress?: () => void;
  /**
   * Holds the card's press and draws it disabled (D-26: the Button.tsx
   * dimmed look), e.g. while the host's save is in flight (38.9 third fix
   * pass WR-02). The Open link stays live. Absent → false.
   */
  disabled?: boolean;
  subdued?: boolean;
  /** Long-press handler (D-107: a linked row's Edit lives here). */
  onLongPress?: () => void;
  /**
   * Overrides the fixed `Edit … memory` label, e.g. for a linked row whose tap
   * opens its interaction (D-107; checker cycle 3 W-6). Absent → unchanged.
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Host screen-reader actions (D-107 Edit / Pin / Unpin). */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  /**
   * Section editors only (D-17; enforces phase-10 §AF): a hidden row is dimmed
   * and offers a visible and a screen-reader "Show on Profile" action that
   * calls this. Absent → no action and no extra dimming.
   */
  onShowOnProfile?: () => void;
  /** Section editors only (D-84): a visible and a screen-reader "Move". */
  onMove?: () => void;
  testID?: string;
}

/** The card's own screen-reader action names. */
const SHOW_ON_PROFILE_ACTION = "showOnProfile";
const MOVE_ACTION = "move";

/** The Button.tsx disabled look (D-26 "dimmed"). */
const DISABLED_OPACITY = 0.5;

/** Compact, presentational Memory summary; detailed metadata belongs in MemoryEditor. */
export function MemoryCard({
  memory,
  onPress,
  disabled = false,
  subdued = false,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
  onShowOnProfile,
  onMove,
  testID,
}: MemoryCardProps) {
  const { colors } = useTheme();
  const canShowOnProfile = onShowOnProfile !== undefined && memory.hidden === 1;
  const dimmed = subdued || canShowOnProfile;
  const actions: AccessibilityActionInfo[] = [
    ...(accessibilityActions ?? []),
    ...(canShowOnProfile
      ? [{ name: SHOW_ON_PROFILE_ACTION, label: "Show on Profile" }]
      : []),
    ...(onMove ? [{ name: MOVE_ACTION, label: "Move" }] : []),
  ];
  const handleAction = (event: AccessibilityActionEvent) => {
    if (disabled) return;
    const name = event.nativeEvent.actionName;
    if (name === SHOW_ON_PROFILE_ACTION && canShowOnProfile) {
      onShowOnProfile?.();
      return;
    }
    if (name === MOVE_ACTION && onMove) {
      onMove();
      return;
    }
    onAccessibilityAction?.(event);
  };
  const rowActions =
    canShowOnProfile || onMove ? (
      <View style={styles.rowActions}>
        {canShowOnProfile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show on Profile"
            accessibilityState={{ disabled }}
            disabled={disabled}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onShowOnProfile?.();
            }}
            style={styles.rowAction}
          >
            <AppText role="caption" style={{ color: colors.textPrimary }}>
              Show on Profile
            </AppText>
          </Pressable>
        ) : null}
        {onMove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move"
            accessibilityState={{ disabled }}
            disabled={disabled}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onMove();
            }}
            style={styles.rowAction}
          >
            <AppText role="caption" style={{ color: colors.textPrimary }}>
              Move
            </AppText>
          </Pressable>
        ) : null}
      </View>
    ) : null;
  const content = (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: dimmed || memory.outdated === 1 ? 0.68 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <AppText role="label" style={{ color: colors.textSecondary }}>
          {memoryTypeLabel(memory)}
        </AppText>
        <View style={styles.markers}>
          {memory.pinned === 1 ? (
            <View
              accessibilityLabel="Pinned memory"
              accessible
              style={styles.marker}
            >
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Pinned
              </AppText>
            </View>
          ) : null}
          {memory.outdated === 1 ? (
            <View
              accessibilityLabel="Marked outdated"
              accessible
              style={styles.marker}
            >
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Outdated
              </AppText>
            </View>
          ) : null}
          {memory.allow_ai === 1 ? (
            <View
              accessibilityLabel="Shared with AI"
              accessible
              style={styles.marker}
            >
              <Icon name="sparkle" tone="accentText" />
            </View>
          ) : null}
        </View>
      </View>
      {memory.value ? (
        <AppText numberOfLines={2} role="body">
          {memory.value}
        </AppText>
      ) : null}
      {memory.note ? (
        <AppText
          numberOfLines={2}
          role="caption"
          style={{ color: colors.textSecondary }}
        >
          {memory.note}
        </AppText>
      ) : null}
      {memory.meaningful_date ? (
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {/* D-48 display, raw when not a date (38.9 D-65); storage unchanged. */}
          {formatDisplayDateOrFallback(
            memory.meaningful_date,
            memory.meaningful_date,
          )}
        </AppText>
      ) : null}
      {memory.url ? (
        // D-24: the URL itself, then its Open action.
        <AppText
          numberOfLines={2}
          role="caption"
          style={{ color: colors.textSecondary }}
        >
          {memory.url}
        </AppText>
      ) : null}
      {memory.url ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open memory link"
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            openMemoryLink(memory.url ?? "");
          }}
          style={styles.link}
        >
          <AppText
            numberOfLines={1}
            role="caption"
            style={{ color: colors.accentText }}
          >
            Open link
          </AppText>
        </Pressable>
      ) : null}
      {rowActions}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? `Edit ${memoryTypeLabel(memory)} memory`
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      accessibilityActions={actions.length > 0 ? actions : undefined}
      onAccessibilityAction={actions.length > 0 ? handleAction : undefined}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      style={disabled ? styles.disabled : null}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: DISABLED_OPACITY },
  card: {
    borderRadius: SPACING.md,
    borderWidth: 1,
    gap: SPACING.xs,
    padding: SPACING.base,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  link: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  marker: { justifyContent: "center", minHeight: 44, minWidth: 44 },
  rowAction: { justifyContent: "center", minHeight: 44 },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.base },
  markers: {
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: SPACING.xs,
    justifyContent: "flex-end",
  },
});
