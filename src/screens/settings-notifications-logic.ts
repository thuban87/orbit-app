import type { AppSettings, AppSettingsPatch } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";

/**
 * The injectable collaborators of {@link persistNotificationSettings}. Extracted
 * as explicit deps so the reconcile-on-write path is unit-testable with mocked
 * DAO + reconcilers (ordering, both-fire, and failure) rather than only asserted
 * by source text. The production wiring passes the real
 * `updateAppSettings` / `getAppSettings` (app-settings-dao),
 * `reconcileSchedule` (notification-schedule),
 * `reconcileDigestSchedule` (digest-schedule), and `localDateTime` for `now`.
 */
export interface PersistNotificationDeps {
  updateAppSettings: (
    exec: SqlExecutor,
    patch: AppSettingsPatch,
    now: string,
  ) => Promise<void>;
  getAppSettings: (exec: SqlExecutor) => Promise<AppSettings>;
  reconcileSchedule: (exec: SqlExecutor) => Promise<void>;
  reconcileDigestSchedule: (exec: SqlExecutor) => Promise<void>;
  now: () => string;
}

/**
 * The shared notification/digest reconcile-on-write helper (Phase 37 §G),
 * extracted from the monolith's inline `persist()` (SettingsScreen.tsx) so every
 * notification write routes through one tested path.
 *
 * On a settings change it:
 *   1. writes the patch via `updateAppSettings(exec, patch, now())`;
 *   2. re-reads the durable state via `getAppSettings`;
 *   3. triggers BOTH `reconcileSchedule` and `reconcileDigestSchedule`
 *      immediately (fire-and-forget via `void`, matching the shipped monolith —
 *      NOT awaited) so the OS schedule re-arms on change rather than waiting for
 *      next launch (RESEARCH Pitfall 5);
 *   4. RETURNS the fresh `AppSettings` from the re-read so the caller can publish
 *      it into local state (review MEDIUM #2 — the re-read must not be discarded,
 *      or controls show stale values after a successful write).
 *
 * Failure ownership (review MEDIUM, cycle-3): a failing `updateAppSettings`
 * REJECTS out of this helper. It does NOT catch/swallow/log-and-continue — the
 * reconcilers never fire and no stale value is returned. The CALLER (the screen)
 * is the single place that owns and renders the error.
 */
export async function persistNotificationSettings(
  exec: SqlExecutor,
  patch: AppSettingsPatch,
  deps: PersistNotificationDeps,
): Promise<AppSettings> {
  // Write first. A rejection propagates (we do not catch) so the reconcilers and
  // the re-read below never run on a failed write.
  await deps.updateAppSettings(exec, patch, deps.now());
  // Re-read the durable state; the caller publishes this so controls reflect the
  // write (not a stale value).
  const next = await deps.getAppSettings(exec);
  // Both reconcilers fire immediately, fire-and-forget (NOT awaited), matching
  // the shipped monolith so the OS schedule re-arms on this change.
  void deps.reconcileSchedule(exec);
  void deps.reconcileDigestSchedule(exec);
  return next;
}
