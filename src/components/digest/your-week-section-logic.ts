import type { YourWeekPeriod } from "@/db/app-settings-dao";
import type { YourWeekDateCount, YourWeekDayRow } from "@/db/your-week-read";
import type { HistoryWindow } from "@/services/history/window";
import { createLatestRequestAuthority } from "@/utils/latest-request";

export interface YourWeekControllerState {
  readonly period: YourWeekPeriod;
  readonly persistedPeriod: YourWeekPeriod;
  readonly generation: number;
  readonly pendingPeriod: YourWeekPeriod | null;
  readonly selectedDay: string | null;
  /**
   * The period a Digest toggle is persisting right now (38.3 RESEARCH
   * Pitfall 5). While set, a refresh never adopts the DB period, so a refresh
   * can never revert a toggle whose write is still in flight.
   */
  readonly writingPeriod: YourWeekPeriod | null;
}

export function initialYourWeekState(
  period: YourWeekPeriod = "rolling7",
): YourWeekControllerState {
  return {
    period,
    persistedPeriod: period,
    generation: 0,
    pendingPeriod: null,
    selectedDay: null,
    writingPeriod: null,
  };
}

export function selectYourWeekPeriod(
  state: YourWeekControllerState,
  period: YourWeekPeriod,
): YourWeekControllerState {
  return {
    ...state,
    period,
    generation: state.generation + 1,
    pendingPeriod: period,
    selectedDay: null,
  };
}

/** A Digest toggle: `selectYourWeekPeriod` plus the in-flight write marker. */
export function beginYourWeekPeriodWrite(
  state: YourWeekControllerState,
  period: YourWeekPeriod,
): YourWeekControllerState {
  return { ...selectYourWeekPeriod(state, period), writingPeriod: period };
}

/**
 * Refresh-time period resolution (38.3 D-15): the chosen period is KEPT; a
 * period changed elsewhere (Settings, the other `yourWeekPeriod` writer) is
 * adopted only when ALL hold:
 * - the DB value differs from what this controller last knew was persisted;
 * - no toggle write is in flight (`writingPeriod === null`);
 * - the controller generation is unchanged since the settings read BEGAN
 *   (`readGeneration`), so a read that began before a toggle can never revert
 *   it — correctness does not rely on the single in-order SQLite connection.
 */
export function resolveYourWeekRefreshPeriod(
  state: YourWeekControllerState,
  persistedFromDb: YourWeekPeriod,
  readGeneration: number,
): { state: YourWeekControllerState; adopted: boolean } {
  if (
    persistedFromDb === state.persistedPeriod ||
    state.writingPeriod !== null ||
    state.generation !== readGeneration
  ) {
    return { state, adopted: false };
  }
  return {
    state: {
      ...selectYourWeekPeriod(state, persistedFromDb),
      persistedPeriod: persistedFromDb,
    },
    adopted: true,
  };
}

/** True only for a real (non-placeholder) cell carrying `day`. */
export function isYourWeekDayInWindow(
  window: HistoryWindow,
  day: string,
): boolean {
  return window.cells.some((cell) => !cell.isPlaceholder && cell.date === day);
}

/**
 * Re-window retention (D-15; D-26 planner call): a selected day survives a new
 * local day or a tab return only while it is still a real day in the window.
 */
export function retainYourWeekDay(
  state: YourWeekControllerState,
  window: HistoryWindow,
): YourWeekControllerState {
  if (state.selectedDay === null) return state;
  if (isYourWeekDayInWindow(window, state.selectedDay)) return state;
  return { ...state, selectedDay: null };
}

export function reconcileYourWeekRead(
  state: YourWeekControllerState,
  generation: number,
): { state: YourWeekControllerState; accepted: boolean } {
  if (generation !== state.generation) return { state, accepted: false };
  return { state: { ...state, pendingPeriod: null }, accepted: true };
}

export function persistYourWeekPeriodAccepted(
  state: YourWeekControllerState,
  generation: number,
): YourWeekControllerState {
  if (generation !== state.generation) return state;
  return {
    ...state,
    persistedPeriod: state.period,
    pendingPeriod: null,
    writingPeriod: null,
  };
}

