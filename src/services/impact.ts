/**
 * Impact orchestration + tunables (LOG-03) — the profile-only "impact" concept
 * from docs/dossier/04-log.md Cluster G. Plan 06-05 shipped the GRAVITY half
 * (accumulated familiarity, the grace buffer); Plan 06-06 adds the INTENSITY
 * half (this-period contact rate vs the intended frequency) with its own period
 * tunable + orchestration alongside these.
 *
 * DERIVED-NEVER-STORED: gravity is computed at read time from the interaction
 * rows (via `getImpactInputs`), never written to a column. A stored score would
 * rot silently with the mere passage of time (nothing fires a trigger on the
 * clock advancing), exactly as `status` is derived-never-stored. If gravity ever
 * profiles as expensive the answer is a CACHED column with a SINGLE writer —
 * never a stored score that rots (Cluster G [log → data]).
 *
 * Node-pure: no react-native / expo import — it only orchestrates the pure
 * `gravity-logic` over an `ImpactInputs` shape, so it stays node-testable.
 */

import type { ImpactInputs } from "@/db/impact-read";
import { getImpactInputs } from "@/db/impact-read";
import {
  computeGravity,
  type GravityResult,
  type GravityTier,
  type GravityTunables,
} from "@/services/gravity-logic";
import {
  computeIntensity,
  type IntensityResult,
} from "@/services/intensity-logic";

// --- Gravity tunables (top-of-file, single-number edit — CLAUDE.md) ----------
//
// OWNER-APPROVED 2026-08-15. These are owner-approved DEFAULTS the owner may
// still retune (like avatarSwatches / the gravityTiers ramp), NOT placeholders.
// Editing any single number here is the entire tuning surface for gravity.

/** Days for a per-interaction weight to decay HALF-way to the floor. */
export const HALF_LIFE_DAYS = 365;

/** Floor fraction an ancient interaction still weighs — never decays to zero. */
export const FLOOR_W = 0.15;

/**
 * The four gravity tiers, ASCENDING raw threshold. `thin` starts at 0 so a
 * never-contacted contact (raw 0) lands on it. The tier COUNT (4) is kept in
 * LOCKSTEP with the `gravityTiers` colour ramp added in Plan 06-04 (one colour
 * per tier), so GravityBar can index `colors.gravityTiers[tierIndex]` in range.
 * Reordering / re-counting here REQUIRES the same change to that ramp.
 *
 * Names are owner-approved (thin / building / solid / deep); the boundaries are
 * owner-approved defaults tuned to the weight scale (a recent interaction weighs
 * ~1, so raw ≈ the age-weighted interaction count).
 */
export const GRAVITY_TIERS: readonly GravityTier[] = [
  { name: "thin", threshold: 0 },
  { name: "building", threshold: 3 },
  { name: "solid", threshold: 8 },
  { name: "deep", threshold: 18 },
];

/** The tunables bundle handed to the pure `computeGravity`. */
const GRAVITY_TUNABLES: GravityTunables = {
  halfLifeDays: HALF_LIFE_DAYS,
  floorW: FLOOR_W,
  // Spread to a mutable array — the pure fn only reads it.
  tiers: [...GRAVITY_TIERS],
};

/**
 * Derive a contact's gravity from its impact inputs at read time.
 *
 * Applies the recency-mirroring scope BEFORE the pure sum: for a "Rarely
 * responds" contact only CONNECTED rows feed gravity (Cluster G — rarely_responds
 * contacts feed it differently), the same `rarely_responds = 0 OR connected = 1`
 * filter the single-writer recency DAO uses. A normal contact counts every row.
 * `direction` is intentionally NOT consulted (familiarity accrues regardless of
 * who reached out; direction drives intensity, Plan 06-06).
 */
export function computeContactGravity(
  inputs: ImpactInputs,
  now: string,
): GravityResult {
  const rows =
    inputs.rarelyResponds === 1
      ? inputs.interactions.filter((i) => i.connected === 1)
      : inputs.interactions;
  return computeGravity(
    rows.map((i) => ({ occurredAt: i.occurredAt, connected: i.connected })),
    now,
    GRAVITY_TUNABLES,
  );
}

// --- Intensity tunable (top-of-file policy, single-number edit — CLAUDE.md) --
//
// OWNER-APPROVED 2026-08-15 (A3 — "one interval-length"). The intensity period
// defaults to the CONTACT'S OWN interval_days rather than a fixed calendar
// window: a Yearly contact has no meaningful "this week", so the period must
// scale with the intended frequency. This is a POLICY the owner may still
// retune (e.g. two interval-lengths, or a floor/cap) — it is not a placeholder.
// `computeContactIntensity` reads the period from inputs.intervalDays via this
// policy so the whole tuning surface stays here at the top of the file.

/**
 * Resolve the intensity PERIOD (days) for a contact from its interval. A3:
 * one interval-length. A future retune (a multiplier, a floor for very short
 * intervals, a cap for Yearly) belongs HERE, in this single function.
 */
export function intensityPeriodDays(intervalDays: number): number {
  return intervalDays;
}

/**
 * Derive a contact's intensity from its impact inputs at read time.
 *
 * Delegates to the pure `computeIntensity` with the period = one interval-length
 * (the owner-approved policy above) and the contact's `rarelyResponds` flag (so
 * the pure core applies the recency-mirroring connected scope). `direction` and
 * `connected` filtering both live inside `computeIntensity`; this orchestrator
 * only supplies the period + flag. DERIVED-NEVER-STORED — no write.
 */
export function computeContactIntensity(
  inputs: ImpactInputs,
  now: string,
): IntensityResult {
  return computeIntensity(
    inputs.interactions,
    intensityPeriodDays(inputs.intervalDays),
    inputs.rarelyResponds,
    now,
  );
}

/**
 * Convenience read+derive: load the shared impact inputs and, when the contact
 * exists, return its gravity. Returns null for a missing contact (mirrors
 * `getImpactInputs`). The screen may instead call `getImpactInputs` once and
 * feed both gravity and intensity — this is the gravity-only shortcut.
 */
export async function loadContactGravity(
  exec: Parameters<typeof getImpactInputs>[0],
  contactId: number,
  now: string,
): Promise<GravityResult | null> {
  const inputs = await getImpactInputs(exec, contactId);
  if (!inputs) {
    return null;
  }
  return computeContactGravity(inputs, now);
}
