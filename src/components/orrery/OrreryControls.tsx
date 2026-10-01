// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses semantic typography roles.
import { useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedProps,
} from "react-native-reanimated";
import { Icon } from "@/components/icons/Icon";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { CameraPose, CameraViewport } from "@/logic/orrery-camera-logic";
import { useWindowObstacle } from "@/navigation/use-window-measurement";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { HUD_PLATE, OrreryHudCorners } from "./OrreryHudCorners";
import {
  cameraControlState,
  controlsRegion,
  northOrientation,
} from "./orrery-obstacle-logic";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const CONTROL_SIZE = 55;

export const ORRERY_CONTROLS_OBSTACLE = "orrery-camera-controls";
export interface OrreryControlsProps {
  /** Excludes this stack's own rect to avoid a measurement/placement feedback loop. */
  viewport: CameraViewport;
  measured: boolean;
  blocked: boolean;
  pose: SharedValue<CameraPose>;
  onContacts: (restoreFocus: () => void) => void;
  onRecenter: () => void;
  onResetNorth: () => void;
  /** ORRERY LAB B (WP-2.2, flag `hudChrome`): instrument HUD plates. */
  hud?: boolean;
  /** ORRERY LAB B (R3, `hudChrome` + `immersiveChrome`): one HUD rail plate
   * holding the three controls (hairline separators) instead of three
   * separate boxes. Same buttons, names, states and 55 dp targets. */
  rail?: boolean;
}
export function OrreryControls({
  viewport,
  measured,
  blocked,
  pose,
  onContacts,
  onRecenter,
  onResetNorth,
  hud = false,
  rail = false,
}: OrreryControlsProps) {
  const { colors } = useTheme();
  const surface = hud
    ? [styles.controlSurface, HUD_PLATE]
    : styles.controlSurface;
  const orientationProps = useAnimatedProps(() => ({
    accessibilityValue: {
      text: northOrientation(pose.value.yaw ?? 0, measured) ?? "",
    },
  }));
  const region = controlsRegion(viewport);
  const inputBlocked = blocked || (viewport.width > 0 && region === null);
  const state = cameraControlState(measured);
  const trigger = useRef<View>(null);
  const measurement = useWindowObstacle(
    ORRERY_CONTROLS_OBSTACLE,
    region !== null,
    `${region?.x}:${region?.y}:${region?.height}`,
  );
  const restore = () => {
    const node = findNodeHandle(trigger.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  };
  // Zero native measurement is brief; controls retain their names/disabled state in
  // normal flow until a free column is measured. Covered controls never accept input.
  return (
    <View
      ref={measurement.ref}
      collapsable={false}
      onLayout={measurement.onLayout}
      pointerEvents={inputBlocked ? "none" : "auto"}
      accessibilityElementsHidden={inputBlocked}
      importantForAccessibility={inputBlocked ? "no-hide-descendants" : "auto"}
      style={[
        styles.root,
        region
          ? {
              left: region.x,
              bottom: viewport.height - region.y - region.height,
              width: region.width,
              maxHeight: region.height,
            }
          : styles.unmeasured,
      ]}
    >
      <ScrollView
        style={region ? { maxHeight: region.height - 2 } : undefined}
        contentContainerStyle={styles.stack}
      >
        {hud && rail ? (
          <GlassSurface
            density="dense"
            treatment="orrery-overlay"
            style={[styles.rail, HUD_PLATE]}
          >
            <OrreryHudCorners />
            <Pressable
              ref={trigger}
              style={styles.control}
              accessibilityRole="button"
              accessibilityLabel="Contacts in this System"
              disabled={inputBlocked || state.contactsDisabled}
              accessibilityState={{
                disabled: inputBlocked || state.contactsDisabled,
              }}
              onPress={() => onContacts(restore)}
            >
              <Icon name="list" size="md" />
            </Pressable>
            <View
              style={[styles.railRule, { backgroundColor: colors.border }]}
            />
            <Pressable
              style={styles.control}
              accessibilityRole="button"
              accessibilityLabel="Recenter Orrery"
              disabled={inputBlocked || state.recenterDisabled}
              accessibilityState={{
                disabled: inputBlocked || state.recenterDisabled,
              }}
              onPress={onRecenter}
            >
              <Icon name="recenter" size="md" />
            </Pressable>
            <View
              style={[styles.railRule, { backgroundColor: colors.border }]}
            />
            <AnimatedPressable
              style={styles.control}
              accessibilityRole="button"
              accessibilityLabel="Reset north"
              disabled={inputBlocked || state.northDisabled}
              accessibilityState={{
                disabled: inputBlocked || state.northDisabled,
              }}
              animatedProps={orientationProps}
              onPress={onResetNorth}
            >
              <Icon name="north" size="md" />
            </AnimatedPressable>
          </GlassSurface>
        ) : (
          [
            <GlassSurface
              key="contacts"
              density="dense"
              treatment="orrery-overlay"
              style={surface}
            >
              {hud ? <OrreryHudCorners /> : null}
              <Pressable
                ref={trigger}
                style={styles.control}
                accessibilityRole="button"
                accessibilityLabel="Contacts in this System"
                disabled={inputBlocked || state.contactsDisabled}
                accessibilityState={{
                  disabled: inputBlocked || state.contactsDisabled,
                }}
                onPress={() => onContacts(restore)}
              >
                <Icon name="list" size="md" />
              </Pressable>
            </GlassSurface>,
            <GlassSurface
              key="recenter"
              density="dense"
              treatment="orrery-overlay"
              style={surface}
            >
              {hud ? <OrreryHudCorners /> : null}
              <Pressable
                style={styles.control}
                accessibilityRole="button"
                accessibilityLabel="Recenter Orrery"
                disabled={inputBlocked || state.recenterDisabled}
                accessibilityState={{
                  disabled: inputBlocked || state.recenterDisabled,
                }}
                onPress={onRecenter}
              >
                <Icon name="recenter" size="md" />
              </Pressable>
            </GlassSurface>,
            <GlassSurface
              key="north"
              density="dense"
              treatment="orrery-overlay"
              style={surface}
            >
              {hud ? <OrreryHudCorners /> : null}
              <AnimatedPressable
                style={styles.control}
                accessibilityRole="button"
                accessibilityLabel="Reset north"
                disabled={inputBlocked || state.northDisabled}
                accessibilityState={{
                  disabled: inputBlocked || state.northDisabled,
                }}
                animatedProps={orientationProps}
                onPress={onResetNorth}
              >
                <Icon name="north" size="md" />
              </AnimatedPressable>
            </GlassSurface>,
          ]
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { position: "absolute", zIndex: 12, elevation: 12 },
  unmeasured: { right: SPACING.base, bottom: SPACING.base, maxWidth: "90%" },
  // The region is a deliberately wide free column so it can avoid measured
  // obstacles. Pin the 55px controls to its right edge, directly above the FAB.
  stack: { gap: SPACING.xs, alignItems: "flex-end" },
  controlSurface: { width: CONTROL_SIZE, height: CONTROL_SIZE },
  rail: { width: CONTROL_SIZE },
  railRule: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: SPACING.sm,
  },
  control: {
    minWidth: CONTROL_SIZE,
    minHeight: CONTROL_SIZE,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.sm,
  },
});
