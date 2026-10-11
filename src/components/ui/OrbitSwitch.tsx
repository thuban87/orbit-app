/**
 * OrbitSwitch — the one switch in the app (38.9 D-25, D-26, D-47; owner Q-22 =
 * SW-C). It replaces every react-native `Switch`; no production file renders
 * the RN Switch (`orbit-switch-contract.test.ts`).
 *
 *   off       outlined `borderStrong` track (no fill) + small `textSecondary`
 *             thumb (D-47; the outline contrast is kept as chosen, D-62)
 *   on        `accent` track + large `onAccent` thumb with a check glyph in the
 *             `accentText` role (ADR-084 accent roles, ADR-169 accent-role
 *             contract; `accent` is a fill only — review C8-M4)
 *   disabled  dimmed and drawn Off whatever it stores (D-26), presses ignored;
 *             `accessibilityState.checked` still reports the stored value so
 *             TalkBack announces the real setting (review L3)
 *
 * Props keep RN Switch's names (`value`, `onValueChange`, `disabled`, `testID`,
 * `accessibilityLabel`) so the sweep is mechanical; `busy` is merged into the
 * accessibility state for callers that load or save (C5-M2).
 *
 * The thumb's size and position animate from a Reanimated shared value with
 * `withTiming` — never from React state (CLAUDE.md animation rule) — and jump
 * straight to the end state when the OS reduced-motion setting is on. The
 * worklet helper sits above its caller (owner memory worklet-forward-ref-hazard).
 * Every colour resolves through `useTheme()` (check:colors).
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "@/components/icons/Icon";
import { useTheme } from "@/theme";
import { MOTION } from "@/theme/tokens/motion";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import {
  resolveSwitchA11yState,
  resolveSwitchVisual,
  SWITCH_THUMB_OFF,
  SWITCH_THUMB_OFF_OFFSET,
  SWITCH_THUMB_ON,
  SWITCH_THUMB_ON_LEFT,
  SWITCH_THUMB_ON_TOP,
  SWITCH_TOUCH_TARGET,
  SWITCH_TRACK_BORDER,
  SWITCH_TRACK_HEIGHT,
  SWITCH_TRACK_WIDTH,
} from "./orbit-switch-logic";

export interface OrbitSwitchProps {
  /** The stored value. */
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  /** Loading or saving: announced as busy, never drawn. */
  busy?: boolean;
  testID?: string;
  accessibilityLabel: string;
}

/**
 * Thumb box for an animation progress in [0, 1] (0 = off, 1 = on). A worklet,
 * defined ABOVE the component that calls it (Hermes forward-ref hazard).
 */
function thumbBox(progress: number) {
  "worklet";
  const size =
    SWITCH_THUMB_OFF + (SWITCH_THUMB_ON - SWITCH_THUMB_OFF) * progress;
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    top:
      SWITCH_THUMB_OFF_OFFSET +
      (SWITCH_THUMB_ON_TOP - SWITCH_THUMB_OFF_OFFSET) * progress,
    left:
      SWITCH_THUMB_OFF_OFFSET +
      (SWITCH_THUMB_ON_LEFT - SWITCH_THUMB_OFF_OFFSET) * progress,
  };
}

/** Animated thumb geometry bound to the shared progress value. */
function useThumbStyle(progress: SharedValue<number>) {
  return useAnimatedStyle(() => thumbBox(progress.value));
}

export function OrbitSwitch({
  value,
  onValueChange,
  disabled = false,
  busy,
  testID,
  accessibilityLabel,
}: OrbitSwitchProps) {
  const { colors } = useTheme();
  const visual = resolveSwitchVisual({ value, disabled });
  const on = visual.on;
  const reducedMotion = useReducedMotionShared();
  const progress = useSharedValue(on ? 1 : 0);
  const thumbStyle = useThumbStyle(progress);

  useEffect(() => {
    const target = on ? 1 : 0;
    // Writing `.value` is not a setState: no re-render per frame.
    progress.value = reducedMotion.value
      ? target
      : withTiming(target, { duration: MOTION.fast });
  }, [on, progress, reducedMotion]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={resolveSwitchA11yState({ value, disabled, busy })}
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        onValueChange?.(!value);
      }}
      style={[styles.target, { opacity: visual.opacity }]}
    >
      <View
        style={[
          styles.track,
          {
            borderColor: on ? colors.accent : colors.borderStrong,
            backgroundColor: on ? colors.accent : undefined,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: on ? colors.onAccent : colors.textSecondary },
            thumbStyle,
          ]}
        >
          {on ? <Icon name="check" size="sm" tone="accentText" /> : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    minWidth: SWITCH_TOUCH_TARGET,
    minHeight: SWITCH_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: SWITCH_TRACK_WIDTH,
    height: SWITCH_TRACK_HEIGHT,
    borderRadius: SWITCH_TRACK_HEIGHT / 2,
    borderWidth: SWITCH_TRACK_BORDER,
  },
  thumb: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
