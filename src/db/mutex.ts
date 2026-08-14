/**
 * Shared write-serialization mutex (DATA-04).
 *
 * ONE module-level promise chain per JS runtime. `withMutex` queues each wrapped
 * operation so it starts only after the previous one has settled, guaranteeing
 * that at most one `last_contact` write transaction is in flight at a time.
 *
 * Why this exists (RESEARCH Pitfall P4 — transaction capture): the app's
 * foreground code and its Phase-11/12 headless widget/notification taps share
 * ONE process and ONE expo-sqlite connection. expo's `withTransactionAsync` uses
 * a DEFERRED `BEGIN` on that shared connection, so an unrelated async write
 * landing mid-transaction is merged into — and rolled back with — the foreground
 * transaction. Serializing every recency write through this single mutex (and
 * hand-rolling each DAO transaction, never expo's wrapper) removes that race.
 *
 * Both the foreground entry points AND the headless entry points import THIS
 * module, so they share the one instance — do not construct per-caller mutexes,
 * and do not add `async-mutex` or any dependency (RESEARCH rejects it; the
 * primitive is four lines).
 */

/** The tail of the serialization chain. Reassigned on every `withMutex` call. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Queue `fn` behind any in-flight operation and return its result. `fn` runs
 * regardless of whether the prior operation resolved or rejected (`.then(fn, fn)`),
 * and a rejection of `fn` never breaks the chain for later callers
 * (`chain = run.catch(() => {})`), while the rejection still propagates to THIS
 * caller via the returned `run`.
 */
export function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn) as Promise<T>;
  chain = run.catch(() => {});
  return run;
}
