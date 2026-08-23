/**
 * Pure digest transforms + owner-tunable thresholds (DGST-02 / DGST-03).
 *
 * React-native-free — no expo / RN imports — so Vitest runs it node-side and
 * every threshold is proven off-device (the reads + logic are the digest's
 * correctness surface; the .tsx screen is device-UAT only). This mirrors the
 * `src/logic/*-logic.ts` convention and `status.ts`'s exported-string-constant
 * posture: the numbers that decide what the screen shows live HERE, at the top,
 * as single-number edits.
 *
 * The retrospective's per-person rows come from `readRetrospective`; the
 * overlooked rows from `readOverlooked` (already `STATUS_SQL='rogue'`, mute
 * IGNORED — see digest-read.ts); the gentle-line tally from `readGentleLine`.
 * This module only SHAPES those results — it issues no SQL and reads no clock
 * except `dayTag`, which parses a STORED local wall-clock value.
 */

// ---------------------------------------------------------------------------
// Owner-tunable thresholds (single-number edits — CLAUDE.md; mirrors
// status.ts:40-42). Design steer for the gentle line: "err toward NOT showing,
// never routine" (D-GA3 / CONTEXT gentle line).
// ---------------------------------------------------------------------------

/**
 * Retrospective window length in days as a modifier offset. `6` yields a 7-day
 * INCLUSIVE window (today + the 6 prior days) via
 * `date('now','localtime', windowModifier(RETROSPECTIVE_WINDOW_DAYS))`.
 */
export const RETROSPECTIVE_WINDOW_DAYS = 6;

/**
 * The effortful-marks window — deliberately WIDER than the retrospective so the
 * gentle line reads "a few recent conversations", not "this week". 14 days.
 */
export const EFFORTFUL_WINDOW_DAYS = 14;

/** Per-group cap before a "+N more →" tap-through (keeps the section calm). */
export const GROUP_CAP = 6;

/**
 * The conservative "skews hard" gate — BOTH must hold (see shouldShowEffortful):
 * an absolute floor of hard marks AND a hard-fraction floor. One bad chat never
 * triggers the line.
 */
export const EFFORTFUL_MIN_HARD = 3;
export const EFFORTFUL_MIN_FRACTION = 0.5;

/** Sun..Sat, aligned to JavaScript `Date.getDay()` (0 = Sunday). */
export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

/**
 * Build the SQLite date-modifier string for a trailing window from an INTEGER
 * tunable. Guards `Number.isInteger` + non-negative so no user free-text and no
 * fractional/NaN value can ever reach a query (the digest reads interpolate the
 * RESULT of this directly; nothing else runtime-valued crosses into their SQL).
 */
export function windowModifier(days: number): string {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(
      `windowModifier: days must be a non-negative integer, got ${String(days)}`,
    );
  }
  return `-${days} days`;
}

const STORED_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * The local weekday abbreviation ("Tue") for a STORED wall-clock value
 * (`YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`). Parsed via `new Date(y, m-1, d)` from
 * the local Y-M-D components — NEVER `toISOString`, which would render a
 * late-evening value as the next calendar day in a positive-offset zone (the
 * documented, once-fixed UTC off-by-one; dates.ts). Time-of-day is discarded, so
 * a 23:59 timestamp tags the SAME day as a 09:00 one.
 *
 * Throws on an unparseable value rather than silently mislabelling a row — the
 * only inputs are `MAX(occurred_at)` values the DB just returned.
 */
export function dayTag(stored: string): string {
  const m = STORED_DATE.exec(stored.trim());
  if (!m) {
    throw new Error(
      `dayTag: unparseable stored date ${JSON.stringify(stored)}`,
    );
  }
  const [, y, mo, d] = m;
  const local = new Date(Number(y), Number(mo) - 1, Number(d));
  return WEEKDAY_LABELS[local.getDay()];
}

/** The minimal shape splitOverlooked needs — the rogue REASON, or null. */
interface HasReason {
  reason: string | null;
}

/**
 * Split the overlooked rogue rows into the two calm sub-groups BY REASON ONLY,
 * never by the raw progress magnitude: `'overdue'` → Drifting, `'unresponsive'`
 * → Gone quiet (D-GA2 / REASON_SQL branch order, status.ts:95-99). A
 * `rarely_responds` contact past `ROGUE_K` reads `'unresponsive'` and therefore
 * lands in Gone quiet even though its progress can exceed a Drifting row's.
 * Input order is preserved within each group (readOverlooked orders by progress
 * DESC, so most-slipped stays first).
 */
export function splitOverlooked<T extends HasReason>(
  rows: T[],
): { drifting: T[]; goneQuiet: T[] } {
  const drifting: T[] = [];
  const goneQuiet: T[] = [];
  for (const row of rows) {
    if (row.reason === "unresponsive") {
      goneQuiet.push(row);
    } else if (row.reason === "overdue") {
      drifting.push(row);
    }
    // Any other reason (should not occur for a rogue row) is ignored, never
    // mis-bucketed.
  }
  return { drifting, goneQuiet };
}

/**
 * Cap a group at `GROUP_CAP` for the calm section, returning the shown slice and
 * the non-negative overflow count for the "+N more →" affordance. 6 rows → all
 * shown, overflow 0; 9 rows → 6 shown, overflow 3.
 */
export function capGroup<T>(rows: T[]): { shown: T[]; overflow: number } {
  return {
    shown: rows.slice(0, GROUP_CAP),
    overflow: Math.max(0, rows.length - GROUP_CAP),
  };
}

/**
 * The conservative "skews hard" decision. TRUE only when BOTH gates hold: at
 * least `EFFORTFUL_MIN_HARD` hard marks AND a hard-fraction of at least
 * `EFFORTFUL_MIN_FRACTION`. `max(total, 1)` avoids a divide-by-zero and makes an
 * empty tally read false. Errs toward NOT showing — one hard mark, or a few hard
 * marks lost in many good ones, never triggers the line.
 */
export function shouldShowEffortful(hard: number, total: number): boolean {
  return (
    hard >= EFFORTFUL_MIN_HARD &&
    hard / Math.max(total, 1) >= EFFORTFUL_MIN_FRACTION
  );
}

/** The unified "all quiet this week" predicate inputs. */
interface AllQuietInputs {
  reachedCount: number;
  driftingCount: number;
  goneQuietCount: number;
  backlogCount: number;
  effortfulShown: boolean;
}

/**
 * The single "all quiet this week" state (UI-SPEC §4): true only when the
 * retrospective, BOTH overlooked groups, and the backlog are all empty AND the
 * gentle line does not fire. Any content in any section defeats it.
 */
export function isAllQuiet({
  reachedCount,
  driftingCount,
  goneQuietCount,
  backlogCount,
  effortfulShown,
}: AllQuietInputs): boolean {
  return (
    reachedCount === 0 &&
    driftingCount === 0 &&
    goneQuietCount === 0 &&
    backlogCount === 0 &&
    !effortfulShown
  );
}
