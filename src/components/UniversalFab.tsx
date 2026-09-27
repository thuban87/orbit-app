import * as Haptics from "expo-haptics";
import {
  type ComponentRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  PostLogNoteEditor,
  type PostLogNoteTarget,
} from "@/components/PostLogNoteEditor";
import {
  createQuickLogUndoController,
  type DialFocusLinks,
  dialFocusCycle,
  FAB_DIAL_TRANSIENT_ID,
  type FabContext,
  getFocusedContactContext,
  resolveFabContactContext,
  resolveFabTarget,
  UNIVERSAL_FAB_ACTIONS,
  type UniversalFabAction,
} from "@/components/universal-fab-logic";
import { getAppSettings } from "@/db/app-settings-dao";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { deleteTouchpoint, recordTouchpoint } from "@/db/recency-dao";
import { newUid } from "@/db/uid";
import { isFocusedWorkflow } from "@/navigation/focused-route-classification";
import { navigationRef } from "@/navigation/linking";
import { navigateIntoTab } from "@/navigation/tab-entry";
import { FAB_EDGE_GAP, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import { useWindowObstacle } from "@/navigation/use-window-measurement";
import { runQuickLog } from "@/services/quick-log-command";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useMeasuredTabBarHeight } from "@/stores/tab-bar-layout-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const LOG_SCOPE = "universal-fab";
const DIAL_ANIMATION_DURATION = 180;
const DIAL_ROW_SPACING = 60;
const DIAL_FIRST_ROW_OFFSET = 68;
const ACTION_ACCESSIBILITY_LABELS: Record<
  UniversalFabAction["id"],
  { accessibilityLabel: string }
> = {
  AddContact: { accessibilityLabel: "Add Contact" },
  QuickLog: { accessibilityLabel: "Quick Log" },
  LogContact: { accessibilityLabel: "Log Interaction" },
  GroupLog: { accessibilityLabel: "Group Log" },
  UpdateContact: { accessibilityLabel: "Update Contact" },
  Memory: { accessibilityLabel: "Memory" },
};

type PickerFlow =
  | { kind: "quick-log" }
  | { kind: "navigate"; screen: "LogContact" | "UpdateContact" | "Memory" };

type DialRowInstance = ComponentRef<typeof AnimatedPressable>;

