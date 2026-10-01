/**
 * ORRERY LAB B — render context shared by every lab layer inside `LabCanvas`.
 *
 * - `clock`: the single `useClock()` (raw, ms). Only the FPS HUD and the
 *   warm-up timer read it directly.
 * - `ambient`: the clock every AMBIENT effect reads (twinkle, pulse, flow…). It
 *   is pinned to 0 while the panel's "freeze clock" flag is on.
 * - `fxFlags`: the store snapshot mirrored into one SharedValue for worklets.
 * - `reducedMotion`: the live OS (or lab-forced) signal; ambient worklets must
 *   read it INSIDE the worklet (ADR-085).
 *
 * Null outside a `LabCanvas` (unit harness) — consumers fall back to static.
 */
import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";
import type {
  SwitchChoreography,
  SwitchSignal,
} from "@/logic/orrery-switch-choreography";
import type { LabFxSnapshot } from "@/stores/orrery-labb-fx-store";
import type { LabSwitchRoles } from "./labb-switch-logic";

/**
 * WP-2.1 switch showcase inputs (all UI-thread values, owned by
 * `LabBRenderer`): the choreography signal, the per-key role map (recomputed
 * per publish only), the displayed per-System sky hue, the transition itself
 * (comet / smear tails sample its entries) and the mount warm-up gate.
 */
export interface LabSwitchContext {
  signal: SharedValue<SwitchSignal>;
  roles: SharedValue<LabSwitchRoles>;
  skyHue: SharedValue<number[]>;
  transition: SharedValue<SwitchChoreography>;
}

/**
 * WP-2.2 focus state (UI-thread values owned by `LabBRenderer`): `mix` = world
 * response 0..1 (a `withTiming` started in an effect keyed on focus identity),
 * `keys` = the focused body keys (RETAINED after a clear so the release fades
 * with `mix`), `lock` = the target-lock reticle 0 (seeking) .. 1 (locked).
 */
export interface LabFocusContext {
  mix: SharedValue<number>;
  keys: SharedValue<string[]>;
  lock: SharedValue<number>;
}

/**
 * R1: the context WITHOUT the clocks. Reanimated subscribes a derived value to
 * EVERY SharedValue reachable from its closure (it walks captured plain
 * objects), so a worklet that captured the whole context re-ran on every
 * clock tick even when it never read the clock — at idle that was the trim
 * picture, every switch-FX state + its Atlas buffers (up to 512 sprites ×3)
 * and the star placements, every frame. Worklets capture THIS (or single
 * values) unless they genuinely read `ambient`.
 */
export interface LabStillContext {
  fxFlags: SharedValue<LabFxSnapshot>;
  reducedMotion: SharedValue<boolean>;
  warm: SharedValue<boolean>;
  sw: LabSwitchContext | null;
  focus: LabFocusContext | null;
}

export interface LabRenderContextValue {
  clock: SharedValue<number>;
  ambient: SharedValue<number>;
  /** The same values minus the clocks (capture this in worklets). */
  still: LabStillContext;
  fxFlags: SharedValue<LabFxSnapshot>;
  reducedMotion: SharedValue<boolean>;
  /** True for the first WARMUP_MS after mount: every switch FX draws one
   * near-invisible probe instance so its GPU pipeline compiles at entry. */
  warm: SharedValue<boolean>;
  sw: LabSwitchContext | null;
  /** WP-2.2 focus state (null in the unit harness). */
  focus: LabFocusContext | null;
}

export const LabRenderContext = createContext<LabRenderContextValue | null>(
  null,
);

export function useLabRenderContext(): LabRenderContextValue | null {
  return useContext(LabRenderContext);
}

/** The clock-free part of the context (R1; see `LabStillContext`). */
export function useLabStillContext(): LabStillContext | null {
  return useContext(LabRenderContext)?.still ?? null;
}
