/**
 * Shared Undo helpers for hard-deleted knowledge entries (Phase 38.10, D-69).
 *
 * A leaf module: it imports no DAO, only executor types and the date helpers,
 * so every delete/Undo DAO (Off Limits, memories and key people in plan 02;
 * current state and the move DAO in plan 03; linked notes in plan 10) can
 * import it without an import cycle.
 *
 * Snapshot naming (convergence c2 G-D1): every delete snapshot stores its
 * tombstone stamp as `tombstoned_at`, never `deleted_at`. `deleted_at` is a
 * live column on memories and relationships (migration 016) that every reader
 * filters on, so a snapshot field of that name would re-insert the row as
 * still deleted.
 *
 * Timestamps are local wall-clock `YYYY-MM-DD HH:MM:SS` strings (never
 * `toISOString`, CLAUDE.md). `localDateTime` lives in `database.ts`, which
 * imports expo-sqlite; to stay a Node-pure leaf this module formats with the
 * same rule through `formatLocalDate`.
 */
import type { SqlExecutor } from "@/db/types";
import { formatLocalDate, parseLocalMs } from "@/utils/dates";

/** The interaction-note slot a linked entry occupies (migration 033). */
export type LinkSource = "note" | "group_note";

/** The source of a restorable link, as it is now (convergence c2 G-D2). */
export interface UndoLink {
  interactionId: number;
  text: string;
  occurredAt: string;
  allowAi: 0 | 1;
}

function formatLocalDateTime(ms: number): string {
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${formatLocalDate(date)} ${hh}:${mm}:${ss}`;
}

function tryParse(stamp: string): number | null {
  try {
    return parseLocalMs(stamp);
  } catch {
    return null;
  }
}

/**
 * The `modified_at` an Undo writes: the later of `now` and the tombstone stamp
 * plus one second, so the restored row is strictly newer than the tombstone it
 * removes. Merge's `compareRowAndTombstone` (backup/reconciliation.ts) lets the
 * tombstone win an equal-second tie, so a backup exported between the delete
 * and the Undo must not be able to resurrect the deletion (F-D4).
 */
export function undoModifiedAt(now: string, tombstonedAt: string): string {
  const nowMs = parseLocalMs(now);
  const floorMs = parseLocalMs(tombstonedAt) + 1000;
  return nowMs >= floorMs ? now : formatLocalDateTime(floorMs);
}

/**
 * The stamp a hard delete writes on its tombstone (and stores as the
 * snapshot's `tombstoned_at`): the later of `now` and the row's
 * `modified_at`, returned as given. An Undo can leave `modified_at` up to one
 * second ahead of the clock (`undoModifiedAt`), so a second delete in the same
 * second must not stamp a tombstone older than the row it removes. Equal
 * stamps still favour deletion (convergence c9).
 *
 * Accepted residual (D-122): ordinary edit writers stamp raw `now`, so an edit
 * in the same second as an Undo (or after a backwards clock jump) can lower a
 * restored row's `modified_at` back to an older tombstone's stamp. Not fixed.
 */
export function deleteStampAt(now: string, rowModifiedAt: string): string {
  const nowMs = tryParse(now);
  const rowMs = tryParse(rowModifiedAt);
  if (nowMs === null || rowMs === null) {
    // An unparseable stored stamp: fall back to Merge's own string order.
    return rowModifiedAt > now ? rowModifiedAt : now;
  }
  return rowMs > nowMs ? rowModifiedAt : now;
}

function isNonBlank(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Resolve the interaction link a deleted entry may get back on Undo, or null
 * when it must return unlinked (F-D3, G-D2, D-95, D-102, D-113).
 *
 * The link is resolved by the interaction's uid (ids are never trusted across
 * the Undo window: interactions use INTEGER PRIMARY KEY without AUTOINCREMENT,
 * so a freed id can be reused by another contact's interaction). It is only
 * restored when the interaction belongs to the same contact, the
 * `(interaction_id, link_source)` slot is free in both entry tables, and the
 * source still holds a note. Read-only: never writes the interaction or event.
 */
export async function resolveUndoLinkCore(
  exec: SqlExecutor,
  input: {
    interactionUid: string | null | undefined;
    linkSource: string | null | undefined;
    contactId: number;
  },
): Promise<UndoLink | null> {
  const { interactionUid, linkSource, contactId } = input;
  if (!interactionUid) return null;
  if (linkSource !== "note" && linkSource !== "group_note") return null;

  const interaction = await exec.getFirstAsync<{
    id: number;
    contact_id: number;
    note: string | null;
    occurred_at: string;
    allow_ai: number;
    group_event_id: number | null;
  }>(
    `SELECT id, contact_id, note, occurred_at, allow_ai, group_event_id
       FROM interactions
      WHERE uid = ?`,
    [interactionUid],
  );
  if (!interaction || interaction.contact_id !== contactId) return null;

  const taken = await exec.getFirstAsync<{ one: number }>(
    `SELECT 1 AS one FROM memories WHERE interaction_id = ? AND link_source = ?
     UNION ALL
     SELECT 1 AS one FROM current_state_entries
      WHERE interaction_id = ? AND link_source = ?`,
    [interaction.id, linkSource, interaction.id, linkSource],
  );
  if (taken) return null;

  if (linkSource === "note") {
    if (!isNonBlank(interaction.note)) return null;
    return {
      interactionId: interaction.id,
      text: interaction.note,
      occurredAt: interaction.occurred_at,
      allowAi: interaction.allow_ai === 1 ? 1 : 0,
    };
  }

  if (interaction.group_event_id === null) return null;
  const event = await exec.getFirstAsync<{
    group_note: string | null;
    occurred_at: string;
  }>("SELECT group_note, occurred_at FROM group_events WHERE id = ?", [
    interaction.group_event_id,
  ]);
  if (!event || !isNonBlank(event.group_note)) return null;
  return {
    interactionId: interaction.id,
    text: event.group_note,
    occurredAt: event.occurred_at,
    // Group Note copies are always AI-off (ADR-078, ADR-136, D-98).
    allowAi: 0,
  };
}
