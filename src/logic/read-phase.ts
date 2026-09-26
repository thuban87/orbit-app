/**
 * Read-phase tri-state (38.3 RG-035; ui-accessibility/AUD-UIA-012, D-24).
 *
 * A screen that reads before it renders must keep pending, failed, empty and
 * successful outcomes distinguishable. The audited failure mode was a single
 * `data | null` slot (or a catch that published `[]`) standing in for all of
 * them, so a pending or failed read rendered as "Off", "nothing here", or an
 * editor over an empty list.
 *
 * Invariant (the digest.md invariant-6 principle applied generally): empty and
 * success copy render ONLY from `loaded`. `loading` renders a loading state and
 * `error` renders a read-error state with Retry — never a known value.
 *
 * Callers pair this with `createLatestRequestAuthority()` (src/utils/latest-
 * request.ts, D-23) so only the current request may change the phase; the
 * `ReadGate` below is its structural subset, keeping this module import-free.
 *
 * Re-read contract: a re-read started from `loaded` keeps the loaded view until
 * it settles (`readStarted`), then moves to `loaded` or `error`. A failed
 * re-read — including one after a committed write — lands in `error`, never
 * back on the stale view and never in the write's own failure path (D-04).
 * Pure: no React, no react-native, no timers.
 */

export type ReadPhase<T> =
  | { readonly phase: "loading" }
  | { readonly phase: "loaded"; readonly data: T }
  | { readonly phase: "error" };

export type ReadPhaseUpdate<T> = (current: ReadPhase<T>) => ReadPhase<T>;

export function readLoading<T>(): ReadPhase<T> {
  return { phase: "loading" };
}

export function readLoaded<T>(data: T): ReadPhase<T> {
  return { phase: "loaded", data };
}

export function readFailed<T>(): ReadPhase<T> {
  return { phase: "error" };
}

/** Begin a read: a loaded view is kept until the read settles; otherwise loading. */
export function readStarted<T>(current: ReadPhase<T>): ReadPhase<T> {
  return current.phase === "loaded" ? current : readLoading();
}

/** The loaded data, or null while unknown (loading / error). */
export function loadedData<T>(phase: ReadPhase<T>): T | null {
  return phase.phase === "loaded" ? phase.data : null;
}

/** Structural subset of `LatestRequestAuthority` (src/utils/latest-request.ts). */
export interface ReadGate {
  begin(): number;
  isCurrent(token: number): boolean;
}

export interface GatedReadDeps<T> {
  readonly gate: ReadGate;
  readonly read: () => Promise<T>;
  /** Receives functional updates — pass a React `setState` directly. */
  readonly publish: (update: ReadPhaseUpdate<T>) => void;
  /** Called only for the CURRENT request's success (e.g. seed form fields). */
  readonly onLoaded?: (data: T) => void;
  /** Diagnostic only; called for every failure, current or stale. */
  readonly onError?: (error: unknown) => void;
}

/**
 * Run one authority-gated read. NEVER rejects: a failure lands in the `error`
 * phase, so a caller awaiting it after a committed write can never route a
 * read failure into the write's catch. Resolves the phase it published, or
 * `null` when the request went stale (a newer read or `invalidate()` won).
 */
export async function runGatedRead<T>(
  deps: GatedReadDeps<T>,
): Promise<ReadPhase<T> | null> {
  const token = deps.gate.begin();
  deps.publish(readStarted);
  let next: ReadPhase<T>;
  try {
    next = readLoaded(await deps.read());
  } catch (error) {
    deps.onError?.(error);
    next = readFailed();
  }
  if (!deps.gate.isCurrent(token)) return null;
  deps.publish(() => next);
  if (next.phase === "loaded") deps.onLoaded?.(next.data);
  return next;
}
