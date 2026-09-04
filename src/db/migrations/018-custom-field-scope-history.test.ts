import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";

function createExecutor(): SqlExecutor {
  return nodeSqliteExecutor(openTestDb());
}

async function migrateTo17(exec: SqlExecutor): Promise<void> {
  let counter = 0;
  await runMigrations(exec, MIGRATIONS, 17, {
    now: NOW,
    newUid: () => `migration-uid-${++counter}`,
  });
}

describe("migration 018 — custom-field scope and value history", () => {
  it("adds additive scope/history/group columns and the value-history table", async () => {
    const exec = createExecutor();
    await migrateTo17(exec);
    await runMigrations(exec, MIGRATIONS, 18, { now: NOW, newUid: () => "unused" });

    const columns = await exec.getAllAsync<{
      name: string;
      notnull: number;
      dflt_value: string | null;
    }>("PRAGMA table_info(custom_field_defs)");
    expect(columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "scope", notnull: 1, dflt_value: "'global'" }),
      expect.objectContaining({ name: "history_retained", notnull: 1, dflt_value: "0" }),
      expect.objectContaining({ name: "field_group" }),
    ]));
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ["custom_field_value_history"],
      ),
    ).toEqual({ name: "custom_field_value_history" });
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        ["idx_cf_value_history"],
      ),
    ).toEqual({ name: "idx_cf_value_history" });
  });

  it("preserves the normalized current-value pair uniqueness", async () => {
    const exec = createExecutor();
    let counter = 0;
    await runMigrations(exec, MIGRATIONS, 18, {
      now: NOW,
      newUid: () => `migration-uid-${++counter}`,
    });
    const contact = await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
      ["contact", "Contact", 30, NOW, NOW],
    );
    const def = await exec.runAsync(
      `INSERT INTO custom_field_defs (
         uid, col_name, label, type, options, show_on_new, always_show,
         display_order, share_with_ai, created_at, modified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["def", "note", "Note", "text", null, 0, 0, 0, 0, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["value-one", contact.lastInsertRowId, def.lastInsertRowId, "first", NOW, NOW],
    );
    await expect(Promise.resolve().then(() => exec.runAsync(
      `INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["value-two", contact.lastInsertRowId, def.lastInsertRowId, "second", NOW, NOW],
    ))).rejects.toThrow();
  });
});
