/**
 * Migration 006 — normalize dynamic custom-field values into immutable rows.
 *
 * ADR-001 (docs/decisions/ADR-001-normalized-custom-field-values.md) records
 * this forward-only representation. Source-derived rows use their legacy
 * contact-value row's `modified_at` for BOTH timestamps; synthesized blanks use
 * `deps.now` for BOTH. Phase 17 merge semantics are intentionally not decided
 * here. A D-06a orphan-column snapshot in `field_history` is a bounded 30-day
 * local audit trace with no read surface and no backup path, NOT recovery.
 */
import { isSafeColName } from "@/db/col-name";
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const MIGRATION006_INTEGRITY_CODE = "migration-006-integrity-failure";

/** A recognizable bootstrap-safe failure for loss-bearing legacy inconsistencies. */
export class Migration006IntegrityError extends Error {
  readonly code = MIGRATION006_INTEGRITY_CODE;

  constructor(reason: string) {
    super(`Migration 006 integrity failure: ${reason}`);
    this.name = "Migration006IntegrityError";
  }
}

export function isMigration006IntegrityError(
  error: unknown,
): error is Migration006IntegrityError {
  return (
    error instanceof Migration006IntegrityError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === MIGRATION006_INTEGRITY_CODE)
  );
}

const LEGACY_TABLE = "contact_custom_values";
const FIXED_LEGACY_COLUMNS = new Set(["contact_id", "uid", "modified_at"]);

const CREATE_CUSTOM_FIELD_VALUES = `
CREATE TABLE custom_field_values (
  id           INTEGER PRIMARY KEY,
  uid          TEXT NOT NULL UNIQUE,
  contact_id   INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_def_id INTEGER NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
  value        TEXT,
  created_at   TEXT NOT NULL,
  modified_at  TEXT NOT NULL,
  UNIQUE(contact_id, field_def_id)
);`;

interface LegacyDef {
  id: number;
  col_name: string;
}

interface LegacyColumn {
  name: string;
  type: string;
}

interface LegacyRow {
  contact_id: number;
  modified_at: string;
  [column: string]: unknown;
}

function fail(reason: string): never {
  throw new Migration006IntegrityError(reason);
}

function assertTextValue(value: unknown, context: string): string | null {
  if (value === null || typeof value === "string") return value;
  return fail(`unreadable legacy value for ${context}`);
}

function quoteSafeColumn(colName: string): string {
  if (!isSafeColName(colName)) {
    fail(`unsafe legacy custom-field identifier ${JSON.stringify(colName)}`);
  }
  return `"${colName}"`;
}

async function loadAndValidateDefs(
  exec: SqlExecutor,
  now: string,
): Promise<LegacyDef[]> {
  const defs = await exec.getAllAsync<LegacyDef>(
    "SELECT id, col_name FROM custom_field_defs ORDER BY id",
  );
  const columns = await exec.getAllAsync<LegacyColumn>(
    `PRAGMA table_info(${LEGACY_TABLE})`,
  );
  const byName = new Map(columns.map((column) => [column.name, column]));

  for (const def of defs) {
    const quoted = quoteSafeColumn(def.col_name);
    void quoted;
    const column = byName.get(def.col_name);
    if (!column) {
      fail(`missing legacy value column ${def.col_name}`);
    }
    if (column.type.toUpperCase() !== "TEXT") {
      fail(`legacy value column ${def.col_name} is not TEXT`);
    }
  }

  const definitionNames = new Set(defs.map((def) => def.col_name));
  for (const column of columns) {
    if (FIXED_LEGACY_COLUMNS.has(column.name) || definitionNames.has(column.name)) {
      continue;
    }
    await snapshotOrphanColumn(exec, column.name, now);
  }

  const orphanRow = await exec.getFirstAsync<{ contact_id: number }>(
    `SELECT legacy.contact_id
       FROM ${LEGACY_TABLE} AS legacy
       LEFT JOIN contacts ON contacts.id = legacy.contact_id
      WHERE contacts.id IS NULL
      LIMIT 1`,
  );
  if (orphanRow) {
    fail(`orphan legacy value row for contact ${orphanRow.contact_id}`);
  }
  return defs;
}

