/**
 * Count-only heatmap bucketing (HIST-02, D-10).
 *
 * Maps a generated window + interaction rows to per-cell interaction COUNTS.
 * COUNT-ONLY is the load-bearing invariant: this function only ever receives
 * `interactions` rows, so lifecycle events and every other non-interaction
 * record contribute exactly nothing to saturation (D-10). A Group Event parent
 * is never an `interactions` row (the group seam is inert in Phase 32 — no
 * `group_event_id` column exists), so it can never double-count here either.
 *
 * Pure: no DB/store/component import, no transaction. Local-date only — the
 * stored `occurred_at` is already a LOCAL wall-clock string (DATA-05), so its
 * date is the leading `YYYY-MM-DD`; we never route it through UTC ISO slicing.
 */
import type { HeatmapLens, HistoryWindow } from "@/services/history/window";

/** The minimal shape bucketing needs from an interaction: when it occurred (local). */
export interface BucketInteraction {
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS` (or bare `YYYY-MM-DD`). */
  readonly occurredAt: string;
}

// --- Threshold tuning (top-of-file, single-object edit — CLAUDE.md) ----------
//
// ONE tunable object, two threshold tables (dossier §K "example direction",
// tune on the Pixel). A count reaching table[i] lifts the cell to level i+1;
// the level caps at the table length. Day lenses use the 3-step ramp (levels
// 0..3, capping at heatmapScale[3]); the cycle lens uses the full 4-step ramp
// (levels 0..4). Editing these arrays is the entire saturation-tuning surface.
const HEATMAP_THRESHOLDS: { readonly day: readonly number[]; readonly cycles: readonly number[] } = {
  day: [1, 2, 3],
  cycles: [1, 2, 3, 4],
};

const LOCAL_YMD = /^(\d{4}-\d{2}-\d{2})/;

/** The LOCAL calendar date of a stored wall-clock timestamp (its leading YYYY-MM-DD). */
function localDateOf(occurredAt: string): string {
  const match = LOCAL_YMD.exec(occurredAt.trim());
  if (!match) {
    throw new Error(`history/buckets: unparseable occurred_at "${occurredAt}"`);
  }
  return match[1];
}

/**
 * Per-cell interaction counts for a window. Returns a Map keyed by every REAL
 * date in the window (placeholders excluded), each defaulting to 0, incremented
 * once per interaction whose local date falls on that cell. Interactions outside
 * the window's real dates are ignored (never added to the map).
 */
export function buckets(
  window: HistoryWindow,
  interactions: readonly BucketInteraction[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const cell of window.cells) {
    if (cell.date !== null) {
      counts.set(cell.date, 0);
    }
  }
  for (const interaction of interactions) {
    const date = localDateOf(interaction.occurredAt);
    const current = counts.get(date);
    if (current !== undefined) {
      counts.set(date, current + 1);
    }
  }
  return counts;
}

/**
 * Bucket a raw interaction count to a saturation LEVEL for the given lens.
 * Day lenses (7days/month/year) cap at level 3; the cycle lens caps at level 4.
 * Level 0 is the empty/zero cell. Pure, total, and monotonic in `count`.
 */
export function heatmapLevel(count: number, lens: HeatmapLens): number {
  const table = lens === "cycles" ? HEATMAP_THRESHOLDS.cycles : HEATMAP_THRESHOLDS.day;
  let level = 0;
  for (const threshold of table) {
    if (count >= threshold) {
      level++;
    }
  }
  return level;
}
