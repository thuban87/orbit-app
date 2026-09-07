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
import { AppText } from "@/components/ui/AppText";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { CameraPose, CameraViewport } from "@/logic/orrery-camera-logic";
import { useWindowObstacle } from "@/navigation/use-window-measurement";
import { SPACING } from "@/theme/tokens/spacing";
import {
  cameraControlState,
  controlsRegion,
  northOrientation,
} from "./orrery-obstacle-logic";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
}
export function OrreryControls({
  viewport,
  measured,
  blocked,
  pose,
  onContacts,
  onRecenter,
  onResetNorth,
}: OrreryControlsProps) {
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
      <GlassSurface density="dense">
        <ScrollView
          style={region ? { maxHeight: region.height - 2 } : undefined}
          contentContainerStyle={styles.stack}
        >
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
            <AppText role="label" style={styles.label}>
              Contacts in this System
            </AppText>
          </Pressable>
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
            <AppText role="label" style={styles.label}>
              Recenter
            </AppText>
          </Pressable>
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
            <AppText role="label" style={styles.label}>
              Reset north
            </AppText>
          </AnimatedPressable>
        </ScrollView>
      </GlassSurface>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { position: "absolute", zIndex: 12, elevation: 12 },
  unmeasured: { right: SPACING.base, bottom: SPACING.base, maxWidth: "90%" },
  stack: { gap: SPACING.sm },
  control: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  label: { flexShrink: 1 },
});