async function snapshotOrphanColumn(
  exec: SqlExecutor,
  columnName: string,
  now: string,
): Promise<void> {
  const column = quoteSafeColumn(columnName);
  const rows = await exec.getAllAsync<{ contact_id: number; value: unknown }>(
    `SELECT contact_id, ${column} AS value
       FROM ${LEGACY_TABLE}
      WHERE ${column} IS NOT NULL`,
  );
  for (const row of rows) {
    const value = assertTextValue(row.value, `orphan column ${columnName}`);
    await exec.runAsync(
      `INSERT INTO field_history (
         contact_id, field_col_name, old_value, operation, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        row.contact_id,
        columnName,
        value,
        "migration-006-orphan-column-drop",
        now,
      ],
    );
  }
}

async function readLegacyRows(
  exec: SqlExecutor,
  defs: LegacyDef[],
): Promise<Map<number, LegacyRow>> {
  const valueColumns = defs.map((def) => quoteSafeColumn(def.col_name));
  const rows = await exec.getAllAsync<LegacyRow>(
    `SELECT contact_id, modified_at${valueColumns.map((column) => `, ${column}`).join("")}
       FROM ${LEGACY_TABLE}`,
  );
  const byContact = new Map<number, LegacyRow>();
  for (const row of rows) {
    if (!Number.isInteger(row.contact_id) || typeof row.modified_at !== "string") {
      fail("unreadable legacy value row metadata");
    }
    if (byContact.has(row.contact_id)) {
      fail(`duplicate legacy value row for contact ${row.contact_id}`);
    }
    for (const def of defs) {
      assertTextValue(row[def.col_name], def.col_name);
    }
    byContact.set(row.contact_id, row);
  }
  return byContact;
}

async function proveCopy(
  exec: SqlExecutor,
  contacts: { id: number }[],
  defs: LegacyDef[],
  legacyRows: Map<number, LegacyRow>,
): Promise<void> {
  const expected = contacts.length * defs.length;
  const count = await exec.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM custom_field_values",
  );
  const uniquePairs = await exec.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM (SELECT contact_id, field_def_id FROM custom_field_values GROUP BY contact_id, field_def_id)`,
  );
  if (count?.count !== expected || uniquePairs?.count !== expected) {
    fail("post-copy pair completeness proof failed");
  }

  for (const contact of contacts) {
    const legacy = legacyRows.get(contact.id);
    for (const def of defs) {
      const expectedValue = legacy
        ? assertTextValue(legacy[def.col_name], def.col_name)
        : null;
      const copied = await exec.getFirstAsync<{ value: unknown }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [contact.id, def.id],
      );
      if (!copied || assertTextValue(copied.value, def.col_name) !== expectedValue) {
        fail(`post-copy value proof failed for contact ${contact.id} / ${def.id}`);
      }
    }
  }
}

export const migration006: Migration = {
  version: 6,
  async apply(exec: SqlExecutor, deps: MigrationDeps): Promise<void> {
    const defs = await loadAndValidateDefs(exec, deps.now);
    const legacyRows = await readLegacyRows(exec, defs);
    const contacts = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM contacts ORDER BY id",
    );

    await exec.execAsync(CREATE_CUSTOM_FIELD_VALUES);
    for (const contact of contacts) {
      const legacy = legacyRows.get(contact.id);
      const timestamp = legacy?.modified_at ?? deps.now;
      for (const def of defs) {
        const value = legacy
          ? assertTextValue(legacy[def.col_name], def.col_name)
          : null;
        await exec.runAsync(
          `INSERT INTO custom_field_values (
             uid, contact_id, field_def_id, value, created_at, modified_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
          [deps.newUid(), contact.id, def.id, value, timestamp, timestamp],
        );
      }
    }

    await proveCopy(exec, contacts, defs, legacyRows);
    await exec.execAsync(`DROP TABLE ${LEGACY_TABLE}`);
  },
};
