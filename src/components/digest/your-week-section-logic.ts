import type { YourWeekPeriod } from "@/db/app-settings-dao";
import type { YourWeekDateCount } from "@/db/your-week-read";
import type { HistoryWindow } from "@/services/history/window";

export interface YourWeekControllerState {
  readonly period: YourWeekPeriod;
  readonly persistedPeriod: YourWeekPeriod;
  readonly generation: number;
  readonly pendingPeriod: YourWeekPeriod | null;
  readonly selectedDay: string | null;
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
  return { ...state, persistedPeriod: state.period, pendingPeriod: null };
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
  };
}

export function selectYourWeekDay(
  state: YourWeekControllerState,
  date: string | null,
): YourWeekControllerState {
  return { ...state, selectedDay: date };
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
