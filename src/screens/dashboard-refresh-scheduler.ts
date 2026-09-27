/**
 * Dashboard (Contacts Home) refresh scheduler + single publication seam
 * (38.3 RG-022; recorded call D-23; owner ruling D-14 applied to Home;
 * performance/AUD-PERF-002, react-native/AUD-RN-010).
 *
 * ONE scheduler owns every Home read:
 * - `request(source)` issues a read with a latest-request token, or returns
 *   `null` for a shell / foreground request while Home is hidden. A hidden
 *   refresh is never run in the background: the next Home focus read covers it
 *   (D-23).
 * - `isCurrent(token)` is the only publication authority. An older read can
 *   never overwrite a newer one, whichever source issued either.
 * - `invalidate()` retires every outstanding token (unmount).
 *
 * `publishDashboardRead` is the ONLY place a read's result reaches Home's state:
 * rows, line-3, search matches, `listNow`, counts, population counts, error,
 * the result-fade start, the result-animation generation and the
 * refreshing/initial-load settle all go through one `isCurrent` check, so no
 * individual setter can publish stale data on its own.
 *
 * Pure: no React, no react-native, no timers (D-22). The optional `log` hook
 * receives only the trigger label (content-free), so a device run can count
 * read bundles.
 */
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { isForegroundVisible } from "@/utils/screen-visibility";

/**
 * Every trigger that may issue a Home read. `favourite` is the committed star
 * toggle (38.3 REVIEW A-WR-05 / VERIFICATION W4, 38.4 D-10): it is requested
 * only after the favourite write commits, so its newer token retires any
 * in-flight stale read that could otherwise revert the star, and it re-reads
 * the population counts. It is NOT deferrable — the toggle is a user action on
 * a visible Home.
 */
export type DashboardRefreshSource =
  | "focus"
  | "shell"
  | "foreground"
  | "pull"
  | "snooze"
  | "favourite";

/**
 * The result-fade start for one read (0 animates in, 1 settles instantly). A
 * `favourite` read always settles at 1 so a star tap never re-fades the whole
 * list (38.3 A-WR-05, D-10); every other source keeps the existing rule — 0
 * only when Home may animate (focused, app active, reduced motion off).
 */
export function dashboardFadeStart(
  source: DashboardRefreshSource,
  canAnimate: boolean,
): number {
  if (source === "favourite") return 1;
  return canAnimate ? 0 : 1;
}

/** Sources deferred to the next focus read while Home is hidden (D-23). */
const DEFERRABLE_WHILE_HIDDEN: ReadonlySet<DashboardRefreshSource> = new Set([
  "shell",
  "foreground",
]);

/**
 * Home's visibility for the scheduler (38.3 review A-WR-01, D-23). Delegates to
 * the shared `isForegroundVisible` rule (38.4 D-10, 38.3 VERIFICATION W2), which
 * Digest and Profile now use too: focused AND not `background`, over the
 * synchronous `AppState.currentState`; `inactive` still reads.
 */
export function isDashboardVisible(
  focused: boolean,
  appState: string | null | undefined,
): boolean {
  return isForegroundVisible(focused, appState);
}

export interface DashboardRefreshScheduler {
  /** Issue a read and return its token, or `null` when deferred while hidden. */
  request(source: DashboardRefreshSource): number | null;
  /** True only for the most recently issued read, until `invalidate()`. */
  isCurrent(token: number): boolean;
  /** Retire every outstanding token (unmount). */
  invalidate(): void;
}

export function createDashboardRefreshScheduler(input: {
  /** The single read body. Must publish only through `publishDashboardRead`. */
  read: (token: number, source: DashboardRefreshSource) => void;
  /** Whether Home is currently shown (focused). */
  isVisible: () => boolean;
  /** Called once per issued read with its trigger label only. */
  log?: (source: DashboardRefreshSource) => void;
}): DashboardRefreshScheduler {
  const authority = createLatestRequestAuthority();
  return {
    request(source) {
      if (DEFERRABLE_WHILE_HIDDEN.has(source) && !input.isVisible()) {
        return null;
      }
      const token = authority.begin();
      input.log?.(source);
      input.read(token, source);
      return token;
    },
    isCurrent: (token) => authority.isCurrent(token),
    invalidate: () => authority.invalidate(),
  };
}

/** What one Home read produced. The error shape carries no data by design. */
export type DashboardReadOutcome<
  TRow,
  TLine3,
  TMatch,
  TCounts,
  TPopulationCounts,
> =
  | {
      kind: "ok";
      rows: TRow[];
      line3: ReadonlyMap<number, TLine3>;
      searchMatches: ReadonlyMap<number, TMatch | null>;
      listNow: string;
      counts: TCounts;
      populationCounts: TPopulationCounts;
      /** Result-fade start value (0 animates in, 1 settles instantly). */
      fadeStart: number;
    }
  | { kind: "error" };

/** Every Home publication a read can make — nothing else may be set by a read. */
export interface DashboardReadSinks<
  TRow,
  TLine3,
  TMatch,
  TCounts,
  TPopulationCounts,
> {
  setRows(rows: TRow[]): void;
  setLine3(line3: ReadonlyMap<number, TLine3>): void;
  setSearchMatches(matches: ReadonlyMap<number, TMatch | null>): void;
  setListNow(now: string): void;
  setCounts(counts: TCounts): void;
  setPopulationCounts(counts: TPopulationCounts): void;
  setError(error: boolean): void;
  /** Assigns the result-fade shared value's start. */
  setFadeStart(value: number): void;
  bumpResultGeneration(): void;
  setRefreshing(refreshing: boolean): void;
  setInitialLoad(initialLoad: boolean): void;
}

/**
 * Publish one read's outcome AND its settle, or nothing at all when `token` is
 * no longer current. Returns whether it published.
 */
export function publishDashboardRead<
  TRow,
  TLine3,
  TMatch,
  TCounts,
  TPopulationCounts,
>({
  token,
  outcome,
  isCurrent,
  sinks,
}: {
  token: number;
  outcome: DashboardReadOutcome<
    TRow,
    TLine3,
    TMatch,
    TCounts,
    TPopulationCounts
  >;
  isCurrent: (token: number) => boolean;
  sinks: DashboardReadSinks<TRow, TLine3, TMatch, TCounts, TPopulationCounts>;
}): boolean {
  if (!isCurrent(token)) return false;
  if (outcome.kind === "ok") {
    sinks.setRows(outcome.rows);
    sinks.setLine3(outcome.line3);
    sinks.setSearchMatches(outcome.searchMatches);
    sinks.setListNow(outcome.listNow);
    sinks.setCounts(outcome.counts);
    sinks.setPopulationCounts(outcome.populationCounts);
    sinks.setError(false);
    sinks.setFadeStart(outcome.fadeStart);
    sinks.bumpResultGeneration();
  } else {
    sinks.setRows([]);
    sinks.setLine3(new Map());
    sinks.setSearchMatches(new Map());
    sinks.setError(true);
  }
  sinks.setRefreshing(false);
  sinks.setInitialLoad(false);
  return true;
}
