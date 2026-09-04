/**
 * Launch-time expiry for soft-deleted Memories and relationships.
 *
 * This is a foreground launch hook, never a timer. Its candidate queries only
 * narrow potential work: each writer repeats the complete strict stale-window
 * predicate while it owns the non-reentrant write transaction.
 */
import { expireMemoryIfStale } from "@/db/memories-dao";
import { expireRelationshipIfStale } from "@/db/relationships-dao";
import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";

/**
 * Restorable-trash retention, in days. Empty-state copy must use this value.
 * A device clock moving backward delays expiry; a forward jump accelerates it.
 */
export const MEMORY_TRASH_WINDOW_DAYS = 30;

type TrashCandidate = { id: number; contact_id: number };

/** Build the local convention shared by database.localDateTime() writers. */
function localNow(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${formatLocalDate(date)} ${hh}:${mm}:${ss}`;
}

/**
 * Register the Memory/relationship expiry hook. `now` stamps writes only; it
 * never controls expiry, which uses the device local wall clock in SQLite.
 * Both memories.deleted_at and relationships.deleted_at are written via
 * localDateTime() in the repo-wide `YYYY-MM-DD HH:MM:SS` local convention, so
 * they compare directly with `datetime('now', 'localtime', ?)` below.
 */
export function registerMemoryTrashSweep(
  getExec: () => SqlExecutor,
  now: () => string = localNow,
): void {
  registerSweepHook(async () => {
    const exec = getExec();
    const stamp = now();
    // Shared exactly with each under-lock writer's strict stale re-check.
    const windowModifier = `-${MEMORY_TRASH_WINDOW_DAYS} days`;

    const memoryCandidates = await exec.getAllAsync<TrashCandidate>(
      `SELECT id, contact_id FROM memories
        WHERE deleted_at IS NOT NULL
          AND deleted_at < datetime('now', 'localtime', ?)`,
      [windowModifier],
    );
    for (const candidate of memoryCandidates) {
      try {
        await expireMemoryIfStale(
          exec,
          { id: candidate.id, contactId: candidate.contact_id },
          windowModifier,
          stamp,
        );
      } catch (error) {
        Logger.error(
          "memory-trash-sweep",
          `memory expiry failed for ${candidate.id}`,
          error,
        );
      }
    }

    const relationshipCandidates = await exec.getAllAsync<TrashCandidate>(
      `SELECT id, contact_id FROM relationships
        WHERE deleted_at IS NOT NULL
          AND deleted_at < datetime('now', 'localtime', ?)`,
      [windowModifier],
    );
    for (const candidate of relationshipCandidates) {
      try {
        await expireRelationshipIfStale(
          exec,
          { id: candidate.id, contactId: candidate.contact_id },
          windowModifier,
          stamp,
        );
      } catch (error) {
        Logger.error(
          "memory-trash-sweep",
          `relationship expiry failed for ${candidate.id}`,
          error,
        );
      }
    }
  });
}
