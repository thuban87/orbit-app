/**
 * Drift guard for the reserved-column whitelist (FLD-02, T-03-06).
 *
 * Runs the REAL migrations 001 through 006 against a fresh node:sqlite DB, reads
 * the live `PRAGMA table_info` for `contacts` and `custom_field_values`, and asserts
 * `RESERVED_COLUMN_NAMES` is a SUPERSET of that live column set. This is the
 * single mechanism that keeps the hand-transcribed whitelist in sync with the
 * schema: add a fixed column in a future migration without updating the
 * whitelist and this test fails loudly, before a custom `col_name` can shadow it.
 */
import { describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { runMigrations } from "@/db/migrations/runner";
import { RESERVED_COLUMN_NAMES } from "@/db/reserved-columns";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";

async function liveColumns(
  exec: SqlExecutor,
  table: string,
): Promise<string[]> {
  const rows = await exec.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return rows.map((r) => r.name);
}

describe("RESERVED_COLUMN_NAMES", () => {
  it("is a superset of the live contacts + custom_field_values fixed columns at v6", async () => {
    let counter = 0;
    const db = openTestDb();
    const exec = nodeSqliteExecutor(db);
    await runMigrations(
      exec,
      [
        migration001,
        migration002,
        migration003,
        migration004,
        migration005,
        migration006,
      ],
      6,
      {
        now: NOW,
        newUid: () => `uid-${++counter}`,
      },
    );

    const live = [
      ...(await liveColumns(exec, "contacts")),
      ...(await liveColumns(exec, "custom_field_values")),
    ];

    // Every live fixed column MUST be reserved. Report the offenders by name so
    // a drift failure names the column that needs adding to the whitelist.
    const missing = live.filter((col) => !RESERVED_COLUMN_NAMES.has(col));
    expect(missing).toEqual([]);
  });

  it("reserves the SQLite rowid aliases (not surfaced by PRAGMA table_info)", () => {
    expect(RESERVED_COLUMN_NAMES.has("rowid")).toBe(true);
    expect(RESERVED_COLUMN_NAMES.has("oid")).toBe(true);
    expect(RESERVED_COLUMN_NAMES.has("_rowid_")).toBe(true);
  });
});
