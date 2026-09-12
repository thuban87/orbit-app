/**
 * Canonical single-contact history read (HIST-02/10/16, D-10/D-12).
 *
 * The one read behind the Phase-32 History surfaces (Heatmap / Intensity /
 * Rolodex Browser / Detail Sheet). It SUPERSEDES the renderer contract of the
 * interim `profile-history-read.ts` (its header invites exactly this) WITHOUT
 * changing persistence, and drops that read's `LIMIT 3`.
 *
 * It returns, for one contact:
 *   • date-indexed interaction records (channel, occurred_at, direction,
 *     connected, quality, note, duration, allow_ai);
 *   • read-only lifecycle events;
 *   • per-date markers (interaction-bearing vs lifecycle-only vs multiple) plus
 *     a distinct `hasLifecycleRecords` signal so a caller can tell "no
 *     interactions ever" from "lifecycle-only" (Plan 08);
 *   • a knowledge-change record family spanning EVERY registered current-state
 *     field (Plan 07 interleaves + routes each to its owning-model edit flow).
 *
 * COUNT-ONLY (D-10): markers/counts resolve ONLY from `interactions` rows.
 * Lifecycle events are surfaced but never counted into the interaction count.
 *
 * GROUP SEAM IS INERT (D-12): `isGroupLinked` is a predicate keyed on a
 * group-event-id field that DOES NOT EXIST in Phase 32 (that column lands in
 * Phase 33's migration 026+). So it resolves hard-false for every row — a Group
 * Event parent can never be an `interactions` row and thus never double-counts,
 * WITHOUT any group schema or constructible parent fixture. This module never
 * selects, joins, or assumes the group-event-id column.
 *
 * Read-only: a `ReadOnlyExecutor` (no transaction), every value `?`-bound, no
 * string interpolation, no network (local-first, CLAUDE.md). Local-date only —
 * the stored `occurred_at`/`created_at` are LOCAL wall-clock strings, so a date
 * is the leading `YYYY-MM-DD`; never routed through UTC ISO slicing.
 */
import { getCurrentStateHistory } from "@/db/current-state-history-read";
import { CURRENT_STATE_FIELD_KEYS, type CurrentStateFieldKey } from "@/db/memory-registry";
import type { ReadOnlyExecutor } from "@/db/transaction";

