/**
 * HistoryHighlight (38.8 D-53, D-54, D-23) — the transient jump highlight on a
 * History stream day group: an accent bar down the left plus a faint accent
 * tint, both `colors.accent` from `useTheme()` (the tint through a numeric
 * opacity, never a colour literal). The bar shape means the highlight is not
 * colour-only (D-23).
 *
 * It fades over HIGHLIGHT_FADE_MS on ONE Reanimated shared value — never
 * per-frame React state. Under reduced motion it holds for the same time and
 * then disappears with no animated fade: both the timing and the delay pass
 * `ReduceMotion.Never` explicitly, because the defaults (`ReduceMotion.System`)
 * would skip the hold and drop the highlight at once. Losing focus or
 * backgrounding ends it, and it never replays for the same jump: the parent
 * keys it by the jump generation and the fade starts once per generation.
 *
 * Purely decorative: pointer events pass through and it is hidden from
 * accessibility (the jump is announced once by HistorySection; no live region,
 * so focus is never stolen).
 *
 * Hermes worklet hazard: the `useAnimatedStyle` callbacks are self-contained
 * and call no other worklet.
 */
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { useReducedMotion } from "@/theme/use-reduced-motion";

// --- Tunables (D-53, D-54) ---------------------------------------------------

/** How long the highlight lasts: the fade, or the hold under reduced motion. */
export const HIGHLIGHT_FADE_MS = 5000;
/** Peak opacity of the accent tint behind the day's records. */
export const HIGHLIGHT_TINT_OPACITY = 0.14;
/** Width of the accent bar down the left of the day group (dp). */
export const HIGHLIGHT_BAR_WIDTH = 3;
/** Extra time before the parent unmounts a finished highlight (ms). */
export const HIGHLIGHT_CLEAR_SLACK_MS = 250;

export interface HistoryHighlightProps {
  /** The jump generation; the fade runs once per generation. */
  gen: number;
}

export function HistoryHighlight({ gen }: HistoryHighlightProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => sub.remove();
  }, []);

  const progress = useSharedValue(1);
  // The generation this instance started, when, and whether it has ended. A
  // focus or app-state change never restarts it. The live reduced-motion value
  // seeds asynchronously, so a late switch re-issues the REMAINING time on the
  // other path; the end time never moves.
  const run = useRef<{ gen: number; startedAt: number; ended: boolean } | null>(
    null,
  );
  useEffect(() => {
    let current = run.current;
    if (current === null || current.gen !== gen) {
      current = { gen, startedAt: Date.now(), ended: false };
      run.current = current;
    }
    if (current.ended) return;
    if (!isFocused || !appActive) {
      current.ended = true;
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    const remaining = Math.max(
      0,
      HIGHLIGHT_FADE_MS - (Date.now() - current.startedAt),
    );
    if (reducedMotion) {
      progress.value = 1;
      progress.value = withDelay(
        remaining,
        withTiming(0, { duration: 0, reduceMotion: ReduceMotion.Never }),
        ReduceMotion.Never,
      );
    } else {
      progress.value = withTiming(0, {
        duration: remaining,
        reduceMotion: ReduceMotion.Never,
      });
    }
  }, [appActive, gen, isFocused, progress, reducedMotion]);

  const tintStyle = useAnimatedStyle(() => ({
    opacity: progress.value * HIGHLIGHT_TINT_OPACITY,
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.accent },
          tintStyle,
        ]}
      />
      <Animated.View
        style={[styles.bar, { backgroundColor: colors.accent }, barStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: HIGHLIGHT_BAR_WIDTH,
  },
});
