/**
 * OrreryCanvas (ORR-01/ORR-03) — the conditionally-mountable `<Canvas>` subtree of
 * the orrery. OrreryScreen renders it only once the canvas is MEASURED (C2-4:
 * `dimsValid`), and 13-07 will additionally gate it on focus so that UNMOUNTING it
 * truly stops the Skia render loop (Pitfall 4 — the clock has no pause arg).
 *
 * This component is the designated HOME of the ambient/clock hooks: 13-07 adds the
 * `useClock`-driven starfield twinkle + sun-glow pulse HERE, never in OrreryScreen,
 * so the pause-on-blur unmount cleanly halts them. For 13-05 (static status view)
 * it is a thin wrapper — it owns no motion yet — but the boundary is established so
 * the clock lands inside the unmountable subtree.
 *
 * The Skia child elements (orbit rings, keyed `<OrbitBody/>` planets, the
 * `<SunBody/>` sun) are BUILT by OrreryScreen and passed in as `children`, so no
 * per-body hook is ever called inside a `.map()` in this component either — the
 * planets arrive as already-constructed elements. The background `<Fill>` colour is
 * a passed theme token (check:colors).
 */
import { Canvas, Fill } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";

export interface OrreryCanvasProps {
  /** Measured canvas width (C2-4: only mounted when > 0). */
  width: number;
  /** Measured canvas height (C2-4: only mounted when > 0). */
  height: number;
  /** Deep-space background colour (`colors.background`). */
  background: string;
  /** The composed tap gesture (13-07 races a pan in). */
  gesture: ComposedGesture | GestureType;
  /** The pre-built Skia subtree: rings, `<OrbitBody/>` planets, `<SunBody/>`. */
  children: ReactNode;
}

export function OrreryCanvas({
  width,
  height,
  background,
  gesture,
  children,
}: OrreryCanvasProps) {
  // 13-07: `const clock = useClock()` lands here (inside the unmountable subtree).
  return (
    <GestureDetector gesture={gesture}>
      <Canvas testID="orrery-canvas" style={{ width, height }}>
        <Fill color={background} />
        {children}
      </Canvas>
    </GestureDetector>
  );
}
