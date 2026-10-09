/**
 * History section orchestration logic (Plan 08, HIST-01/HIST-15).
 *
 * Pure, DB-free orchestration behind the assembled Profile History section. It
 * imports NO DAO, store, component, or transaction — the correctness-critical
 * decisions (which window a lens resolves to, when the section is empty, and the
 * shape of the detailed-log navigation payload) live in a node-testable `.ts`,
 * not the un-loadable `HistorySection.tsx`. Mirrors the repo convention of
 * `services/history/*` and the co-located `heatmap-cell.ts` /
 * `history-stream-logic.ts`.
 *
 * DATE DISCIPLINE (CLAUDE.md, dates.ts): every date is a local `YYYY-MM-DD`
 * string. `YYYY-MM-DD` string comparison is chronological, so `<=`/`>=` on the
 * strings is a valid date-range test. UTC ISO slicing is NEVER used here.
 */
import type { HistoryLens } from "@/db/app-settings-dao";
import {
  type CycleBlock,
  type CyclesResult,
  cycles,
} from "@/services/history/cycles";
import {
  buildWindow,
  type DateLens,
  type HistoryWindow,
} from "@/services/history/window";
import { formatLocalDate } from "@/utils/dates";

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
 * TRUE only when the contact has NONE of the three record families the History
 * section surfaces: zero interactions AND no lifecycle records AND no
 * history-aware knowledge changes. A contact with only ONE family populated is
 * NOT empty — a lifecycle-only contact (via Plan 03's `hasLifecycleRecords`
 * discriminator) and a knowledge-change-only contact (edited fields but zero
 * interactions/lifecycle) both show the zero-count Heatmap surfaces and their
 * rows in the History stream (38.8 D-10), never the empty section. Omitting
 * `knowledgeChanges` here wrongly hid the third family's rows behind "No history
 * yet" (dossier: the three record families are preserved; item #13; D-57).
 */
export function isEmptyHistory(history: {
  readonly interactions: readonly unknown[];
  readonly hasLifecycleRecords: boolean;
  readonly knowledgeChanges: readonly unknown[];
}): boolean {
  return (
    history.interactions.length === 0 &&
    !history.hasLifecycleRecords &&
    history.knowledgeChanges.length === 0
  );
}

/** The typed LogContact navigation payload (contact preselected, date optional). */
export interface LogContactRoute {
  /** The detailed-log route name — never a quick-log surface (HIST-15). */
  readonly screen: "LogContact";
  readonly params: {
    /** The contact this interaction is being logged for (preselected). */
    readonly contactId: number;
    /**
     * The local `YYYY-MM-DD` an empty DAY prefills. Absent for an empty span
     * or month, so the Log form starts at its normal default, now (38.8 D-28).
     */
    readonly prefillDate?: string;
  };
}

/**
 * Build the TYPED LogContact navigation contract for a History "Log
 * interaction" offer (HIST-15). The contact is preselected. An empty day (and
 * the no-history state) passes its date, which the form prefills; an empty
 * cycle span or month passes none — the key is omitted, never an invented date
 * such as the span's end — so the form starts at now (38.8 D-21, D-28). This is
 * the detailed-log route contract — NEVER a quick-log payload.
 */
export function buildLogRoute(
  contactId: number,
  prefillDate?: string,
): LogContactRoute {
  return {
    screen: "LogContact",
    params:
      prefillDate === undefined ? { contactId } : { contactId, prefillDate },
  };
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

/**
 * History's own read state (38.3 RG-024, T-38.3-08-03). History re-reads on
 * every parent Profile revision, so it must tell apart:
 *   - `loading` — nothing has loaded yet (first read or a retry after error);
 *   - `error`   — the first read failed: "Couldn't load history" + Retry, never
 *                 an endless "Loading history…";
 *   - `loaded`  — rows are shown; `refreshError` flags that the LATEST re-read
 *                 failed, so the previous rows stay visible under a compact
 *                 "Couldn't refresh history" + Retry notice (never silent).
 */
export type HistoryReadState<T> =
  | { readonly phase: "loading" }
  | { readonly phase: "error" }
  | {
      readonly phase: "loaded";
      readonly data: T;
      readonly refreshError: boolean;
    };

export function initialHistoryReadState<T>(): HistoryReadState<T> {
  return { phase: "loading" };
}

/** A read begins: a loaded view is kept as-is; otherwise show loading. */
export function historyReadStateOnStart<T>(
  state: HistoryReadState<T>,
): HistoryReadState<T> {
  return state.phase === "loaded" ? state : { phase: "loading" };
}

/** The current read failed: keep loaded rows (flag the notice) or show error. */
export function historyReadStateOnFail<T>(
  state: HistoryReadState<T>,
): HistoryReadState<T> {
  return state.phase === "loaded"
    ? { phase: "loaded", data: state.data, refreshError: true }
    : { phase: "error" };
}

/** The current read succeeded: publish the rows and clear any refresh notice. */
export function historyReadStateOnPublish<T>(
  _state: HistoryReadState<T>,
  data: T,
): HistoryReadState<T> {
  return { phase: "loaded", data, refreshError: false };
}

/**
 * History's day state (38.3 D-12; react-native/AUD-RN-009). `today` is the
 * local date the section last evaluated; `refDate` is the date its window is
 * built around; `followingToday` is the explicit flag — distinct from
 * `refDate` — that says whether the user is viewing the current window.
 *
 * On a new local day a following view advances its window to the new today,
 * while a past window the user picked stays put. Every today-bound limit
 * (next-window navigation, stream day labels, Log prefill, cycles `now`) reads
 * `today`, so it always follows the new day. Day changes are detected only on
 * lifecycle events (mount, Profile revision) — never a timer (D-22). All dates
 * are local `YYYY-MM-DD` strings from `formatLocalDate()`; no UTC slicing.
 */
export interface HistoryDayState {
  readonly today: string;
  readonly refDate: string;
  readonly followingToday: boolean;
}

export function initialHistoryDayState(today: string): HistoryDayState {
  return { today, refDate: today, followingToday: true };
}

/** Re-evaluate "today". Same date → the same object (no re-render churn). */
export function advanceHistoryDay(
  state: HistoryDayState,
  nowLocal: string,
): HistoryDayState {
  if (nowLocal === state.today) return state;
  return state.followingToday
    ? { today: nowLocal, refDate: nowLocal, followingToday: true }
    : { ...state, today: nowLocal };
}

/** A lens change always returns to the current window. */
export function historyDayAfterLensChange(
  state: HistoryDayState,
): HistoryDayState {
  return initialHistoryDayState(state.today);
}

/** Stepping back always leaves the current window. */
export function historyDayAfterPrev(
  state: HistoryDayState,
  prevRef: string,
): HistoryDayState {
  return { today: state.today, refDate: prevRef, followingToday: false };
}

/** Stepping forward follows today again once the window contains today. */
export function historyDayAfterNext(
  state: HistoryDayState,
  lens: DateLens,
  nextRef: string,
): HistoryDayState {
  const window = buildWindow(lens, nextRef, state.today);
  return {
    today: state.today,
    refDate: nextRef,
    followingToday: window.start <= state.today && state.today <= window.end,
  };
}

// --- Cycles paging (38.8 D-25, D-26) ------------------------------------------
// The Cycles lens pages by whole displayed pages (the selected preset count).
// Cycles stay current-cadence spans: a page is the unchanged `cycles()` series
// ending at `refDate` instead of today, so paging only shifts that series and
// never reconstructs historical cadence (`services/history/cycles.ts` is
// unchanged).

/** Shift a local `YYYY-MM-DD` by whole days with local components (never UTC). */
function addLocalDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(y, m - 1, d);
  shifted.setDate(shifted.getDate() + delta);
  return formatLocalDate(shifted);
}

