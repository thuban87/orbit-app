/**
 * Interleaved profile timeline read (LOG-02, read half) — the load-bearing
 * correction surface the plugin never had (a log with zero readers was its fatal
 * mistake). A pure, read-only SELECT: NO transaction, every value `?`-bound, no
 * network — and only static column names are literal text (T-06-04).
 *
 * `listTimeline` UNION ALLs the contact's editable touchpoints (`interactions`)
 * with its read-only lifecycle events (`events`) into one newest-first list,
 * ordered `occurred_at DESC, id DESC, kind_order DESC`. REAL archive/restore
 * events (the writer landed in this phase's Tasks 1/2) now interleave — this is
 * no longer an empty surface.
 *
 * =============================================================================
 * CROSS-TABLE ORDERING + IDENTITY — READ BEFORE EDITING:
 *   `interactions.id` and `events.id` are INDEPENDENT PK sequences (migration 1),
 *   so a touchpoint and an event can tie — or FULLY collide — on both occurred_at
 *   AND id. Two consequences:
 *     1. Ordering: a static per-table `kind_order` discriminator (touchpoint=1,
 *        event=0) is the FINAL ORDER BY key, making even a full occurred_at+id
 *        collision deterministic (touchpoint before event).
 *     2. Identity: a row's identity is `${kind}-${id}`, NEVER the bare id — the
 *        renderer keys React elements and testIDs by it so a numeric-id collision
 *        across the two tables cannot produce duplicate keys/testIDs.
 * =============================================================================
 */
import type { SqlExecutor } from "@/db/types";

/** An editable touchpoint row in the timeline. */
export interface TimelineTouchpoint {
  kind: "touchpoint";
  id: number;
  occurred_at: string;
  channel: string;
  direction: string | null;
  connected: number;
  quality: string | null;
  note: string | null;
}

/** A read-only lifecycle event row in the timeline. */
export interface TimelineEvent {
  kind: "event";
  id: number;
  occurred_at: string;
  type: string;
  detail: string | null;
}

/** One timeline row — a touchpoint (editable) or an event (read-only). */
export type TimelineItem = TimelineTouchpoint | TimelineEvent;

/**
 * The raw UNION-ALL row shape: the shared columns plus a `kind` discriminator and
 * a static `kind_order` tiebreak, with the non-applicable side NULLed per table.
 */
interface TimelineRow {
  kind: "touchpoint" | "event";
  id: number;
  occurred_at: string;
  channel: string | null;
  direction: string | null;
  connected: number | null;
  quality: string | null;
  note: string | null;
  type: string | null;
  detail: string | null;
}

/**
 * The interleaved read. Both sides filter `contact_id = ?` (the sole bound
 * value on each, never interpolated); the outer ORDER BY is the canonical
 * `occurred_at DESC, id DESC` tiebreak (queries.ts) extended with `kind_order
 * DESC` as the deterministic FINAL key across the two independent id sequences.
 */
const LIST_TIMELINE = `SELECT kind, id, occurred_at, channel, direction, connected, quality, note, type, detail
    FROM (
      SELECT 'touchpoint' AS kind, 1 AS kind_order, id, occurred_at,
             channel, direction, connected, quality, note,
             NULL AS type, NULL AS detail
        FROM interactions
       WHERE contact_id = ?
      UNION ALL
      SELECT 'event' AS kind, 0 AS kind_order, id, occurred_at,
             NULL AS channel, NULL AS direction, NULL AS connected,
             NULL AS quality, NULL AS note,
             type, detail
        FROM events
       WHERE contact_id = ?
    )
   ORDER BY occurred_at DESC, id DESC, kind_order DESC`;

/**
 * Read a contact's full timeline: touchpoints (editable) interleaved with events
 * (read-only), newest-first. Returns `[]` for a contact with no rows (never
 * throws); rows for other contacts are excluded (`contact_id` bound on both
 * sides). Pure read — no transaction.
 */
export async function listTimeline(
  exec: SqlExecutor,
  contactId: number,
): Promise<TimelineItem[]> {
  const rows = await exec.getAllAsync<TimelineRow>(LIST_TIMELINE, [
    contactId,
    contactId,
  ]);
  return rows.map(
    (r): TimelineItem =>
      r.kind === "event"
        ? {
            kind: "event",
            id: r.id,
            occurred_at: r.occurred_at,
            type: r.type ?? "",
            detail: r.detail,
          }
        : {
            kind: "touchpoint",
            id: r.id,
            occurred_at: r.occurred_at,
            channel: r.channel ?? "unspecified",
            direction: r.direction,
            connected: r.connected ?? 1,
            quality: r.quality,
            note: r.note,
          },
  );
}
