/**
 * ORRERY LAB B — R1 idle mode: does anything AMBIENT need the clock?
 *
 * The lab canvas has ONE ambient clock (`LabCanvas`). While it ticks, every
 * derived value that reads it re-runs each frame and the canvas redraws every
 * vsync, even when the result is frozen (reduced motion) — COMPROMISES C-29.
 * Everything non-ambient (switch choreography, focus `withTiming`s, feedback
 * timers, camera recoveries, gestures) drives its own SharedValues, so the
 * canvas still redraws for exactly those frames. When this returns false the
 * clock's frame callback is paused and an untouched Orrery draws NOTHING.
 *
 * Ambient consumers (all frozen under reduced motion inside their worklets):
 * nebula drift / breathing, mid+near star twinkle, ring energy flow, the lit
 * sun (granulation, corona breathing) and the fallback sun pulse.
 *
 * Pure (node-testable). React-side input only: flags change through the panel
 * and reduced motion through the state twin — never per frame.
 */
import type { LabFlags } from "@/stores/orrery-labb-fx-store";
import type { LabFxProfile } from "@/theme/orrery-lab-fx";

export function labAmbientNeeded(
  flags: LabFlags,
  reducedMotion: boolean,
  profile: Pick<LabFxProfile, "env" | "rings">,
  /** Contact rings in the scene (the flow has a density LOD). */
  ringCount = 0,
  /** `FLOW_LOD_MAX_RINGS` (passed in: this module stays Skia-free). */
  flowLodMaxRings = Number.POSITIVE_INFINITY,
): boolean {
  if (reducedMotion || flags.freezeClock) return false;
  if (flags.environment) {
    if (flags.nebula && flags.nebulaDrift) return true;
    if (flags.stars && flags.twinkle && profile.env.twinkle > 0) return true;
  }
  if (
    flags.rings &&
    !flags.ringsPathRebuild &&
    flags.ringShader &&
    flags.ringFlow &&
    profile.rings.flow > 0 &&
    ringCount <= flowLodMaxRings
  )
    return true;
  if (flags.bodies) {
    if (flags.bodyLighting && (flags.sunCorona || flags.sunPlasma)) return true;
    if (flags.sunPulse) return true;
  }
  return false;
}