export function persistYourWeekPeriodRejected(
  state: YourWeekControllerState,
  generation: number,
): YourWeekControllerState {
  if (generation !== state.generation) return state;
  return {
    ...state,
    period: state.persistedPeriod,
    generation: state.generation + 1,
    pendingPeriod: null,
    selectedDay: null,
    writingPeriod: null,
  };
}

export interface YourWeekPeriodReaderDeps<T> {
  getState(): YourWeekControllerState;
  /** A current read whose period intent still holds (reconciled state). */
  accept(state: YourWeekControllerState, result: T): void;
  /** A current read failed while its period intent still holds. */
  fail(cause: unknown): void;
}

export interface YourWeekPeriodReader<T> {
  load(generation: number, read: () => Promise<T>): Promise<void>;
  /** Retire every outstanding read (unmount). */
  invalidate(): void;
}

/**
 * One request-scoped authority for EVERY Your Week period read — the Digest
 * refresh signal, a manual toggle and a rollback (38.3 RG-026). The most
 * recently BEGUN read wins; the generation check stays only as the
 * period-intent guard (`reconcileYourWeekRead`).
 */
export function createYourWeekPeriodReader<T>(
  deps: YourWeekPeriodReaderDeps<T>,
): YourWeekPeriodReader<T> {
  const authority = createLatestRequestAuthority();
  return {
    async load(generation, read) {
      const token = authority.begin();
      let result: T;
      try {
        result = await read();
      } catch (cause) {
        if (
          authority.isCurrent(token) &&
          generation === deps.getState().generation
        ) {
          deps.fail(cause);
        }
        return;
      }
      if (!authority.isCurrent(token)) return;
      const reconciled = reconcileYourWeekRead(deps.getState(), generation);
      if (!reconciled.accepted) return;
      deps.accept(reconciled.state, result);
    },
    invalidate: () => authority.invalidate(),
  };
}

export function selectYourWeekDay(
  state: YourWeekControllerState,
  date: string | null,
): YourWeekControllerState {
  return { ...state, selectedDay: date };
}

/**
 * Selected-day detail (38.3 D-16; reliability-testing/AUD-REL-014; closes
 * Phase 38 WR-01). A pending or failed read is never shown as "No activity":
 * only `loaded` with zero rows is a truthful empty day.
 *
 * The stale guard is REQUEST-scoped, not date-only: every read (tap, Retry, a
 * refresh that retained the day) starts with a fresh token, and only the
 * current `loading` token may settle or fail — so an older read for the SAME
 * date can never publish over a newer one.
 */
export type YourWeekDayDetail =
  | { readonly status: "idle" }
  | {
      readonly status: "loading";
      readonly date: string;
      readonly token: number;
    }
  | {
      readonly status: "loaded";
      readonly date: string;
      readonly rows: readonly YourWeekDayRow[];
    }
  | { readonly status: "error"; readonly date: string };

export function clearDayDetail(): YourWeekDayDetail {
  return { status: "idle" };
}

export function startDayRead(
  _state: YourWeekDayDetail,
  date: string,
  token: number,
): YourWeekDayDetail {
  return { status: "loading", date, token };
}

export function settleDayRead(
  state: YourWeekDayDetail,
  token: number,
  rows: readonly YourWeekDayRow[],
): YourWeekDayDetail {
  if (state.status !== "loading" || state.token !== token) return state;
  return { status: "loaded", date: state.date, rows };
}

export function failDayRead(
  state: YourWeekDayDetail,
  token: number,
): YourWeekDayDetail {
  if (state.status !== "loading" || state.token !== token) return state;
  return { status: "error", date: state.date };
}

export function directDateCounts(
  window: HistoryWindow,
  rows: readonly YourWeekDateCount[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const cell of window.cells) {
    if (cell.date !== null && !cell.isPlaceholder) counts.set(cell.date, 0);
  }
  for (const row of rows) {
    if (counts.has(row.d)) counts.set(row.d, row.n);
  }
  return counts;
}
