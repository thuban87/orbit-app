/**
 * One bulk import pass per session at a time (38.4 D-74, owner).
 *
 * `runImportBatch` reads the session's pending rows once, up front, then works
 * through that snapshot. Two passes over one session therefore both claim the
 * same rows. Leaving Import Progress used to let a pass keep running in the
 * background while bulk setup's Continue started a second one. Import
 * Progress now blocks Back while a pass runs; this in-memory guard is the
 * backstop so no route can start a second pass: a later caller is refused,
 * and a screen can follow the pass already in flight instead.
 *
 * In-memory on purpose: a pass lives only as long as the JS process, so a
 * process kill clears the mark along with the pass itself.
 */

export type ImportRunProgress = (done: number, total: number) => void;

interface ActiveImportRun {
  settled: Promise<unknown>;
  listeners: Set<ImportRunProgress>;
  last: [number, number] | null;
}

const activeRuns = new Map<number, ActiveImportRun>();

/** Thrown when a pass is requested while one is already running (D-74). */
export class ImportRunActiveError extends Error {
  constructor(readonly sessionId: number) {
    super(`import session ${sessionId} already has a pass running`);
    this.name = "ImportRunActiveError";
  }
}

/** True while a bulk import pass for `sessionId` is in flight. */
export function isImportRunActive(sessionId: number): boolean {
  return activeRuns.has(sessionId);
}

/**
 * Run `work` as the only pass for `sessionId`. The session is marked before
 * `work` first awaits and released when it settles (success or failure). A
 * call while a pass is in flight rejects with {@link ImportRunActiveError} and
 * never starts `work`. `work` receives a reporter that relays its progress to
 * any follower.
 */
export function withImportRun<T>(
  sessionId: number,
  work: (report: ImportRunProgress) => Promise<T>,
): Promise<T> {
  if (activeRuns.has(sessionId)) {
    return Promise.reject(new ImportRunActiveError(sessionId));
  }
  const run: ActiveImportRun = {
    settled: Promise.resolve(),
    listeners: new Set(),
    last: null,
  };
  const report: ImportRunProgress = (done, total) => {
    run.last = [done, total];
    for (const listener of run.listeners) listener(done, total);
  };
  activeRuns.set(sessionId, run);
  const result = (async () => {
    try {
      return await work(report);
    } finally {
      if (activeRuns.get(sessionId) === run) activeRuns.delete(sessionId);
    }
  })();
  run.settled = result;
  return result;
}

/**
 * Follow the pass in flight for `sessionId`: relay its last known and later
 * progress to `onProgress`, and settle when it does (rejecting with its
 * failure). Returns null when no pass is running.
 */
export function followImportRun(
  sessionId: number,
  onProgress?: ImportRunProgress,
): Promise<void> | null {
  const run = activeRuns.get(sessionId);
  if (!run) return null;
  if (onProgress) {
    run.listeners.add(onProgress);
    if (run.last) onProgress(run.last[0], run.last[1]);
  }
  return run.settled
    .then(() => undefined)
    .finally(() => {
      if (onProgress) run.listeners.delete(onProgress);
    });
}
