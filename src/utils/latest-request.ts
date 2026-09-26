/**
 * Latest-request authority (38.3 D-23; react-native/AUD-RN-010).
 *
 * A monotonic generation counter that decides which in-flight async read is
 * still allowed to publish. It generalizes the `generation` idiom in
 * `src/hooks/use-category-catalog-refresh.ts` so every screen controller shares
 * one node-tested guard instead of per-effect `cancelled` closures (the RN-010
 * root cause: an older read resolving after a newer one overwrote it).
 *
 * Usage contract — callers MUST gate EVERY publication on `isCurrent(token)`:
 * rows, counts, error flags AND loading/refreshing settles. Gating only the
 * success path (as the category coordinator's `reportFailure` does not) lets a
 * stale failure paint an error over fresh data.
 *
 *   const token = authority.begin();
 *   try {
 *     const rows = await read();
 *     if (authority.isCurrent(token)) publish(rows);
 *   } catch {
 *     if (authority.isCurrent(token)) publishError();
 *   } finally {
 *     if (authority.isCurrent(token)) settleLoading();
 *   }
 *
 * Call `invalidate()` on blur/unmount so nothing outstanding publishes into a
 * hidden or dead consumer. Pure: no React, no react-native, no timers.
 */
export interface LatestRequestAuthority {
  /** Start a request; returns its token. Every older token stops being current. */
  begin(): number;
  /** True only for the most recent token, and only until `invalidate()`. */
  isCurrent(token: number): boolean;
  /** Make every outstanding token non-current (blur/unmount). */
  invalidate(): void;
}

export function createLatestRequestAuthority(): LatestRequestAuthority {
  let generation = 0;
  return {
    begin: () => {
      generation += 1;
      return generation;
    },
    isCurrent: (token) => token === generation,
    invalidate: () => {
      generation += 1;
    },
  };
}
