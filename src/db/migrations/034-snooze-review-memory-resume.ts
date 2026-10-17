import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 034 — indefinite snooze, missing-source review memory and the
 * "asked once" resume markers (Phase 38.12).
 *
 * Head+1 VERIFIED on disk at author time (2026-10-17, D-29): migration 033 is
 * the latest registered step and `TARGET_VERSION` was 33. This is the phase's
 * only migration; one plan owns it so no two plans collide on 034.
 *
 * Forward-only and irreversible, run inside the runner's per-step transaction
 * with foreign keys ON. Three parts, in order:
 *
 *   a. D-45 schema: `reconcile_source_snapshot` is rebuilt with its CHECK
 *      widened to admit a `'source'` family (the "missing source kept" review
 *      memory). Every column and row is copied, the copy is counted and matched
 *      before the old table is dropped, and a mismatch throws so the runner rolls
 *      the whole step back (033 rebuild shape). Nothing references this table
 *      and it has no triggers or extra indexes (only its inline UNIQUE
 *      auto-indexes, rebuilt by the CREATE), so nothing else is recreated.
 *   b. D-105, D-111 schema: a nullable `resume_prompted_at` on
 *      `import_sessions` and `reconciliation_sessions`, the durable "asked once"
 *      marker a later plan writes when a resume prompt is actually shown.
 *   c. D-134 (owner-approved legacy repair, D-30): every per-person mute
 *      (`reminders_off = 1`) becomes an indefinite snooze — `snooze_until` set
 *      to the sentinel `'9999-12-31'` and `reminders_off` cleared (D-96, D-98).
 *      The literal is written here, not imported, because a shipped migration
 *      must never change when a runtime constant changes; the 034 test pins it
 *      equal to `INDEFINITE_SNOOZE_UNTIL`. `modified_at` is left unchanged: the
 *      person's meaning (paused with no end) is unchanged (38.12-01 only).
 *
 * `reconcile_source_snapshot` and both session tables are local-only and never
 * exported (migration 012 header; 38.12 RESEARCH §2 "Not in the backup"), so
 * there is no backup-format change. `contacts.snooze_until` is already backup
 * data and carries the sentinel through unchanged.
 */
export const SNOOZE_REVIEW_RESUME_SCHEMA_VERSION = 34;

/** The rebuilt review-memory table, CHECK widened with `'source'` (D-45). */
const CREATE_RECONCILE_SOURCE_SNAPSHOT_V34 = `
  CREATE TABLE reconcile_source_snapshot_new (
    id INTEGER PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    external_contact_link_id INTEGER NOT NULL REFERENCES external_contact_links(id) ON DELETE CASCADE,
    field_family TEXT NOT NULL CHECK (field_family IN ('name', 'phones', 'emails', 'birthday', 'photo', 'source')),
    reviewed_value TEXT,
    reviewed_at TEXT NOT NULL,
    UNIQUE(external_contact_link_id, field_family)
  );
`;

async function count(exec: SqlExecutor, sql: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(sql);
  return row?.n ?? 0;
}

export const migration034: Migration = {
  version: SNOOZE_REVIEW_RESUME_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    // a. Rebuild reconcile_source_snapshot (copy → verify → DROP → RENAME).
    const before = await count(
      exec,
      "SELECT COUNT(*) AS n FROM reconcile_source_snapshot",
    );
    await exec.execAsync(CREATE_RECONCILE_SOURCE_SNAPSHOT_V34);
    await exec.execAsync(`
      INSERT INTO reconcile_source_snapshot_new (
        id, uid, external_contact_link_id, field_family, reviewed_value, reviewed_at
      )
      SELECT id, uid, external_contact_link_id, field_family, reviewed_value, reviewed_at
        FROM reconcile_source_snapshot;
    `);
    const after = await count(
      exec,
      "SELECT COUNT(*) AS n FROM reconcile_source_snapshot_new",
    );
    const matched = await count(
      exec,
      `SELECT COUNT(*) AS n
         FROM reconcile_source_snapshot o
         JOIN reconcile_source_snapshot_new n
           ON n.id = o.id AND n.uid = o.uid
          AND n.external_contact_link_id = o.external_contact_link_id
          AND n.field_family = o.field_family
          AND n.reviewed_value IS o.reviewed_value
          AND n.reviewed_at = o.reviewed_at`,
    );
    if (after !== before || matched !== before) {
      throw new Error(
        `migration 034: reconcile_source_snapshot rebuild copied ${matched}/${after} of ${before} rows`,
      );
    }
    await exec.execAsync("DROP TABLE reconcile_source_snapshot");
    await exec.execAsync(
      "ALTER TABLE reconcile_source_snapshot_new RENAME TO reconcile_source_snapshot",
    );

    // b. "Asked once" resume markers (D-105, D-111), consumed by a later plan.
    await exec.execAsync(
      "ALTER TABLE import_sessions ADD COLUMN resume_prompted_at TEXT",
    );
    await exec.execAsync(
      "ALTER TABLE reconciliation_sessions ADD COLUMN resume_prompted_at TEXT",
    );

    // c. D-134: every per-person mute becomes an indefinite snooze.
    await exec.execAsync(
      "UPDATE contacts SET snooze_until = '9999-12-31', reminders_off = 0 WHERE reminders_off = 1",
    );
  },
};
