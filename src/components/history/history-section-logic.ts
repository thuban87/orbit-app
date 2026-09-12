/**
 * History section orchestration logic (Plan 08, HIST-01/HIST-15).
 *
 * Pure, DB-free orchestration behind the assembled Profile History section. It
 * imports NO DAO, store, component, or transaction — the correctness-critical
 * decisions (which window a lens resolves to, when the section is empty, and the
 * shape of the detailed-log navigation payload) live in a node-testable `.ts`,
 * not the un-loadable `HistorySection.tsx`. Mirrors the repo convention of
 * `services/history/*` and the co-located `heatmap-cell.ts` / `rolodex-logic.ts`.
 *
 * DATE DISCIPLINE (CLAUDE.md, dates.ts): every date is a local `YYYY-MM-DD`
 * string. `YYYY-MM-DD` string comparison is chronological, so `<=`/`>=` on the
 * strings is a valid date-range test. UTC ISO slicing is NEVER used here.
 */
import type { HistoryLens } from "@/db/app-settings-dao";
import type { CycleBlock } from "@/services/history/cycles";
import {
  buildWindow,
  type DateLens,
  type HistoryWindow,
} from "@/services/history/window";

/**
 * Resolve the active date-grid window for a lens. The three day-oriented lenses
 * (`7days`/`month`/`year`) generate a `HistoryWindow`; the `cycles` lens is a
 * cadence grid, not a date grid, so it has NO window (the Heatmap renders its
 * cycle blocks instead) and this returns null.
 */
export function resolveActiveWindow(
  lens: HistoryLens,
  refDate: string,
  today: string,
): HistoryWindow | null {
  if (lens === "cycles") return null;
  return buildWindow(lens as DateLens, refDate, today);
}

/**
 * The "No history yet" empty-section predicate (HIST-01).
 *
 * TRUE only when the contact has zero interactions AND no lifecycle records. A
 * lifecycle-only contact (zero interactions but `hasLifecycleRecords` true) is
 * NOT empty — it shows the zero-count Heatmap/Browser surfaces, not the empty
 * section (Plan 03's `hasLifecycleRecords` signal is the discriminator). A
 * contact with any interaction is likewise not empty.
 */
export function isEmptyHistory(history: {
  readonly interactions: readonly unknown[];
  readonly hasLifecycleRecords: boolean;
}): boolean {
  return history.interactions.length === 0 && !history.hasLifecycleRecords;
}

/** The typed LogContact navigation payload (contact preselected + date prefilled). */
export interface LogContactRoute {
  /** The detailed-log route name — never a quick-log surface (HIST-15). */
  readonly screen: "LogContact";
  readonly params: {
    /** The contact this interaction is being logged for (preselected). */
    readonly contactId: number;
    /** The local `YYYY-MM-DD` the empty date/cell action prefills. */
    readonly prefillDate: string;
  };
}

/**
 * Build the TYPED LogContact { contactId, prefillDate } navigation contract for
 * an empty date/cell "Log interaction" action (HIST-15). The contact is
 * preselected and the tapped date is prefilled. This is the detailed-log route
 * contract — NEVER a quick-log payload. Phase 32 owns only this contract + the
 * placeholder target; Phase 34 fills the real detailed-log form that consumes
 * `prefillDate`.
 */
export function buildLogRoute(
  contactId: number,
  prefillDate: string,
): LogContactRoute {
  return { screen: "LogContact", params: { contactId, prefillDate } };
}

/**
 * Per-cycle interaction counts, index-aligned to `blocks`. Each interaction
 * local date is bucketed into the block whose `[start, end]` inclusive range
 * contains it (chronological string comparison); dates outside every block are
 * ignored. Returns a zero-filled array of the same length as `blocks`.
 */
export function countByCycle(
  blocks: readonly CycleBlock[],
  interactionDates: readonly string[],
): number[] {
  const counts = blocks.map(() => 0);
  for (const date of interactionDates) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (date >= block.start && date <= block.end) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}
