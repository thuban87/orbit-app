/**
 * Purge fan-out DAO (CRUD-06) — the irreversible whole-contact delete, the
 * second and unrecoverable stage of the archive→purge lifecycle.
 *
 * There is NO server and NO backup: a purge cannot be undone remotely, so the
 * safeguards live entirely at the write boundary here plus the impact-summary
 * confirm the Archived list shows before calling in.
 *
 * =============================================================================
 * WRITE-BOUNDARY GUARD — READ BEFORE EDITING (review T-04-12):
 *   `purgeContact` verifies `archived_at IS NOT NULL` INSIDE its transaction and
 *   asserts EXACTLY ONE contacts row deleted. A live (non-archived) contact
 *   therefore cannot be purged even by a caller that reaches this DAO directly —
 *   the two-stage safety is structural, not merely UI routing.
 *
 * EXPLICIT FAN-OUT, NOT FK CASCADE (review T-04-13):
 *   Every owned child is deleted EXPLICITLY in ONE `inWriteTransaction`:
 *   interactions, events, fuel, contact_custom_values, contact_links,
 *   `field_history`, then the contacts row. `field_history` has NO FK to
 *   `contacts` and never cascades — it MUST be deleted here or its rows would
 *   outlive the contact. The FK CASCADEs on the other children are live but we
 *   do not rely on them: explicit deletes keep the blast radius auditable and
 *   matched to `computeImpact`'s explicit COUNTs.
 *
 * POST-COMMIT EXTENSION HOOK — NEVER AWAITED INSIDE THE TRANSACTION (T-04-16):
 *   Non-DB cleanup (photo-file `unlink`, `expo-notifications` cancels) is a
 *   non-transactional OS side effect. Awaiting it inside the open `BEGIN` would
 *   hold the shared write mutex on an OS call and could not be rolled back. It
 *   therefore runs AFTER the transaction commits, as idempotent best-effort in
 *   its own try/catch — a throwing adapter is logged, never fatal, and never
 *   undoes the already-committed deletes. Phases 5 (photo) and 11 (notifications)
 *   register the adapter; Phase 4 passes none.
 *
 * SECURITY (T-04-02): every value is `?`-bound; no identifier is interpolated —
 * each table name is a literal in a constant SQL string.
 *
 * Node-pure control flow: takes `exec: SqlExecutor` as its first argument and
 * imports the shared `inWriteTransaction` — never expo `withTransactionAsync`.
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "purge-dao";

/**
 * The blast radius of a purge. The multi-row children carry a COUNT; the
 * single-row `contact_custom_values` is a BOOLEAN (one row per contact — a field
 * count would be meaningless, review fix). `events` is now a genuine blast-radius
 * child: the Phase-6 events writer (events-dao) landed, so archive/restore emit
 * immutable events and `impactSummaryLines` surfaces the events count.
 */
export interface PurgeImpact {
  interactions: number;
  events: number;
  fuel: number;
  links: number;
  hasCustomValues: boolean;
}

/** Optional post-commit cleanup registered by Phases 5/11. */
export interface PurgeOptions {
  /**
   * Idempotent best-effort OS cleanup (photo unlink, notification cancels), run
   * POST-COMMIT in its own try/catch — never awaited inside the transaction.
   */
  onPurgeExtensions?: (contactId: number) => Promise<void> | void;
}

/** `"1 thing"` / `"N things"`. */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function countRows(
  exec: SqlExecutor,
  sql: string,
  contactId: number,
): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(sql, [contactId]);
  return row?.n ?? 0;
}

/**
 * Read the per-child blast radius of purging `contactId`: four `COUNT(*)` reads
 * for the multi-row children plus an `EXISTS` probe for the single custom-values
 * row. A pure read (no transaction). Every table name is a literal.
 */
