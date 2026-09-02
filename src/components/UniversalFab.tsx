import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { speedDialScrimPointerEvents } from "@/components/add-speed-dial-fab-logic";
import {
  getFocusedContactContext,
  resolveFabTarget,
  UNIVERSAL_FAB_ACTIONS,
  type UniversalFabAction,
} from "@/components/universal-fab-logic";
import { isFocusedWorkflow } from "@/navigation/focused-route-classification";
import { navigationRef } from "@/navigation/linking";
import { FAB_EDGE_GAP, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useMeasuredTabBarHeight } from "@/stores/tab-bar-layout-store";
import { useTheme } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DIAL_ID = "fab-speed-dial";
const DIAL_ANIMATION_DURATION = 180;
const DIAL_ROW_SPACING = 60;
const DIAL_FIRST_ROW_OFFSET = 68;
const ACTION_ACCESSIBILITY_LABELS: Record<
  UniversalFabAction["id"],
  { accessibilityLabel: string }
> = {
  AddContact: { accessibilityLabel: "Add Contact" },
  QuickLog: { accessibilityLabel: "Quick Log" },
  LogContact: { accessibilityLabel: "Log Contact" },
  GroupLog: { accessibilityLabel: "Group Log" },
  UpdateContact: { accessibilityLabel: "Update Contact" },
  Memory: { accessibilityLabel: "Memory" },
};

function UniversalFabActionRow({
  action,
  index,
  expanded,
  pointerEvents,
  bottomOffset,
  onPress,
}: {
  action: UniversalFabAction;
  index: number;
  expanded: SharedValue<number>;
  pointerEvents: "auto" | "none";
  bottomOffset: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: expanded.value,
    transform: [
      {
        translateY:
          -(DIAL_FIRST_ROW_OFFSET + index * DIAL_ROW_SPACING) * expanded.value,
      },
    ],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={
        ACTION_ACCESSIBILITY_LABELS[action.id].accessibilityLabel
      }
      pointerEvents={pointerEvents}
      onPress={onPress}
      style={[
        styles.option,
        animatedStyle,
        {
          bottom: bottomOffset,
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
        {action.label}
      </Text>
    </AnimatedPressable>
  );
}

/**
 * The shell's single capture control. It intentionally mounts beside the tab
 * navigator so every action dispatches through the root tab navigation ref.
 */
export function UniversalFab() {
  const { colors } = useTheme();
  const tabBarHeight = useMeasuredTabBarHeight();
  const fabRef = useRef<View>(null);
  const isOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [currentRouteName, setCurrentRouteName] = useState("Home");
  const expanded = useSharedValue(0);
  const bottomOffset = tabBarHeight + FAB_EDGE_GAP;

  const restoreFabFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const node = findNodeHandle(fabRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, []);

  const closeDial = useCallback(() => {
    if (!isOpenRef.current) return;
    isOpenRef.current = false;
    expanded.value = withTiming(0, { duration: DIAL_ANIMATION_DURATION });
    setOpen(false);
    shellTransientStore.getState().closeTransient(DIAL_ID);
    AccessibilityInfo.announceForAccessibility("Capture actions closed");
    restoreFabFocus();
  }, [expanded, restoreFabFocus]);

  const openDial = useCallback(() => {
    if (isOpenRef.current) return;
    isOpenRef.current = true;
    expanded.value = withTiming(1, { duration: DIAL_ANIMATION_DURATION });
    setOpen(true);
    shellTransientStore.getState().openTransient(DIAL_ID, closeDial);
    AccessibilityInfo.announceForAccessibility("Capture actions open");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [closeDial, expanded]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const updateCurrentRoute = () => {
      setCurrentRouteName(
        navigationRef.current?.getCurrentRoute()?.name ?? "Home",
      );
    };

    updateCurrentRoute();
    return navigationRef.current?.addListener("state", updateCurrentRoute);
  }, []);

  const hidden = keyboardOpen || isFocusedWorkflow(currentRouteName);

  useEffect(() => {
    if (hidden) closeDial();
  }, [closeDial, hidden]);

  const dispatchAction = useCallback(
    (action: UniversalFabAction) => {
      const intent = resolveFabTarget(
        action.id,
        getFocusedContactContext(navigationRef.current?.getRootState()),
      );
      closeDial();

      if (intent.kind === "navigate") {
        navigationRef.current?.navigate(intent.tab, {
          screen: intent.screen,
          params: intent.params,
        } as never);
      }
      // Plan 06 attaches the shared ContactPicker and the transactional Quick
      // Log flow to these explicit intents. Keeping the seam here avoids a
      // shell-level route walk or a second ad-hoc picker.
    },
    [closeDial],
  );

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expanded.value * 45}deg` }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: expanded.value }));
  const scrimPointerEvents = speedDialScrimPointerEvents(open);

  if (hidden) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <AnimatedPressable
        accessibilityLabel="Dismiss capture actions"
        onPress={closeDial}
        pointerEvents={scrimPointerEvents}
        style={[
          styles.scrim,
          scrimStyle,
          { backgroundColor: colors.background },
        ]}
      />
      <View
        accessibilityViewIsModal
        pointerEvents="box-none"
        style={styles.dial}
      >
        {UNIVERSAL_FAB_ACTIONS.map((action, index) => (
          <UniversalFabActionRow
            action={action}
            bottomOffset={bottomOffset}
            expanded={expanded}
            index={index}
            key={action.id}
            onPress={() => dispatchAction(action)}
            pointerEvents={scrimPointerEvents}
          />
        ))}
      </View>
      <Pressable
        ref={fabRef}
        testID="dashboard-create-fab"
        accessibilityRole="button"
        accessibilityLabel="Add / capture"
        onPress={() => (isOpenRef.current ? closeDial() : openDial())}
        style={[
          styles.base,
          { bottom: bottomOffset, backgroundColor: colors.accent },
        ]}
      >
        <Animated.Text
          style={[styles.glyph, glyphStyle, { color: colors.background }]}
        >
          +
        </Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill },
  scrim: { ...StyleSheet.absoluteFill, opacity: 0.85 },
  dial: { ...StyleSheet.absoluteFill },
  base: {
    position: "absolute",
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  glyph: { fontSize: 32, lineHeight: 34, fontWeight: "600" },
  option: {
    position: "absolute",
    right: 20,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    elevation: 5,
  },
  optionLabel: { fontWeight: "600" },
});