function UniversalFabActionRow({
  action,
  index,
  expanded,
  open,
  pointerEvents,
  bottomOffset,
  focusLinks,
  rowRef,
  onPress,
}: {
  action: UniversalFabAction;
  index: number;
  expanded: SharedValue<number>;
  open: boolean;
  pointerEvents: "auto" | "none";
  bottomOffset: number;
  focusLinks: DialFocusLinks | undefined;
  rowRef: (instance: DialRowInstance | null) => void;
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
      // RG-039 (ui-accessibility/AUD-UIA-023): a collapsed row was a native
      // keyboard focus stop that ENTER could invoke; pointerEvents gates touch
      // only. On Android `focusable={false}` drops the click listener and
      // `accessible={false}` clears native focusability.
      accessible={open}
      focusable={open}
      // D-31: while open, keyboard TAB / D-pad stays in the dial's own cycle
      // (importantForAccessibility does not move Android keyboard focus).
      // Closed, every link is unset, so the RG-039 closed state is untouched.
      nextFocusForward={open ? focusLinks?.nextFocusForward : undefined}
      nextFocusUp={open ? focusLinks?.nextFocusUp : undefined}
      nextFocusDown={open ? focusLinks?.nextFocusDown : undefined}
      pointerEvents={pointerEvents}
      ref={rowRef}
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
  const isOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [currentRouteName, setCurrentRouteName] = useState("Home");
  const [pickerFlow, setPickerFlow] = useState<PickerFlow | null>(null);
  const [postLogTarget, setPostLogTarget] = useState<PostLogNoteTarget | null>(
    null,
  );
  const expanded = useSharedValue(0);
  const quickLogPending = useRef(false);
  const quickLogUndoController = useRef(
    createQuickLogUndoController(({ contactId, interactionId }) =>
      deleteTouchpoint(getExecutor(), {
        contactId,
        interactionId,
        now: localDateTime(),
      }),
    ),
  );
  const bottomOffset = tabBarHeight + FAB_EDGE_GAP;
  const hidden = keyboardOpen || isFocusedWorkflow(currentRouteName);
  const fabMeasurement = useWindowObstacle("shell-fab", !hidden, bottomOffset);
  const fabRef = fabMeasurement.ref;
  const rowRefs = useRef<(DialRowInstance | null)[]>([]);
  // Native view tags for the open dial's keyboard focus cycle (D-31). Resolved
  // once per open, after layout, never per frame.
  const [focusTags, setFocusTags] = useState<{
    fab: number | null;
    rows: (number | null)[];
  }>({ fab: null, rows: [] });
  const focusCycle = dialFocusCycle(focusTags.fab, focusTags.rows);

  const resolveDialFocusTags = useCallback(() => {
    setFocusTags({
      fab: findNodeHandle(fabRef.current),
      rows: UNIVERSAL_FAB_ACTIONS.map((_, index) =>
        findNodeHandle(rowRefs.current[index] ?? null),
      ),
    });
  }, [fabRef]);

  const restoreFabFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const node = findNodeHandle(fabRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, [fabRef]);

  const closeDial = useCallback(
    (restoreFocusAfterClose = true) => {
      if (!isOpenRef.current) return;
      isOpenRef.current = false;
      expanded.value = withTiming(0, { duration: DIAL_ANIMATION_DURATION });
      setOpen(false);
      shellTransientStore.getState().closeTransient(FAB_DIAL_TRANSIENT_ID);
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
    shellTransientStore
      .getState()
      .openTransient(FAB_DIAL_TRANSIENT_ID, closeDial);
    AccessibilityInfo.announceForAccessibility("Capture actions open");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // The rows are mounted; resolve their tags after this frame's layout.
    requestAnimationFrame(() => {
      if (isOpenRef.current) resolveDialFocusTags();
    });
  }, [closeDial, expanded, resolveDialFocusTags]);

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

  useEffect(() => {
    if (hidden) closeDial();
  }, [closeDial, hidden]);

  const logContact = useCallback((contactId: number) => {
    runQuickLog(
      {
        pendingRef: quickLogPending,
        undoController: quickLogUndoController.current,
        recordTouchpoint: (input) => recordTouchpoint(getExecutor(), input),
        readChannelPreference: async () => {
          // Same app-settings read as the detailed Log Interaction screen; a
          // read failure falls back to Message so the immediate write is never
          // blocked (local-first, no network on this read path).
          try {
            const s = await getAppSettings(getExecutor());
            return {
              pref: s.defaultInteractionChannel,
              remembered: s.rememberedInteractionChannel,
            };
          } catch (error) {
            Logger.error(LOG_SCOPE, "failed to read channel preference", error);
            return { pref: "Message", remembered: null };
          }
        },
        localDateTime,
        newUid,
        showSnackbar,
        notifySuccessHaptic: () =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        notifyWidgetDataChanged,
        bumpShellRefresh,
        openPostLogEditor: setPostLogTarget,
      },
      contactId,
    );
  }, []);

  const selectPickerContact = useCallback(
    (contactId: number) => {
      const flow = pickerFlow;
      setPickerFlow(null);
      if (!flow) return;
      if (flow.kind === "quick-log") {
        logContact(contactId);
        return;
      }
      navigateIntoTab(navigationRef.current, "DashboardTab", flow.screen, {
        contactId,
      });
    },
    [logContact, pickerFlow],
  );

  // One action at a time while the context read below settles.
  const dispatchPending = useRef(false);
  const dispatchAction = useCallback(
    async (action: UniversalFabAction) => {
      if (dispatchPending.current) return;
      dispatchPending.current = true;
      let context: FabContext;
      try {
        // Owner ruling D-29 (review A-WR-07): an archived focused Profile is
        // never FAB context — it falls back to the picker flows.
        context = await resolveFabContactContext(
          getFocusedContactContext(navigationRef.current?.getRootState()),
          async (contactId) => {
            const header = await getContactHeader(getExecutor(), contactId);
            return header ? { archived: header.archived_at !== null } : null;
          },
        );
      } finally {
        dispatchPending.current = false;
      }
      const intent = resolveFabTarget(action.id, context);
      const opensPicker =
        intent.kind === "pick-then" ||
        (intent.kind === "quick-log" && intent.contactId === null);
      // Modal accessibility owns focus for picker flows; restoring focus to the
      // now-covered FAB would pull assistive tech out of the modal surface.
      closeDial(!opensPicker);

      if (intent.kind === "navigate") {
        navigateIntoTab(
          navigationRef.current,
          intent.tab,
          intent.screen,
          intent.params,
        );
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

  const picker = (
    <ContactPicker
      visible={pickerFlow !== null}
      onDismiss={() => setPickerFlow(null)}
      onSelect={selectPickerContact}
    />
  );

  // Stays mounted alongside the picker so a Quick Log fired from the FAB can
  // open the post-log editor even while the FAB overlay is hidden.
  const postLogEditor = (
    <PostLogNoteEditor
      target={postLogTarget}
      onClose={() => setPostLogTarget(null)}
    />
  );

  // The picker owns a TextInput. It must stay mounted while that input opens
  // the keyboard; hiding the FAB overlay must not also unmount the modal.
  if (hidden)
    return (
      <>
        {picker}
        {postLogEditor}
      </>
    );

  return (
    <>
      {picker}
      {postLogEditor}
      <View pointerEvents="box-none" style={styles.overlay}>
        <AnimatedPressable
          accessibilityLabel="Dismiss capture actions"
          // RG-039: while closed (and closing — `open` flips at the start of
          // closeDial) the scrim is out of the accessibility tree and keyboard focus.
          importantForAccessibility={open ? "auto" : "no-hide-descendants"}
          accessibilityElementsHidden={!open}
          accessible={open}
          focusable={open}
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
          importantForAccessibility={open ? "auto" : "no-hide-descendants"}
          accessibilityElementsHidden={!open}
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
              open={open}
              focusLinks={focusCycle.rows[index]}
              rowRef={(instance) => {
                rowRefs.current[index] = instance;
              }}
              onPress={() => void dispatchAction(action)}
              pointerEvents={scrimPointerEvents}
            />
          ))}
        </View>
        <Pressable
          ref={fabRef}
          onLayout={fabMeasurement.onLayout}
          testID="dashboard-create-fab"
          accessibilityRole="button"
          accessibilityLabel="Add / capture"
          accessibilityState={{ expanded: open }}
          // D-31: the FAB opens and closes the dial's keyboard focus cycle.
          nextFocusForward={open ? focusCycle.fab.nextFocusForward : undefined}
          nextFocusUp={open ? focusCycle.fab.nextFocusUp : undefined}
          nextFocusDown={open ? focusCycle.fab.nextFocusDown : undefined}
          onPress={() => (isOpenRef.current ? closeDial() : openDial())}
          style={[
            styles.base,
            { bottom: bottomOffset, backgroundColor: colors.accent },
          ]}
        >
          <Animated.Text
            style={[styles.glyph, glyphStyle, { color: colors.onAccent }]}
          >
            +
          </Animated.Text>
        </Pressable>
      </View>
    </>
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
