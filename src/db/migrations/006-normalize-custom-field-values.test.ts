import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const LEGACY_NOW = "2026-08-24 12:00:00";
const MIGRATION_NOW = "2026-08-25 09:00:00";
const legacyMigrations = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
];

let uidNumber = 0;
const uid = () => `uid-${++uidNumber}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidNumber = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, legacyMigrations, 5, {
    now: LEGACY_NOW,
    newUid: uid,
  });
});

async function addContact(name: string, archived = false): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (
       uid, name, interval_days, archived_at, created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), name, 30, archived ? LEGACY_NOW : null, LEGACY_NOW, LEGACY_NOW],
  );
  return result.lastInsertRowId;
}

async function addDefinition(
  colName: string,
  type: string,
  options: string | null = null,
  quarantinedAt: string | null = null,
  addColumn = true,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO custom_field_defs (
       uid, col_name, label, type, options, display_order, quarantined_at,
       created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      colName,
      colName,
      type,
      options,
      uidNumber,
      quarantinedAt,
      LEGACY_NOW,
      LEGACY_NOW,
    ],
  );
  if (addColumn) {
    await exec.execAsync(
      `ALTER TABLE contact_custom_values ADD COLUMN "${colName}" TEXT`,
    );
  }
  return result.lastInsertRowId;
}

async function addLegacyRow(
  contactId: number,
  values: Record<string, string | null>,
  modifiedAt = "2025-11-03 08:15:00",
): Promise<void> {
  const columns = Object.keys(values);
  await exec.runAsync(
    `INSERT INTO contact_custom_values (
       contact_id, uid, modified_at${columns.map((name) => `, "${name}"`).join("")}
     ) VALUES (?, ?, ?${columns.map(() => ", ?").join("")})`,
    [contactId, uid(), modifiedAt, ...columns.map((name) => values[name])],
  );
}

async function migrate(): Promise<void> {
  await runMigrations(exec, [...legacyMigrations, migration006], 6, {
    now: MIGRATION_NOW,
    newUid: uid,
  });
}

async function userVersion(): Promise<number> {
  const row = await exec.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  return row?.user_version ?? 0;
}

describe("migration006 — lossless legacy custom-value normalization", () => {
  it("migrates every contact × definition pair with byte-preserved raw TEXT and documented timestamps", async () => {
    const alex = await addContact("Alex");
    const blair = await addContact("Blair", true);
    const casey = await addContact("Casey");
    const text = await addDefinition("nickname", "text");
    const textarea = await addDefinition("notes", "textarea");
    const dropdown = await addDefinition("relationship", "dropdown", '["friend","work"]');
    const date = await addDefinition("met_on", "date");
    const toggle = await addDefinition("opt_in", "toggle");
    const number = await addDefinition("score", "number");
    const photo = await addDefinition(
      "portrait",
      "photo",
      null,
      "2026-08-01 00:00:00",
    );
    await addLegacyRow(alex, {
      nickname: "Ace",
      notes: "",
      relationship: "work",
      met_on: "2025-03-04",
      opt_in: "maybe",
      score: "0042.50e-1",
      portrait: "custom-fields/1/portrait/photo.jpg",
    });
    await addLegacyRow(blair, {
      nickname: null,
      notes: "archived value",
      relationship: "friend",
      met_on: null,
      opt_in: "0",
      score: "not-a-number",
      portrait: null,
    });

    await migrate();

    expect(await userVersion()).toBe(6);
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values",
      ),
    ).toEqual({ n: 21 });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(DISTINCT uid) AS n FROM custom_field_values",
      ),
    ).toEqual({ n: 21 });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM (SELECT contact_id, field_def_id FROM custom_field_values GROUP BY contact_id, field_def_id)",
      ),
    ).toEqual({ n: 21 });
    expect(
      await exec.getFirstAsync<{ value: string | null; created_at: string; modified_at: string }>(
        "SELECT value, created_at, modified_at FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, photo],
      ),
    ).toEqual({
      value: "custom-fields/1/portrait/photo.jpg",
      created_at: "2025-11-03 08:15:00",
      modified_at: "2025-11-03 08:15:00",
    });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, textarea],
      ),
    ).toEqual({ value: "" });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [blair, text],
      ),
    ).toEqual({ value: null });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, number],
      ),
    ).toEqual({ value: "0042.50e-1" });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, toggle],
      ),
    ).toEqual({ value: "maybe" });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, dropdown],
      ),
    ).toEqual({ value: "work" });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, date],
      ),
    ).toEqual({ value: "2025-03-04" });
    expect(
      await exec.getFirstAsync<{ value: string | null; created_at: string; modified_at: string }>(
        "SELECT value, created_at, modified_at FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [casey, photo],
      ),
    ).toEqual({
      value: null,
      created_at: MIGRATION_NOW,
      modified_at: MIGRATION_NOW,
    });
    expect(
      await exec.getFirstAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'custom_field_values'",
      ),
    ).toMatchObject({ sql: expect.stringContaining("UNIQUE(contact_id, field_def_id)") });
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contact_custom_values'",
      ),
    ).toBeNull();
  });

  it("rolls back unchanged for a loss-bearing missing definition column", async () => {
    const alex = await addContact("Alex");
    await addDefinition("missing_value", "text", null, null, false);
    await addLegacyRow(alex, {});
    const before = await exec.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'contact_custom_values'",
    );
    const beforeRows = await exec.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM contact_custom_values",
    );

    await expect(migrate()).rejects.toThrow(/migration 006 integrity failure/i);

    expect(await userVersion()).toBe(5);
    expect(
      await exec.getFirstAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'contact_custom_values'",
      ),
    ).toEqual(before);
    expect(await exec.getAllAsync<Record<string, unknown>>("SELECT * FROM contact_custom_values")).toEqual(beforeRows);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'custom_field_values'",
      ),
    ).toBeNull();
  });

  it("snapshots a non-loss orphan dynamic column and proceeds without inventing a pair", async () => {
    const alex = await addContact("Alex");
    const known = await addDefinition("known", "text");
    await exec.execAsync(
      'ALTER TABLE contact_custom_values ADD COLUMN "orphan_value" TEXT',
    );
    await addLegacyRow(alex, { known: "kept", orphan_value: "audit-only" });

    await migrate();

    expect(await userVersion()).toBe(6);
    expect(
      await exec.getFirstAsync<{ field_col_name: string; old_value: string; operation: string; created_at: string }>(
        "SELECT field_col_name, old_value, operation, created_at FROM field_history WHERE contact_id = ?",
        [alex],
      ),
    ).toEqual({
      field_col_name: "orphan_value",
      old_value: "audit-only",
      operation: "migration-006-orphan-column-drop",
      created_at: MIGRATION_NOW,
    });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, known],
      ),
    ).toEqual({ n: 1 });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values",
      ),
    ).toEqual({ n: 1 });
  });

  it("fails before writes when a persisted definition identifier is unsafe", async () => {
    const alex = await addContact("Alex");
    await exec.runAsync(
      `INSERT INTO custom_field_defs (
         uid, col_name, label, type, display_order, created_at, modified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uid(), "bad-name!", "bad", "text", 0, LEGACY_NOW, LEGACY_NOW],
    );
    await addLegacyRow(alex, {});

    await expect(migrate()).rejects.toThrow(/migration 006 integrity failure/i);
    expect(await userVersion()).toBe(5);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'custom_field_values'",
      ),
    ).toBeNull();
  });
});