/**
 * The displayed Cycles page: `count` cadence blocks ending at `refDate`.
 * `cycles()` flags its last block current whatever its `now`, so the flag is
 * re-derived here — only the page ending today has a current cycle. A contact
 * with no cadence returns `{ available: false }` (the unchanged guard).
 */
export function pagedCycles(input: {
  readonly intervalDays: number | null;
  readonly trackingEnabled: number;
  readonly count: number;
  readonly today: string;
  readonly refDate: string;
}): CyclesResult {
  const result = cycles({
    intervalDays: input.intervalDays,
    trackingEnabled: input.trackingEnabled,
    count: input.count,
    now: input.refDate,
  });
  if (!result.available) return result;
  const onToday = input.refDate === input.today;
  return {
    available: true,
    blocks: result.blocks.map((block) => ({
      ...block,
      isCurrent: onToday && block.index === input.count - 1,
    })),
  };
}

/** One page back: the page ending the day before the shown page's first block. */
export function cyclesPrevRef(blocks: readonly CycleBlock[]): string {
  return addLocalDays(blocks[0].start, -1);
}

/** One page forward, never past today. */
export function cyclesNextRef(input: {
  readonly refDate: string;
  readonly intervalDays: number;
  readonly count: number;
  readonly today: string;
}): string {
  const next = addLocalDays(input.refDate, input.count * input.intervalDays);
  return next < input.today ? next : input.today;
}

/** Stepping forward in Cycles follows today again once the page ends today. */
export function historyDayAfterCyclesNext(
  state: HistoryDayState,
  nextRef: string,
): HistoryDayState {
  return {
    today: state.today,
    refDate: nextRef,
    followingToday: nextRef === state.today,
  };
}

/**
 * A globally persisted History preference (lens / cycle preset) as one mounted
 * History holds it (38.3 review A-WR-08). History re-reads settings on every
 * Profile revision; re-publishing the persisted value from each read let a
 * read that started before the settings write committed revert the user's
 * choice, and a failed write was silently reverted by the next re-read.
 *
 * `userGen` is a monotonic count of local choices (never reset, so a late
 * failure of an old write can never match a newer choice). `held` is true
 * while a local choice is outstanding; only when it is false may a read adopt
 * the persisted value.
 */
export interface PersistedPref<T> {
  readonly value: T;
  readonly userGen: number;
  readonly held: boolean;
}

export function initialPersistedPref<T>(value: T): PersistedPref<T> {
  return { value, userGen: 0, held: false };
}

/** A read adopts the persisted value only while no local choice is held. */
export function persistedPrefOnRead<T>(
  pref: PersistedPref<T>,
  persisted: T,
): PersistedPref<T> {
  return pref.held ? pref : { ...pref, value: persisted };
}

/** A local choice wins over every later read in this mount. */
export function persistedPrefOnUserChange<T>(
  pref: PersistedPref<T>,
  next: T,
): PersistedPref<T> {
  return { value: next, userGen: pref.userGen + 1, held: true };
}

/**
 * The write for choice `gen` failed. If no newer choice superseded it, revert
 * to `previous` explicitly and let reads adopt the persisted truth again.
 */
export function persistedPrefOnWriteFailed<T>(
  pref: PersistedPref<T>,
  gen: number,
  previous: T,
): PersistedPref<T> {
  return pref.held && pref.userGen === gen
    ? { value: previous, userGen: pref.userGen, held: false }
    : pref;
}
