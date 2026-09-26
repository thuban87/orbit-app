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
 * TRUE only when the contact has NONE of the three record families the History
 * section surfaces: zero interactions AND no lifecycle records AND no
 * history-aware knowledge changes. A contact with only ONE family populated is
 * NOT empty — a lifecycle-only contact (via Plan 03's `hasLifecycleRecords`
 * discriminator) and a knowledge-change-only contact (edited fields but zero
 * interactions/lifecycle) both show the zero-count Heatmap/Browser surfaces and
 * their DateDetailSheet rows, never the empty section. Omitting `knowledgeChanges`
 * here wrongly hid the third family's rows behind "No history yet" (dossier: the
 * three record families are preserved; item #13).
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
 * (next-window navigation, Rolodex max day, Log prefill, cycles `now`) reads
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
