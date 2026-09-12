/**
 * Cycle-block math for the Cycles lens (HIST-04, D-09).
 *
 * A "cycle" is one interval-length span of the contact's CONFIGURED cadence. The
 * lens shows `count` cycles (preset 5/10/15/20), oldest first; the newest block
 * is the in-progress current cycle ending at `now` (bottom-right in the grid).
 *
 * NULLABLE-CADENCE GUARD (ADR-062, D-09): the Cycles lens is UNDEFINED for a
 * contact with no cadence (interval_days null OR tracking disabled). This reuses
 * impact.ts's `{ available: false }` guard shape VERBATIM — the same tagged
 * unavailable result Phase 31's intensity treatment returns — and returns it
 * BEFORE any arithmetic, so cadence math NEVER divides by (or multiplies) a null
 * interval. Callers map the fallback to the 7-Days lens (rendering Cycles as
 * unavailable). No throw, no NaN, no Infinity.
 *
 * Pure: no DB/store/component import, no transaction. All date math is local
 * (dates.ts convention) — never UTC ISO slicing.
 */
import { formatLocalDate } from "@/utils/dates";

/** One cadence cycle block, oldest-first in the result; the last is current. */
export interface CycleBlock {
  /** 0-based position, oldest = 0. */
  readonly index: number;
  /** First local date of the cycle, `YYYY-MM-DD`. */
  readonly start: string;
  /** Last local date of the cycle, `YYYY-MM-DD` (inclusive). */
  readonly end: string;
  /** true only for the newest, in-progress cycle (ends at `now`). */
  readonly isCurrent: boolean;
}

/** The inputs a cycle computation needs — the contact's cadence + the preset. */
export interface CyclesInput {
  /** Nullable cadence in days (null == Unbound / no cadence). */
  readonly intervalDays: number | null;
  /** 0/1 — cadence tracking flag from the contacts row. */
  readonly trackingEnabled: number;
  /** Preset cycle count (5/10/15/20). */
  readonly count: number;
  /** Local wall-clock `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS` (the current cycle ends here). */
  readonly now: string;
}

/** A bound result (blocks) or the tagged no-cadence fallback (mirrors impact.ts). */
export type CyclesResult = { readonly available: true; readonly blocks: readonly CycleBlock[] } | { readonly available: false };

const LOCAL_YMD = /^(\d{4})-(\d{2})-(\d{2})/;

function localDate(now: string): string {
  const match = LOCAL_YMD.exec(now.trim());
  if (!match) {
    throw new Error(`history/cycles: unparseable now "${now}"`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function addLocalDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(y, m - 1, d);
  shifted.setDate(shifted.getDate() + delta);
  return formatLocalDate(shifted);
}

/**
 * Build the cadence cycle blocks for a contact, or the no-cadence fallback.
 *
 * Guard first (ADR-062/D-09): a null interval or disabled tracking returns
 * `{ available: false }` before any arithmetic. Otherwise builds `count`
 * contiguous interval-length blocks ending at `now` (the current cycle), oldest
 * first, with the last block flagged `isCurrent`.
 */
export function cycles(input: CyclesInput): CyclesResult {
  // VERBATIM impact.ts guard — never divide by / multiply a null interval.
  if (input.trackingEnabled !== 1 || input.intervalDays === null) {
    return { available: false };
  }
  const interval = input.intervalDays;
  const nowDate = localDate(input.now);

  // Newest (current) cycle ends at `now`; each older cycle ends one interval
  // earlier. Build newest-first, then reverse to oldest-first.
  const newestFirst: { start: string; end: string }[] = [];
  for (let k = 0; k < input.count; k++) {
    const end = addLocalDays(nowDate, -k * interval);
    const start = addLocalDays(end, -(interval - 1));
    newestFirst.push({ start, end });
  }
  const oldestFirst = newestFirst.reverse();
  const blocks: CycleBlock[] = oldestFirst.map((block, index) => ({
    index,
    start: block.start,
    end: block.end,
    isCurrent: index === input.count - 1,
  }));
  return { available: true, blocks };
}
