/** Pure membership math for the Skia-driven System switch presentation. */
import type { SwitchChoreographyOptions } from "@/logic/orrery-switch-choreography";
export interface MembershipDelta {
  overlap: number;
  entering: number;
  leaving: number;
  total: number;
}

/**
 * Measures the two System memberships as sets so intensity reflects turnover,
 * rather than the absolute number of contacts in either System.
 */
export function computeMembershipDelta(
  sourceIds: readonly number[],
  destinationIds: readonly number[],
): MembershipDelta {
  const source = new Set(sourceIds);
  const destination = new Set(destinationIds);
  let overlap = 0;
  for (const id of source) if (destination.has(id)) overlap++;
  return {
    overlap,
    entering: destination.size - overlap,
    leaving: source.size - overlap,
    total: source.size + destination.size - overlap,
  };
}

/**
 * Converts membership turnover to a bounded, count-independent render-loop
 * intensity. The denominator counts both appearances of retained members, so
 * identical memberships are 0 and a full turnover is 1.
 */
export function switchIntensity(delta: MembershipDelta): number {
  const comparedMemberships =
    delta.entering + delta.leaving + delta.overlap * 2;
  if (comparedMemberships === 0) return 0;
  return Math.max(
    0,
    Math.min(1, (delta.entering + delta.leaving) / comparedMemberships),
  );
}

/** Same-System refreshes and restored sessions never start the switch effect. */
export function switchTransitionIntensity(
  isInSessionSwitch: boolean,
  delta: MembershipDelta,
): number {
  return isInSessionSwitch ? switchIntensity(delta) : 0;
}

/** Converts discrete selection state into the canonical render-loop profile. */
export function createSwitchChoreographyOptions(
  isInSessionSwitch: boolean,
  delta: MembershipDelta,
  reducedMotion: boolean,
): SwitchChoreographyOptions {
  return {
    intensity: switchTransitionIntensity(isInSessionSwitch, delta),
    reducedMotion,
  };
}

/** A retained focus stays selected, but only a non-switch may frame it. */
export function selectSystemFraming<T>(
  forceHome: boolean,
  focusedPose: T | undefined,
  homePose: T | undefined,
): T | undefined {
  return forceHome || focusedPose === undefined ? homePose : focusedPose;
}

/** Keeps a selected contact through a switch only when both Systems contain it. */
export function preservedFocus(
  focusId: number | null,
  sourceIds: readonly number[],
  destinationIds: readonly number[],
): number | null {
  if (focusId === null) return null;
  return sourceIds.includes(focusId) && destinationIds.includes(focusId)
    ? focusId
    : null;
}
