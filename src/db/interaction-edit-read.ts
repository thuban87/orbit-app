/**
 * Contact-scoped single-row load of ONE interaction for the canonical Edit
 * Interaction route (HIST-12, Plan 04).
 *
 * WHY THIS READ EXISTS (review HIGH): the Edit route must seed the extended
 * refine form with EVERY editable field — including the free-form `note` and the
 * migration-025 `duration`/`allow_ai` columns — not a partial projection like the
 * bounded Profile history read (`profile-history-read.ts`, which omits prose).
 *
 * It is a distinct single-row-by-id read, NOT the date-indexed history projection
 * (Plan 03). It takes a `ReadOnlyExecutor` (only `getFirstAsync`/`getAllAsync`) so
 * it structurally cannot write and opens no transaction — a load path never
 * touches recency. Every parameter is `?`-bound (no interpolation), and the row is
 * scoped by BOTH `id` AND `contact_id` so one contact's Edit surface can never
 * load another contact's interaction (T-32-11 trust boundary).
 *
 * Phase 38.10 adds two read-side helpers for the edit screens:
 * - `noteAiLocked` (D-103): the note was moved into Off Limits, so its Allow AI
 *   switch renders locked off with the reason (the DAO clamps anyway).
 * - `blankNoteBlockedBy` / `readOwnNoteLinkedSection` (Research Q4; checker
 *   cycle 5 W-4): the pre-check that refuses clearing an interaction's OWN
 *   linked note to blank. Only `link_source = 'note'` entries of that
 *   interaction count; a Group Note copy never blocks (D-113).
 */
import {
  getLinkedEntriesCore,
  type LinkedEntry,
  type LinkedSection,
} from "@/db/linked-entry-dao";
import type { ReadOnlyExecutor } from "@/db/transaction";

/** The full editable interaction, shaped to seed the extended refine form. */
export interface InteractionForEdit {
  id: number;
  contactId: number;
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS`. */
  occurredAt: string;
  /** Message|Call|In Person|other|unspecified (D-06; legacy values representable). */
  channel: string;
  /** outbound|inbound|mutual|null. */
  direction: string | null;
  /** 0/1 — drives the rarely_responds recency filter. */
  connected: number;
  /** Tone: Positive|Neutral|Negative|null (D-06). */
  quality: string | null;
  note: string | null;
  /** Optional interaction duration in whole seconds (HIST-14); null = none. */
  duration: number | null;
  /** Per-interaction Allow-AI gate, 0/1 (D-04); defaults 0 (OFF). */
  allowAi: number;
  /**
   * 1 when the note was moved into Off Limits: AI stays off for good (38.10
   * D-103). Optional; absent means 0 (checker cycle 5 B-3).
   */
  noteAiLocked?: 0 | 1;
}

interface InteractionForEditRow {
  id: number;
  contact_id: number;
  occurred_at: string;
  channel: string | null;
  direction: string | null;
  connected: number | null;
  quality: string | null;
  note: string | null;
  duration: number | null;
  allow_ai: number | null;
  note_ai_locked: number | null;
}

/**
 * Load the full editable interaction identified by `interactionId`, scoped to
 * `contactId`. Returns null when no row pairs those two keys (wrong contact, or a
 * deleted/absent id) — the caller treats null as "not found, go back".
 */
export async function readInteractionForEdit(
  exec: ReadOnlyExecutor,
  contactId: number,
  interactionId: number,
): Promise<InteractionForEdit | null> {
  const row = await exec.getFirstAsync<InteractionForEditRow>(
    `SELECT id, contact_id, occurred_at, channel, direction,
            connected, quality, note, duration, allow_ai, note_ai_locked
       FROM interactions
      WHERE id = ? AND contact_id = ?`,
    [interactionId, contactId],
  );
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    contactId: row.contact_id,
    occurredAt: row.occurred_at,
    channel: row.channel ?? "unspecified",
    direction: row.direction,
    connected: row.connected ?? 1,
    quality: row.quality,
    note: row.note,
    duration: row.duration,
    allowAi: row.allow_ai ?? 0,
    noteAiLocked: row.note_ai_locked === 1 ? 1 : 0,
  };
}

/**
 * The section that blocks clearing this interaction's own note to blank, or
 * null when nothing does (Research Q4). PURE. Counts only entries linked from
 * the interaction's own note (`linkSource === 'note'`) of that interaction; a
 * Group Note copy (`group_note`) never blocks, since a cleared Group Note
 * detaches its copies instead (D-113; checker cycle 5 W-4).
 */
export function blankNoteBlockedBy(
  entries: readonly LinkedEntry[],
  { interactionId }: { interactionId: number },
): LinkedSection | null {
  const own = entries.find(
    (entry) =>
      entry.linkSource === "note" && entry.interactionId === interactionId,
  );
  return own ? own.section : null;
}

/**
 * The section this interaction's own note is also saved to, or null. The edit
 * screens call it inside their guarded save, only when the note is blank.
 */
export async function readOwnNoteLinkedSection(
  exec: ReadOnlyExecutor,
  interactionId: number,
): Promise<LinkedSection | null> {
  return blankNoteBlockedBy(await getLinkedEntriesCore(exec, [interactionId]), {
    interactionId,
  });
}
