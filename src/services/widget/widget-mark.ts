/**
 * widget-mark — the headless mark-contacted WRITE SEAM (WDG-02).
 *
 * =============================================================================
 * SINGLE-WRITER, DAO-ONLY (threat register T-12-06, DATA-04):
 *   A small-tile tap (or the larger tile's "Mark" button) records ONE
 *   widget-sourced touchpoint. It routes THROUGH `recordTouchpoint` — the ONE
 *   mutexed, single-writer recency DAO (recency-dao.ts) that wraps
 *   `inWriteTransaction` -> the shared `withMutex`. This module NEVER issues a
 *   raw `UPDATE contacts SET last_contact = …` and NEVER opens its own
 *   transaction (recordTouchpoint already owns the transaction; nesting the
 *   non-reentrant mutex would permanently hang — mutex.ts). It is deliberately
 *   the analog of the notification headless mark (notification-actions.ts):
 *   same one-tap 04-log defaults, same DAO, same invariant.
 *
 * FRESH UID PER TAP (LOG-06 / RESEARCH Assumption A1):
 *   The interaction `uid` is minted with `newUid()`, so every GENUINE repeat tap
 *   is a DISTINCT row — the opposite of the notification path, whose uid is a
 *   DETERMINISTIC exactly-once key (actionUid) precisely because a redelivered
 *   notification response is a duplicate to collapse. A widget tap is a fresh
 *   user intent each time. A deterministic-uid double-tap backstop would only be
 *   added if the 12-08 device spike shows native WIDGET_CLICK double-delivery.
 *
 * DB BOOTSTRAP LIVES IN THE HANDLER, NOT HERE:
 *   Like the recency DAO, this seam takes the already-opened `SqlExecutor`. The
 *   killed-app headless bootstrap (`await openAndMigrate()` BEFORE `getExecutor()`)
 *   is the 12-06 handler's job (mirroring notification-actions H1), so this stays
 *   a pure, node-testable write over the node:sqlite harness.
 * =============================================================================
 */
import { recordTouchpoint } from "@/db/recency-dao";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

/**
 * Record a single widget-sourced touchpoint against `contactId`, recomputing
 * recency via the single-writer DAO. `now` is the local wall-clock
 * `YYYY-MM-DD HH:MM:SS` occurrence stamp (also the immutable recorded_at).
 *
 * Values are the 04-log canonical one-tap defaults, identical to the
 * notification mark (A6): `source='widget'`, `direction='outbound'`,
 * `channel='unspecified'`, `connected=1`, `quality=null`. The uid is freshly
 * minted so a genuine repeat tap is a distinct row. Returns the DAO's
 * `{ interactionId }`.
 */
export function widgetMarkContacted(
  exec: SqlExecutor,
  contactId: number,
  now: string,
): Promise<{ interactionId: number }> {
  return recordTouchpoint(exec, {
    contactId,
    uid: newUid(),
    occurredAt: now,
    now,
    source: "widget",
    direction: "outbound",
    channel: "unspecified",
    connected: 1,
    quality: null,
  });
}
