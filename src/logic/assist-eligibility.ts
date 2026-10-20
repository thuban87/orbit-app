/** Seconds after handoff before a pending assist can be presented. */
export const ELIGIBLE_AFTER_SECONDS = 15;
/** Hours after handoff when a pending assist is no longer eligible. */
export const EXPIRE_AFTER_HOURS = 24;

type PendingAssistForBanner = {
  id: number;
  handoff_at: string;
  created_at: string;
};

/** Convert an Orbit local wall-clock timestamp without parsing it as UTC. */
function localDateTimeMs(value: string): number {
  const [date, time] = value.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

/** True only during the durable post-handoff banner window. */
export function isAssistEligible(handoffAt: string, now: string): boolean {
  const elapsedSeconds =
    (localDateTimeMs(now) - localDateTimeMs(handoffAt)) / 1000;
  return (
    elapsedSeconds >= ELIGIBLE_AFTER_SECONDS &&
    elapsedSeconds <= EXPIRE_AFTER_HOURS * 60 * 60
  );
}

/** Pick the newest eligible assist without mutating the caller's queue. */
export function selectBannerState<T extends PendingAssistForBanner>(
  pendingRows: readonly T[],
  now: string,
): { newest: T | null; morePendingCount: number } {
  const eligible = pendingRows
    .filter((row) => isAssistEligible(row.handoff_at, now))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  return {
    newest: eligible[0] ?? null,
    morePendingCount: Math.max(eligible.length - 1, 0),
  };
}

/** What the assist store hides from the banner and pending list right now. */
export type AssistSkips = {
  /** The record Compose's "Did you send it?" panel is showing (D-23). */
  panelOwnedUid: string | null;
  /** Records answered "Later" since the last return to Orbit (D-77). */
  laterUids: ReadonlySet<string>;
};

/**
 * Drop the panel-owned record and every Later'd record from a pending queue
 * (38.14 D-23 / D-77, built from 39 D-76). Pure: keeps input order and returns
 * a new array without touching the caller's. Keyed on `uid` because that is the
 * identity Compose holds and the banner and pending list already key on.
 */
export function applyAssistSkips<T extends { uid: string }>(
  rows: readonly T[],
  skips: AssistSkips,
): T[] {
  return rows.filter(
    (row) => row.uid !== skips.panelOwnedUid && !skips.laterUids.has(row.uid),
  );
}
