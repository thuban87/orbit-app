// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography variant.
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icons/Icon";
import {
  ROOT_SNACKBAR_HOST,
  resolveSnackbarHostVisible,
  snackbarLayout,
  snackbarPadding,
  snackbarPresentation,
} from "@/components/snackbar-host";
import { AppText } from "@/components/ui/AppText";
import {
  fabDialBackgroundA11y,
  selectFabDialOpen,
} from "@/components/universal-fab-logic";
import {
  overlayRegistryStore,
  selectTopOverlayId,
} from "@/stores/overlay-registry-store";
import {
  selectSectionFabPresent,
  useSectionFabStore,
} from "@/stores/section-fab-store";
import { useShellObstacleStore } from "@/stores/shell-obstacle-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { snackbarStore } from "@/stores/snackbar-store";
import { useMeasuredTabBarHeight } from "@/stores/tab-bar-layout-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

export interface SnackbarProps {
  /**
   * Which window this host lives in (38.9 D-40): "root" (default) for the
   * App.tsx host, or the overlay registry id of the overlay window rendering
   * it. Only the topmost window's host renders (`snackbar-host.ts`).
   */
  host?: string;
}

/**
 * Commit-truthful feedback. One snackbar message (snackbar-store), many hosts:
 * the App.tsx root host above every shell browse surface, plus one inside every
 * overlay window, so a snackbar fired while a sheet or dialog is open renders
 * inside that topmost window instead of under it (D-40). Inside an overlay it
 * sits just above the system navigation bar, without the tab-bar/+ clearance
 * (D-51).
 */
export function Snackbar({ host = ROOT_SNACKBAR_HOST }: SnackbarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const snackbar = snackbarStore((state) => state.snackbar);
  const dismiss = snackbarStore((state) => state.dismiss);
  const topOverlayId = overlayRegistryStore(selectTopOverlayId);
  // Hidden from accessibility, and from touch, while the FAB dial is open
  // (D-31, D-42 A).
  const fabDialOpen = shellTransientStore(selectFabDialOpen);
  const hostVisible = resolveSnackbarHostVisible(host, topOverlayId);
  // D-143: with a FAB on screen the root pill is full width, just above the
  // FAB row. UniversalFab publishes its "shell-fab" rect only while it shows;
  // a section FAB registers only while it shows (section-fab-store).
  const windowWidth = useWindowDimensions().width;
  const tabBarHeight = useMeasuredTabBarHeight();
  const universalFab = useShellObstacleStore(
    (s) => s.rects["shell-fab"] !== undefined,
  );
  const sectionFab = useSectionFabStore(selectSectionFabPresent);

  if (!snackbar || !hostVisible) return null;
  // D-132: a notice is an accent pill and a destructive result the warning
  // pill; D-140: an error is the warning pill too, announced assertively as
  // an alert (D-72).
  const look = snackbarPresentation(snackbar.kind);
  const actionColor = colors[look.actionTone];
  const layout = snackbarLayout({
    host,
    windowWidth,
    universalFab,
    sectionFab,
    tabBarHeight,
    insetBottom: insets.bottom,
  });
  const hasAction = Boolean(snackbar.action || snackbar.secondaryAction);

  return (
    <View
      // G2 (38.4 D-33): a permanent native view, so toggling the dial's a11y
      // props never flattens and re-creates this full-screen overlay without
      // its `box-none` (a re-created view defaults to `auto` = touch sink).
      collapsable={false}
      // D-143 puts the root pill over the open dial's rows (it renders after
      // UniversalFab in App.tsx), so while the dial is open the whole host is
      // touch-transparent: a tap on "Add Contact" must reach the dial, never
      // the pill's Undo. The pill stays where it is (its look is unchanged).
      pointerEvents={fabDialOpen ? "none" : "box-none"}
      style={[
        styles.overlay,
        {
          alignItems: layout.alignItems,
          paddingBottom: layout.paddingBottom,
        },
      ]}
      {...fabDialBackgroundA11y(fabDialOpen)}
    >
      <View
        accessibilityLiveRegion={look.liveRegion}
        accessibilityRole={look.accessibilityRole}
        style={[
          styles.surface,
          snackbarPadding(hasAction),
          {
            backgroundColor: colors[look.fillTone],
            borderColor: colors[look.borderTone],
            width: layout.width,
          },
        ]}
      >
        {look.glyphTone ? (
          // Decorative: the label (and an error's alert role) carry the meaning.
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={styles.glyph}
          >
            <Icon name="warning" tone={look.glyphTone} size="sm" />
          </View>
        ) : null}
        <AppText
          role="caption"
          style={[styles.label, { color: colors[look.labelTone] }]}
        >
          {snackbar.label}
        </AppText>
        {snackbar.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={snackbar.action.accessibilityLabel}
            onPress={() => {
              const action = snackbar.action;
              dismiss();
              action?.onPress();
            }}
            style={styles.action}
          >
            <AppText role="label" style={{ color: actionColor }}>
              {snackbar.action.label}
            </AppText>
          </Pressable>
        ) : null}
        {snackbar.secondaryAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={snackbar.secondaryAction.accessibilityLabel}
            onPress={() => {
              dismiss();
              snackbar.secondaryAction?.onPress();
            }}
            style={styles.action}
          >
            <AppText role="label" style={{ color: actionColor }}>
              {snackbar.secondaryAction.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.base,
  },
  surface: {
    alignItems: "center",
    borderRadius: RADII.pill,
    borderWidth: 1,
    flexDirection: "row",
    maxWidth: "100%",
    minHeight: 48,
    // D-143: with the label's own padding, the text sits SPACING.base from
    // the top and bottom walls, matching its side inset.
    paddingVertical: SPACING.xs,
  },
  glyph: {
    marginRight: SPACING.sm,
  },
  // Grows to fill a fixed-width pill (actions sit at its right end) and
  // shrinks to wrap onto more lines (D-132: taller is fine). D-143: vertical
  // padding so wrapped text is not cramped against the pill's walls.
  label: {
    flexGrow: 1,
    flexShrink: 1,
    paddingVertical: SPACING.md,
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: SPACING.md,
  },
});
