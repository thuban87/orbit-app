import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * 38.4 D-57 (owner, OA-E2): a bulk import's batch cadence.
 *
 * Bulk import setup may bind the whole batch at one frequency. The choice lives
 * on the durable import session so every bulk create path — the driver's pass,
 * a resume, Combine and Duplicate Review's "Import as new" — reads it from one
 * place. `batch_tracking_enabled` already exists (migration 012); this adds the
 * cadence beside it.
 *
 * Additive and forward-only: one nullable column, no row is read or rewritten,
 * so every existing session reads Unbound with no cadence. Import sessions are
 * local-only and not backup data (migration 012: Replace-all restore deletes
 * them and the export manifest never includes them), so there is no
 * backup-format change.
 *
 * The CHECK admits only NULL or a positive integer. The Bound ⇒ cadence pairing
 * is enforced by the session writer (`assertImportLifecycle`), not by a
 * cross-column CHECK: existing rows are all Unbound, and the contacts table's
 * own CHECK (`tracking_enabled = 0 OR interval_days IS NOT NULL`, migration 011)
 * is the last backstop for every contact an import creates.
 */
export const IMPORT_BATCH_CADENCE_SCHEMA_VERSION = 32;

export const migration032: Migration = {
  version: IMPORT_BATCH_CADENCE_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE import_sessions
        ADD COLUMN batch_interval_days INTEGER
          CHECK (batch_interval_days IS NULL
                 OR (typeof(batch_interval_days) = 'integer' AND batch_interval_days > 0));
    `);
  },
};
