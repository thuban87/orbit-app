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
import { ContactPicker } from "@/components/ContactPicker";
import {
  getFocusedContactContext,
  resolveFabTarget,
  UNIVERSAL_FAB_ACTIONS,
  type UniversalFabAction,
} from "@/components/universal-fab-logic";
import { getExecutor, localDateTime } from "@/db/database";
import { deleteTouchpoint, recordTouchpoint } from "@/db/recency-dao";
import { newUid } from "@/db/uid";
import { isFocusedWorkflow } from "@/navigation/focused-route-classification";
import { navigationRef } from "@/navigation/linking";
import { FAB_EDGE_GAP, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { showSnackbar } from "@/stores/snackbar-store";
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

type PickerFlow =
  | { kind: "quick-log" }
  | { kind: "navigate"; screen: "LogContact" | "UpdateContact" | "Memory" };

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
  const [pickerFlow, setPickerFlow] = useState<PickerFlow | null>(null);
  const expanded = useSharedValue(0);
  const quickLogPending = useRef(false);
  const undoPending = useRef(false);
  const bottomOffset = tabBarHeight + FAB_EDGE_GAP;

  const restoreFabFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const node = findNodeHandle(fabRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, []);

  const closeDial = useCallback(
    (restoreFocusAfterClose = true) => {
      if (!isOpenRef.current) return;
      isOpenRef.current = false;
      expanded.value = withTiming(0, { duration: DIAL_ANIMATION_DURATION });
      setOpen(false);
      shellTransientStore.getState().closeTransient(DIAL_ID);
      AccessibilityInfo.announceForAccessibility("Capture actions closed");
      if (restoreFocusAfterClose) restoreFabFocus();
    },
    [expanded, restoreFabFocus],
  );

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

  const undoQuickLog = useCallback(
    (contactId: number, interactionId: number) => {
      if (undoPending.current) return;
      undoPending.current = true;

      void deleteTouchpoint(getExecutor(), {
        contactId,
        interactionId,
        now: localDateTime(),
      })
        .then(() => {
          // deleteTouchpoint recomputes recency but does not publish a data
          // revision, so shell consumers and the widget need this explicit tick.
          notifyWidgetDataChanged();
          bumpShellRefresh();
        })
        .catch(() => {
          showSnackbar({
            kind: "error",
            label: "Couldn't undo",
            action: {
              label: "Retry",
              accessibilityLabel: "Retry undoing logged interaction",
              onPress: () => undoQuickLog(contactId, interactionId),
            },
          });
        })
        .finally(() => {
          undoPending.current = false;
        });
    },
    [],
  );

  const logContact = useCallback(
    (contactId: number) => {
      if (quickLogPending.current) return;
      quickLogPending.current = true;
      const stamp = localDateTime();

      void recordTouchpoint(getExecutor(), {
        contactId,
        uid: newUid(),
        occurredAt: stamp,
        now: stamp,
        channel: "unspecified",
        direction: "outbound",
        connected: 1,
        quality: null,
        source: "manual",
      })
        .then(({ interactionId }) => {
          showSnackbar({
            kind: "success",
            label: "Logged",
            action: {
              label: "Undo",
              accessibilityLabel: "Undo logged interaction",
              onPress: () => undoQuickLog(contactId, interactionId),
            },
          });
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          notifyWidgetDataChanged();
          bumpShellRefresh();
        })
        .catch(() => {
          // A failed write is ordinary error feedback, not a destructive action:
          // the shell haptic taxonomy deliberately reserves warning haptics.
          showSnackbar({
            kind: "error",
            label: "Couldn't log",
            action: {
              label: "Retry",
              accessibilityLabel: "Retry logging contact",
              onPress: () => logContact(contactId),
            },
          });
        })
        .finally(() => {
          quickLogPending.current = false;
        });
    },
    [undoQuickLog],
  );

  const selectPickerContact = useCallback(
    (contactId: number) => {
      const flow = pickerFlow;
      setPickerFlow(null);
      if (!flow) return;
      if (flow.kind === "quick-log") {
        logContact(contactId);
        return;
      }
      navigationRef.current?.navigate("DashboardTab", {
        screen: flow.screen,
        params: { contactId },
      } as never);
    },
    [logContact, pickerFlow],
  );

  const dispatchAction = useCallback(
    (action: UniversalFabAction) => {
      const intent = resolveFabTarget(
        action.id,
        getFocusedContactContext(navigationRef.current?.getRootState()),
      );
      const opensPicker =
        intent.kind === "pick-then" ||
        (intent.kind === "quick-log" && intent.contactId === null);
      // Modal accessibility owns focus for picker flows; restoring focus to the
      // now-covered FAB would pull assistive tech out of the modal surface.
      closeDial(!opensPicker);

      if (intent.kind === "navigate") {
        navigationRef.current?.navigate(intent.tab, {
          screen: intent.screen,
          params: intent.params,
        } as never);
      } else if (intent.kind === "quick-log") {
        if (intent.contactId === null) {
          setPickerFlow({ kind: "quick-log" });
        } else {
          logContact(intent.contactId);
        }
      } else {
        setPickerFlow({ kind: "navigate", screen: intent.screen });
      }
    },
    [closeDial, logContact],
  );

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expanded.value * 45}deg` }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: expanded.value }));
  const scrimPointerEvents = speedDialScrimPointerEvents(open);

  if (hidden) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <ContactPicker
        visible={pickerFlow !== null}
        onDismiss={() => setPickerFlow(null)}
        onSelect={selectPickerContact}
      />
      <AnimatedPressable
        accessibilityLabel="Dismiss capture actions"
        onPress={() => closeDial()}
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
