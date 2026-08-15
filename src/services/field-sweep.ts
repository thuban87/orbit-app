/**
 * Launch-time quarantine-expiry + field_history-retention sweep (FLD-05) — the
 * DATA-06 launch-sweep registry's INTENDED first consumer.
 *
 * Nothing watches a timestamp (SQLite has no scheduler; triggers fire only on
 * data events — CLAUDE.md §14). So quarantine expiry and history retention run
 * as a SWEEP at real foreground launch: `registerFieldSweep` pushes one
 * idempotent hook onto the Phase-2 registry (`registerSweepHook`), and the
 * DATA-06 launch path (App.tsx → installSweepTrigger) fires it. A field
 * quarantined past the FIXED 30-day window is permanently dropped (its values
 * snapshotted to `field_history` first — the only recovery mechanism); the
 * `field_history` table itself is pruned on the same 30-day schedule.
 *
 * =============================================================================
 * CONCURRENCY — READ BEFORE EDITING (review HIGH-1 / cycle-2 sweep-TOCTOU):
 *   The per-def loop calls Plan 03's `expireFieldIfStale` DIRECTLY and must
 *   NEVER wrap it in a second `withMutex` / `inWriteTransaction`.
 *   `expireFieldIfStale` ALREADY owns one `inWriteTransaction`; `withMutex`
 *   (mutex.ts:32-36) is NON-REENTRANT, so a nested acquisition queues behind the
 *   outer's settlement while the outer awaits the inner — a PERMANENT hang that
 *   leaves the registry's `running=true` and wedges EVERY later phase's hook
 *   (archived purge, schedule reconcile, backup rotation). This is the phase's
 *   one clear must-fix defect (HIGH-1).
 *
 *   The candidate SELECT is a BARE read that only NARROWS the set. The
 *   AUTHORITATIVE staleness check happens AGAIN under the lock inside
 *   `expireFieldIfStale`, which re-reads `quarantined_at` and honours a
 *   `restoreField` that committed after the scan — so a field restored between
 *   the scan and its drop SURVIVES (cycle-2 sweep-TOCTOU). The candidate scan and
 *   the under-lock re-check share ONE `windowModifier` and the SAME strict `<`
 *   boundary.
 *
 *   Each `expireFieldIfStale` call sits in its OWN try/catch so one failed or
 *   skipped drop neither aborts the loop nor skips the history prune
 *   (`runLaunchSweep` does not isolate hook-internal failures itself). The prune
 *   runs INSIDE `inWriteTransaction` — a serialized sweep write, never a bare
 *   DELETE an overlapping transaction could capture (cycle-2 MED).
 * =============================================================================
 *
 * Node-pure: takes the executor lazily via `getExec` (so registration can happen
 * before the DB handle is materialised) and imports the shared
 * `inWriteTransaction` — it owns NO expo / react-native binding, so the whole
 * sweep is exercised node-side via the node:sqlite adapter.
 */
import { expireFieldIfStale } from "@/db/field-ddl";
import type { CustomFieldDef } from "@/db/field-types";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";

/**
 * The quarantine + history-retention window, in days. FIXED (owner 2026-08-14) —
 * NOT user-configurable, no settings surface. A single top-of-file tunable so a
 * policy change is a one-number edit.
 */
export const QUARANTINE_WINDOW_DAYS = 30;

/** The identifying slice of a def the candidate scan needs to drive a drop. */
type StaleCandidate = Pick<CustomFieldDef, "id" | "col_name">;

/**
 * Local wall-clock `YYYY-MM-DD HH:MM:SS` stamp for the snapshot rows the sweep
 * writes — local components only, never `toISOString()` (the UTC evening
 * off-by-one, dates.ts convention). Mirrors `database.localDateTime` but lives
 * here so the service takes no expo-coupled import and stays node-pure.
 */
function localNow(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${formatLocalDate(date)} ${hh}:${mm}:${ss}`;
}

/**
 * Register the launch-time field sweep on the Phase-2 registry. The hook takes
 * the executor lazily (`getExec`) so registration can precede DB materialisation,
 * and `now` is injectable so tests drive it with a fixed clock. Registering
 * pushes ONE idempotent hook; a re-run finds no still-stale defs, so it is safe
 * to run twice.
 */
export function registerFieldSweep(
  getExec: () => SqlExecutor,
  now: () => string = localNow,
): void {
  registerSweepHook(async () => {
    const exec = getExec();
    const stamp = now();
    // One boundary shared by the candidate scan and the under-lock re-check.
    const windowModifier = `-${QUARANTINE_WINDOW_DAYS} days`;

    // (a) BARE candidate scan — NARROWS the set only. Uses datetime(...) (never
    //     date(...)) so a full YYYY-MM-DD HH:MM:SS timestamp compares correctly,
    //     and a STRICT `<` so a def quarantined EXACTLY 30 days ago does NOT
    //     expire ("older THAN 30 days"). The AUTHORITATIVE check runs again under
    //     the lock in (b).
    const candidates = await exec.getAllAsync<StaleCandidate>(
      `SELECT id, col_name FROM custom_field_defs
        WHERE quarantined_at IS NOT NULL
          AND quarantined_at < datetime('now', 'localtime', ?)`,
      [windowModifier],
    );

    // (b) Per-def, DIRECT call to expireFieldIfStale (it owns its own mutex +
    //     txn and re-verifies staleness under the lock — NEVER re-wrap it,
    //     HIGH-1). Its own try/catch isolates a failed/skipped drop so the loop
    //     continues and the history prune below always runs.
    for (const def of candidates) {
      try {
        await expireFieldIfStale(exec, def, windowModifier, stamp);
      } catch (error) {
        Logger.error(
          "field-sweep",
          `quarantine expiry failed for ${def.col_name}`,
          error,
        );
      }
    }

    // (c) Prune field_history on the same 30-day schedule, INSIDE
    //     inWriteTransaction (a serialized sweep write, not a bare DELETE an
    //     overlapping txn could capture — cycle-2 MED). Deliberately keeps `<=`:
    //     history retention has no exact-day boundary contract, unlike the
    //     strict-`<` expiry predicate — do NOT "align" it.
    await inWriteTransaction(exec, () =>
      exec.runAsync(
        `DELETE FROM field_history
          WHERE created_at <= datetime('now', 'localtime', ?)`,
        [windowModifier],
      ),
    );
  });
}
