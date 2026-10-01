/**
 * ORRERY LAB B — R2 default orbital-plane tilt (flag `homeTilt`).
 *
 * A game star-map is seen from above AND in front: the orbital plane leans
 * away from the viewer so rings read as ellipses, the far side recedes (depth
 * haze, ring far-side fade and perspective scale already exist for the manual
 * tilt gesture) and the sun sits on a plane instead of on a target.
 *
 * Product camera semantics (docs/systems/orrery.md): "Recenter … restores all
 * Home axes", and Home is tilt 0. Giving Home a tilt CHANGES what Home means,
 * so it is a lab flag applied at the three OrreryScreen Home call sites
 * (switch destination Home, scene Home framing, Recenter) — never inside
 * `deriveHomePose` itself, which stays the product function. Taps, hit radii,
 * labels and focus framing all already run through the tilted projection
 * (`projectFrame`), so nothing else changes. The user can still tilt 0–60°
 * by hand; reset-north still changes yaw only. COMPROMISES C-66.
 *
 * Plain JS (JS thread only): reads the lab store synchronously.
 */
import type { CameraPose } from "@/logic/orrery-camera-logic";
import { useLabFxStore } from "@/stores/orrery-labb-fx-store";

/** Home tilt (rad) while `homeTilt` is on: ≈32°, about half of MAX_TILT. */
export const LAB_HOME_TILT = 0.56;

/** Home pose with the lab default tilt applied (identity when the flag is off). */
export function labHomePose<T extends CameraPose | null>(pose: T): T {
  if (!pose) return pose;
  const flags = useLabFxStore.getState().flags;
  if (!flags.homeTilt) return pose;
  return { ...pose, tilt: LAB_HOME_TILT };
}