export async function computeImpact(
  exec: SqlExecutor,
  contactId: number,
): Promise<PurgeImpact> {
  const interactions = await countRows(
    exec,
    "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
    contactId,
  );
  const events = await countRows(
    exec,
    "SELECT COUNT(*) AS n FROM events WHERE contact_id = ?",
    contactId,
  );
  const fuel = await countRows(
    exec,
    "SELECT COUNT(*) AS n FROM fuel WHERE contact_id = ?",
    contactId,
  );
  const links = await countRows(
    exec,
    "SELECT COUNT(*) AS n FROM contact_links WHERE contact_id = ?",
    contactId,
  );
  const cv = await exec.getFirstAsync<{ present: number }>(
    "SELECT EXISTS(SELECT 1 FROM contact_custom_values WHERE contact_id = ?) AS present",
    [contactId],
  );
  return {
    interactions,
    events,
    fuel,
    links,
    hasCustomValues: (cv?.present ?? 0) === 1,
  };
}

/**
 * The pure, unit-tested render helper: the ordered, omit-zero blast-radius parts
 * for the impact-summary confirm. Renders the genuine multi-row children —
 * interactions, events, fuel items, links — each `"${n} ${label}"` (pluralised),
 * and omits any whose count is 0. `events` IS surfaced now (the Phase-6 events
 * writer landed); `contact_custom_values` (a single 0/1 row, not a field count)
 * remains DELIBERATELY not rendered.
 *
 * `name` is part of the caller's sentence ("Permanently delete {name} and
 * {parts}?"), not of these fragments — the screen owns the surrounding copy.
 */
export function impactSummaryLines(
  name: string,
  impact: PurgeImpact,
): string[] {
  void name;
  const lines: string[] = [];
  if (impact.interactions > 0) {
    lines.push(plural(impact.interactions, "interaction", "interactions"));
  }
  if (impact.events > 0) {
    lines.push(plural(impact.events, "event", "events"));
  }
  if (impact.fuel > 0) {
    lines.push(plural(impact.fuel, "fuel item", "fuel items"));
  }
  if (impact.links > 0) {
    lines.push(plural(impact.links, "link", "links"));
  }
  return lines;
}

/**
 * Permanently delete an ARCHIVED contact and every row it owns, in ONE
 * transaction. Asserts `archived_at IS NOT NULL` before any delete (a live
 * contact throws → rollback, nothing deleted) and asserts exactly one contacts
 * row deleted. After COMMIT, fires `onPurgeExtensions` as idempotent best-effort
 * (see the module header) — never inside the transaction/mutex.
 */
export function purgeContact(
  exec: SqlExecutor,
  contactId: number,
  opts?: PurgeOptions,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    // (1) Write-boundary guard: only an archived contact may be purged.
    const row = await exec.getFirstAsync<{ archived_at: string | null }>(
      "SELECT archived_at FROM contacts WHERE id = ?",
      [contactId],
    );
    if (!row || row.archived_at === null) {
      throw new Error(
        `purgeContact: contact id=${contactId} is not archived — refusing to purge (no rows deleted)`,
      );
    }

    // (2) Explicit fan-out of every owned child (incl. field_history, which has
    //     no FK and never cascades). Not relying on FK CASCADE — auditable.
    await exec.runAsync("DELETE FROM interactions WHERE contact_id = ?", [
      contactId,
    ]);
    await exec.runAsync("DELETE FROM events WHERE contact_id = ?", [contactId]);
    await exec.runAsync("DELETE FROM fuel WHERE contact_id = ?", [contactId]);
    await exec.runAsync(
      "DELETE FROM contact_custom_values WHERE contact_id = ?",
      [contactId],
    );
    await exec.runAsync("DELETE FROM contact_links WHERE contact_id = ?", [
      contactId,
    ]);
    await exec.runAsync("DELETE FROM field_history WHERE contact_id = ?", [
      contactId,
    ]);

    // (3) The contact itself — assert exactly one row deleted.
    const deleted = await exec.runAsync("DELETE FROM contacts WHERE id = ?", [
      contactId,
    ]);
    if (deleted.changes !== 1) {
      throw new Error(
        `purgeContact: expected exactly one contacts row deleted for id=${contactId} (deleted ${deleted.changes})`,
      );
    }
  }).then(async () => {
    // POST-COMMIT best-effort cleanup — the transaction has committed and the
    // mutex is released. A throwing adapter is logged, never fatal, and cannot
    // undo the deletes above.
    try {
      await opts?.onPurgeExtensions?.(contactId);
    } catch (err) {
      Logger.error(
        LOG_SCOPE,
        `post-commit purge cleanup failed for contact id=${contactId} (best-effort)`,
        err,
      );
    }
  });
}
