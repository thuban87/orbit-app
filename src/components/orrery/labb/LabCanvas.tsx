/**
 * ORRERY LAB B — the lab path's `<Canvas>` (replaces `OrreryCanvas` for the lab
 * renderer only; the legacy path still uses `OrreryCanvas`).
 *
 * Invariants kept from `OrreryCanvas` (ADR-048/077 M5, research 03 §2.6):
 * - It is the ONLY `useClock()` in the lab path. Only one renderer (and so one
 *   canvas, one clock) is ever mounted. It lives inside OrreryScreen's
 *   `visible && sessionReady && scene` mount gate, so blur / background /
 *   invalid measurement unmount it and the clock stops.
 * - It wraps the Orrery `GestureDetector`.
 * - It still provides `OrreryClockContext` (the AMBIENT clock) so any reused
 *   legacy component (e.g. a future SunBody fallback) keeps working.
 *
 * Shader warm-up: for the first `WARMUP_MS` after mount it draws every
 * `WARMUP_EFFECTS` effect (and every `WARMUP_FILTERS` image filter inside a
 * tiny saveLayer) into a 2×2 clipped, near-transparent group so the GL program
 * compile happens at Orrery entry, not at the first System switch. One React
 * state flip ends it (never per-frame state). WP-2.1: the context's `warm`
 * gate makes every switch FX layer draw one near-invisible probe instance over
 * the same window, so the Ganesh pipelines of their primitives (streak Atlas,
 * sweep-gradient trims, projected gradient shockwave) also compile at entry.
 */
import {
  Canvas,
  Fill,
  Group,
  Paint,
  RuntimeShader,
  Shader,
} from "@shopify/react-native-skia";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import {
  type FrameInfo,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import type { LabFxSnapshot } from "@/stores/orrery-labb-fx-store";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { OrreryClockContext } from "../orrery-clock-context";
import {
  type LabFocusContext,
  LabRenderContext,
  type LabSwitchContext,
} from "./labb-context";
import {
  getLabEffect,
  LAB_EFFECT_SOURCES,
  WARMUP_EFFECTS,
  WARMUP_FILTERS,
  zeroUniforms,
} from "./labb-effects";

/** How long the warm-up group stays mounted after the first frame (ms). */
const WARMUP_MS = 400;
/** Warm-up draw alpha: non-zero so the draw is not culled, invisible in practice. */
const WARMUP_ALPHA = 0.004;
const WARMUP_SIZE = 2;

function WarmUp({ color }: { color: number[] }) {
  const effects = WARMUP_EFFECTS.map((name) => getLabEffect(name)).filter(
    (effect) => effect !== null,
  );
  // Transition-only image filters compile inside a tiny saveLayer (WP-2.1).
  const filters = WARMUP_FILTERS.flatMap((name) => {
    const effect = getLabEffect(name);
    return effect
      ? [{ name, effect, uniforms: zeroUniforms(LAB_EFFECT_SOURCES[name]) }]
      : [];
  });
  if (effects.length === 0 && filters.length === 0) return null;
  return (
    <Group
      clip={{ x: 0, y: 0, width: WARMUP_SIZE, height: WARMUP_SIZE }}
      opacity={WARMUP_ALPHA}
    >
      {effects.map((effect, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed warm-up list
        <Fill key={`warm-${i}`}>
          <Shader source={effect} uniforms={{ uColor: color }} />
        </Fill>
      ))}
      {filters.map((f) => (
        <Group
          key={`warm-filter-${f.name}`}
          layer={
            <Paint>
              <RuntimeShader source={f.effect} uniforms={f.uniforms} />
            </Paint>
          }
        >
          <Fill />
        </Group>
      ))}
    </Group>
  );
}

/**
 * R1 idle mode: the lab's ONE clock, as a PAUSABLE frame callback (RN Skia's
 * `useClock` is the same frame callback, always on). `active` is React-side
 * (flags + reduced-motion state twin, see `labAmbientNeeded`) and flips a few
 * times per session, never per frame. Paused, nothing writes the clock, no
 * ambient worklet re-runs and an untouched canvas stops redrawing (C-29).
 * The value stays continuous across a pause (Reanimated restarts
 * `timeSinceFirstFrame` at 0 on re-activation; `base` carries the offset).
 */
function useLabClock(active: boolean): SharedValue<number> {
  const clock = useSharedValue(0);
  const base = useSharedValue(0);
  const tick = useCallback(
    (info: FrameInfo) => {
      "worklet";
      if (info.timeSinceFirstFrame === 0) base.value = clock.value;
      clock.value = base.value + info.timeSinceFirstFrame;
    },
    [clock, base],
  );
  const callback = useFrameCallback(tick, active);
  useEffect(() => {
    callback.setActive(active);
  }, [callback, active]);
  return clock;
}

export function LabCanvas({
  width,
  height,
  gesture,
  fxFlags,
  warmup,
  warmupColor,
  sw = null,
  focus = null,
  ambientActive = true,
  opaque = false,
  children,
}: {
  width: number;
  height: number;
  gesture: ComposedGesture | GestureType;
  fxFlags: SharedValue<LabFxSnapshot>;
  /** React-side flag: run the mount warm-up at all. */
  warmup: boolean;
  /** Token-derived RGBA for the warm-up probe uniform. */
  warmupColor: number[];
  /** WP-2.1 switch showcase inputs (null in the unit harness). */
  sw?: LabSwitchContext | null;
  /** WP-2.2 focus state (null in the unit harness). */
  focus?: LabFocusContext | null;
  /** R1 idle mode: false pauses the clock (nothing ambient to animate). */
  ambientActive?: boolean;
  /** R1: `opaque` Canvas experiment (flag `opaqueCanvas`). */
  opaque?: boolean;
  children: ReactNode;
}) {
  const [warming, setWarming] = useState(warmup);
  // The ONE clock of the lab path. It also runs through the mount warm-up
  // window (the warm-up timer reads it).
  const clock = useLabClock(ambientActive || (warming && warmup));
  const reducedMotion = useReducedMotionShared();
  const ambient = useDerivedValue(() =>
    fxFlags.value.flags.freezeClock ? 0 : clock.value,
  );
  // Worklet-side warm-up gate (switch FX draw a near-invisible probe instance).
  // A plain SharedValue flipped ONCE (a derived value over the clock would
  // re-run every FX mapper on every frame forever).
  const warm = useSharedValue(warmup);
  useAnimatedReaction(
    () => clock.value > WARMUP_MS,
    (done, previous) => {
      if (done && previous === false) {
        warm.value = false;
        runOnJS(setWarming)(false);
      }
    },
  );
  const still = useMemo(
    () => ({ fxFlags, reducedMotion, warm, sw, focus }),
    [fxFlags, reducedMotion, warm, sw, focus],
  );
  const context = useMemo(
    () => ({ clock, ambient, still, fxFlags, reducedMotion, warm, sw, focus }),
    [clock, ambient, still, fxFlags, reducedMotion, warm, sw, focus],
  );
  return (
    <GestureDetector gesture={gesture}>
      <Canvas testID="orrery-canvas" style={{ width, height }} opaque={opaque}>
        <OrreryClockContext.Provider value={ambient}>
          <LabRenderContext.Provider value={context}>
            {children}
            {warming && warmup ? <WarmUp color={warmupColor} /> : null}
          </LabRenderContext.Provider>
        </OrreryClockContext.Provider>
      </Canvas>
    </GestureDetector>
  );
}
