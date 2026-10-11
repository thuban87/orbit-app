// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography variant.
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ROOT_SNACKBAR_HOST,
  resolveSnackbarHostVisible,
  snackbarBottomPadding,
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
import { shellTransientStore } from "@/stores/shell-transient-store";
import { snackbarStore } from "@/stores/snackbar-store";
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
  // Hidden from accessibility while the FAB dial is open (D-31, D-42 A).
  const fabDialOpen = shellTransientStore(selectFabDialOpen);
  const hostVisible = resolveSnackbarHostVisible(host, topOverlayId);

  if (!snackbar || !hostVisible) return null;

  return (
    <View
      // G2 (38.4 D-33): a permanent native view, so toggling the dial's a11y
      // props never flattens and re-creates this full-screen overlay without
      // its `box-none` (a re-created view defaults to `auto` = touch sink).
      collapsable={false}
      pointerEvents="box-none"
      style={[
        styles.overlay,
        { paddingBottom: snackbarBottomPadding(host, insets.bottom) },
      ]}
      {...fabDialBackgroundA11y(fabDialOpen)}
    >
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.surface,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText role="caption" style={styles.label}>
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
            <AppText role="label" style={{ color: colors.accentText }}>
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
            <AppText role="label" style={{ color: colors.accentText }}>
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
    paddingLeft: SPACING.base,
  },
  label: {
    flexShrink: 1,
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: SPACING.md,
  },
});
