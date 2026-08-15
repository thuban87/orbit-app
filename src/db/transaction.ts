/**
 * The SINGLE shared write-transaction primitive (DATA-04; review LOW / HIGH-1).
 *
 * `inWriteTransaction` composes the ONE shared `withMutex` (mutex.ts) with a
 * hand-rolled `BEGIN` / try `COMMIT` / catch best-effort `ROLLBACK` + re-throw of
 * the ORIGINAL error. It was extracted VERBATIM from recency-dao.ts so every
 * Phase-3 writer IMPORTS it instead of re-copying it — one place to hold the
 * no-nesting rule, because four copies is four places to forget it (which is
 * exactly how the sweep-deadlock, review HIGH-1, arose).
 *
 * =============================================================================
 * NON-REENTRANCY — READ BEFORE CALLING (structural fix for the sweep-deadlock):
 *   `withMutex` (mutex.ts:32-36) is a NON-REENTRANT single promise chain
 *   (`const run = chain.then(fn, fn); chain = run.catch(...)`). A function already
 *   running inside `inWriteTransaction` must NEVER call another
 *   `inWriteTransaction` (or `withMutex`) — the inner acquisition queues behind
 *   the outer's settlement while the outer awaits the inner: a PERMANENT hang.
 *
 *   To COMPOSE two transactional operations, do NOT nest. Extract a NON-mutexed
 *   transaction-body core (a plain `async (exec) => {...}` that assumes BEGIN is
 *   already open) and call that core inside the ONE outer `inWriteTransaction`
 *   (see Plan 03's `deleteOrQuarantineField`). The mutex + BEGIN/COMMIT wrap the
 *   OUTERMOST operation only.
 *
 *   NEVER use expo `withTransactionAsync` / `withExclusiveTransactionAsync`
 *   (RESEARCH P3/P4): they issue a DEFERRED BEGIN on the shared connection —
 *   capturing unrelated concurrent writes — and mask the original error on a
 *   throwing rollback.
 * =============================================================================
 *
 * Node-pure control flow: depends only on `withMutex` and the `SqlExecutor`
 * contract, so it is exercised node-side via the node:sqlite adapter.
 */
import { withMutex } from "@/db/mutex";
import type { SqlExecutor } from "@/db/types";

/**
 * Run `body` inside the shared mutex and a hand-rolled transaction. COMMIT on
 * success; ROLLBACK (best-effort) and re-throw the ORIGINAL error on failure.
 * See the non-reentrancy note above — never call this from inside itself.
 */
export function inWriteTransaction<T>(
  exec: SqlExecutor,
  body: () => Promise<T>,
): Promise<T> {
  return withMutex(async () => {
    await exec.execAsync("BEGIN");
    try {
      const value = await body();
      await exec.execAsync("COMMIT");
      return value;
    } catch (error) {
      await exec.execAsync("ROLLBACK").catch(() => {});
      throw error;
    }
  });
}