/** A date-indexed interaction record surfaced to the History renderers. */
export interface HistoryInteractionRecord {
  readonly id: number;
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS`. */
  readonly occurredAt: string;
  /** The LOCAL calendar date (leading `YYYY-MM-DD`). */
  readonly date: string;
  readonly channel: string;
  readonly direction: string | null;
  readonly connected: number;
  readonly quality: string | null;
  readonly note: string | null;
  readonly duration: number | null;
  readonly allowAi: number;
  /** INERT SEAM (D-12): always false in Phase 32 (no group-event-id column). */
  readonly groupLinked: boolean;
}

/** A read-only lifecycle event record (archive/restore/snooze/unsnooze/bind/unbind). */
export interface HistoryLifecycleRecord {
  readonly id: number;
  readonly occurredAt: string;
  readonly date: string;
  readonly type: string;
  readonly detail: string | null;
}

/** A history-aware knowledge change, carrying its owning field key for routing. */
export interface HistoryKnowledgeRecord {
  readonly id: number;
  readonly fieldKey: CurrentStateFieldKey;
  /** LOCAL calendar date of the change (leading `YYYY-MM-DD` of created_at). */
  readonly date: string;
  readonly createdAt: string;
  readonly value: string;
  readonly isCurrent: number;
}

/** How a date renders as a marker: filled dot / ring / filled-with-count. */
export type DateMarkerKind = "interaction" | "lifecycle-only" | "multiple";

/** Per-date aggregate marker. Counts are interaction-only (D-10). */
export interface HistoryDateMarker {
  readonly date: string;
  readonly interactionCount: number;
  readonly lifecycleCount: number;
  readonly kind: DateMarkerKind;
}

/** The full canonical history projection for one contact. */
export interface ContactHistory {
  readonly interactions: readonly HistoryInteractionRecord[];
  readonly lifecycleEvents: readonly HistoryLifecycleRecord[];
  readonly knowledgeChanges: readonly HistoryKnowledgeRecord[];
  /** Date -> marker, for every date bearing at least one record. */
  readonly markers: ReadonlyMap<string, HistoryDateMarker>;
  /** True when ANY lifecycle event exists — distinct from having interactions. */
  readonly hasLifecycleRecords: boolean;
}

/**
 * The group-link discriminator (D-12). Keys on a group-event-id field that is
 * UNDEFINED in Phase 32 — no such column is selected — so it resolves hard-false
 * for every row. Phase 33's migration 026+ adds the column and makes the seam
 * live; nothing in Phase 32 references it.
 */
export function isGroupLinked(row: { groupEventId?: number | null }): boolean {
  return row.groupEventId != null;
}

interface InteractionDbRow {
  id: number;
  occurred_at: string;
  channel: string | null;
  direction: string | null;
  connected: number | null;
  quality: string | null;
  note: string | null;
  duration: number | null;
  allow_ai: number | null;
}

interface EventDbRow {
  id: number;
  occurred_at: string;
  type: string;
  detail: string | null;
}

/** Local calendar date of a stored wall-clock string (its leading YYYY-MM-DD). */
function localDateOf(stored: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(stored.trim());
  if (!match) {
    throw new Error(`history-read: unparseable timestamp "${stored}"`);
  }
  return match[1];
}

// Closed SELECTs (superseding profile-history-read's shape, no LIMIT). Only the
// contact id is bound; static column names are literal text (T-06-04). No
// group-event-id column anywhere (D-12).
const SELECT_INTERACTIONS = `SELECT id, occurred_at, channel, direction, connected,
                                    quality, note, duration, allow_ai
                               FROM interactions
                              WHERE contact_id = ?
                              ORDER BY occurred_at DESC, id DESC`;

const SELECT_EVENTS = `SELECT id, occurred_at, type, detail
                         FROM events
                        WHERE contact_id = ?
                        ORDER BY occurred_at DESC, id DESC`;

/**
 * Read the canonical history for one contact. Pure read — no transaction, no
 * network. Returns empty collections + a false `hasLifecycleRecords` for a
 * contact with no records (never throws).
 */
export async function readContactHistory(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<ContactHistory> {
  const interactionRows = await exec.getAllAsync<InteractionDbRow>(SELECT_INTERACTIONS, [contactId]);
  const eventRows = await exec.getAllAsync<EventDbRow>(SELECT_EVENTS, [contactId]);

  const interactions: HistoryInteractionRecord[] = interactionRows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    date: localDateOf(row.occurred_at),
    channel: row.channel ?? "unspecified",
    direction: row.direction,
    connected: row.connected ?? 1,
    quality: row.quality,
    note: row.note,
    duration: row.duration,
    allowAi: row.allow_ai ?? 0,
    // INERT SEAM: the row carries no group-event-id in Phase 32 -> hard-false.
    groupLinked: isGroupLinked({}),
  }));

  const lifecycleEvents: HistoryLifecycleRecord[] = eventRows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    date: localDateOf(row.occurred_at),
    type: row.type,
    detail: row.detail,
  }));

  // Per-date markers. Interaction counts ONLY come from interaction rows (D-10);
  // lifecycle rows populate a separate lifecycleCount and never the interaction
  // count.
  const counts = new Map<string, { interactionCount: number; lifecycleCount: number }>();
  const bump = (date: string, key: "interactionCount" | "lifecycleCount") => {
    const entry = counts.get(date) ?? { interactionCount: 0, lifecycleCount: 0 };
    entry[key]++;
    counts.set(date, entry);
  };
  for (const record of interactions) {
    bump(record.date, "interactionCount");
  }
  for (const record of lifecycleEvents) {
    bump(record.date, "lifecycleCount");
  }

  const markers = new Map<string, HistoryDateMarker>();
  for (const [date, entry] of counts) {
    markers.set(date, {
      date,
      interactionCount: entry.interactionCount,
      lifecycleCount: entry.lifecycleCount,
      kind: markerKind(entry.interactionCount, entry.lifecycleCount),
    });
  }

  // Knowledge-change family: union EVERY registered current-state field's
  // history (getCurrentStateHistory is single-field-at-a-time, so calling it
  // once would silently drop the other registered fields — review cycle-2).
  const knowledgeChanges = await readKnowledgeChanges(exec, contactId);

  return {
    interactions,
    lifecycleEvents,
    knowledgeChanges,
    markers,
    hasLifecycleRecords: lifecycleEvents.length > 0,
  };
}

function markerKind(interactionCount: number, lifecycleCount: number): DateMarkerKind {
  if (interactionCount === 0) {
    return "lifecycle-only";
  }
  return interactionCount + lifecycleCount >= 2 ? "multiple" : "interaction";
}

async function readKnowledgeChanges(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<HistoryKnowledgeRecord[]> {
  const family: HistoryKnowledgeRecord[] = [];
  for (const fieldKey of CURRENT_STATE_FIELD_KEYS) {
    const rows = await getCurrentStateHistory(exec, contactId, fieldKey);
    for (const row of rows) {
      family.push({
        id: row.id,
        fieldKey,
        date: localDateOf(row.created_at),
        createdAt: row.created_at,
        value: row.value,
        isCurrent: row.is_current,
      });
    }
  }
  // Deterministic flattened order: newest created_at first, then registry field
  // order, then id DESC — stable even when two fields change at the same instant.
  const fieldOrder = (key: CurrentStateFieldKey) => CURRENT_STATE_FIELD_KEYS.indexOf(key);
  family.sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    if (a.fieldKey !== b.fieldKey) {
      return fieldOrder(a.fieldKey) - fieldOrder(b.fieldKey);
    }
    return b.id - a.id;
  });
  return family;
}
