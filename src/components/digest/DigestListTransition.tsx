/**
 * The standard Digest list transition (38.3 RG-026, owner ruling D-13).
 *
 * When a committed write or a resume refresh changes Up Next or Horizon while
 * Digest stays mounted, a row that leaves fades out, a row that arrives fades
 * in, and the rows around them shift into place — Reanimated's built-in layout
 * builders at the existing MOTION tokens (planner call, RESEARCH A2):
 *
 * - `DigestListGroup` wraps one list in `LayoutAnimationConfig skipEntering`,
 *   so the first render (Digest opening, a group appearing) never animates.
 * - `DigestListItem` wraps one row: `LinearTransition` (MOTION.base) for the
 *   layout shift, `FadeIn`/`FadeOut` (MOTION.fast) for arrival/exit.
 *
 * Under reduced motion there is NO transition at all (D-13): every builder is
 * `undefined`. The OS flag is read once per group (live, via
 * `useReducedMotion`) and shared with its rows through context. Built-in
 * builders only — no custom worklet, no colour, no React-state-driven frames.
 */
import { createContext, type ReactNode, useContext } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
} from "react-native-reanimated";
import { MOTION } from "@/theme/tokens/motion";
import { useReducedMotion } from "@/theme/use-reduced-motion";

/** Rows outside a group never animate (safe default). */
const DigestListMotionContext = createContext<{ animate: boolean }>({
  animate: false,
});

export function DigestListGroup({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <DigestListMotionContext.Provider value={{ animate: !reducedMotion }}>
      <LayoutAnimationConfig skipEntering>{children}</LayoutAnimationConfig>
    </DigestListMotionContext.Provider>
  );
}

export function DigestListItem({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { animate } = useContext(DigestListMotionContext);
  return (
    <Animated.View
      style={style}
      layout={animate ? LinearTransition.duration(MOTION.base) : undefined}
      entering={animate ? FadeIn.duration(MOTION.fast) : undefined}
      exiting={animate ? FadeOut.duration(MOTION.fast) : undefined}
    >
      {children}
    </Animated.View>
  );
}
