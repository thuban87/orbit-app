/**
 * orrery-ring-logic — the status→ring-style vocabulary for the orrery (ORR-04).
 *
 * PURE, RN-free, node-testable: takes a resolved `ThemePalette` and NEVER imports
 * `react-native`. This EXTENDS the shipped `ringVisual` (contact-card-ring.ts) —
 * it REUSES that function for `{color, opacity, width}` so status→colour is mapped
 * in exactly ONE place — and adds two orrery-only axes:
 *
 *   - `strokeStyle`: solid (stable) → dashed (wobble) → faded (decay) →
 *     faintTrace (rogue), the ring's line treatment as an orbit decays.
 *   - `bodyFill`: the planet BODY colour. Full status colour for stable/wobble/
 *     decay; for ROGUE the ring stays warm `colors.rogue` amber while the body is
 *     the cold `colors.rogueExtinguished` (the two are deliberately different).
 *
 * `null` status (never-contacted) returns a safe NEUTRAL style (`colour =
 * colors.border`) rather than throwing. Orbiting bodies never hit this branch
 * (never-contacted contacts are excluded upstream), but it is the CANONICAL
 * null→neutral fallback that `sun-occupant-logic` REUSES for a never-contacted
 * contact-sun glow (C2-2) — the neutral glow colour is defined once, HERE, and
 * invented nowhere else.
 *
 * Every returned colour resolves through the passed palette — NO hex literal here
 * (CLAUDE.md / check:colors).
 */
import { ringVisual } from "@/components/contact-card-ring";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { ThemePalette } from "@/theme/theme-types";

/** The ring line treatment, escalating as an orbit decays. */
export type StrokeStyle = "solid" | "dashed" | "faded" | "faintTrace";

/** A resolved orrery ring style: the ringVisual triple plus the orrery axes. */
export interface OrreryRingStyle {
  /** Ring stroke colour — REUSED from `ringVisual` (never re-mapped). */
  color: string;
  /** Ring opacity — from `ringVisual`. */
  opacity: number;
  /** Ring border weight — from `ringVisual`. */
  width: number;
  /** The ring line treatment for this status. */
  strokeStyle: StrokeStyle;
  /** The planet BODY fill (rogue body = rogueExtinguished; else full status). */
  bodyFill: string;
}

/**
 * Map a query-time status (or `null` never-contacted) to its full orrery ring
 * style against a resolved palette. PURE.
 *
 * The `{color, opacity, width}` triple comes straight from `ringVisual` — this
 * module adds only `strokeStyle` and `bodyFill`. For `null`, `ringVisual` already
 * returns `colors.border` (the neutral), so `orreryRingStyle(null, colors).color
 * === colors.border` is the single canonical null→neutral fallback (C2-2).
 */
export function orreryRingStyle(
  status: ProfileStatus | null,
  colors: ThemePalette,
): OrreryRingStyle {
  const { color, opacity, width } = ringVisual(status, colors);
  switch (status) {
    case "stable":
      return { color, opacity, width, strokeStyle: "solid", bodyFill: colors.statusStable };
    case "wobble":
      return { color, opacity, width, strokeStyle: "dashed", bodyFill: colors.statusWobble };
    case "decay":
      return { color, opacity, width, strokeStyle: "faded", bodyFill: colors.statusDecay };
    case "rogue":
      // Ring stays warm rogue amber (from ringVisual); body is the cold fill.
      return { color, opacity, width, strokeStyle: "faintTrace", bodyFill: colors.rogueExtinguished };
    default:
      // null / never-contacted → canonical neutral (colour = colors.border).
      // Never thrown; reused by sun-occupant-logic for a null-status sun (C2-2).
      return { color, opacity, width, strokeStyle: "solid", bodyFill: colors.border };
  }
}
