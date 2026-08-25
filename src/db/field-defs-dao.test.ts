import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createField } from "@/db/field-ddl";
import { isFieldEmpty, quarantineField, restoreField } from "@/db/field-defs-dao";
import type { NewFieldDef } from "@/db/field-types";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-24 12:00:00";
let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, [migration001, migration002, migration003, migration004, migration005, migration006], 6, { now: NOW, newUid: uid });
});

async function makeDef(): Promise<number> {
  const definition: NewFieldDef = { uid: uid(), col_name: "nickname", label: "Nickname", type: "text", options: null, show_on_new: 0, always_show: 0, display_order: 0, share_with_ai: 0, now: NOW };
  await createField(exec, definition);
  const row = await exec.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE col_name = ?", ["nickname"]);
  if (!row) throw new Error("definition missing");
  return row.id;
}

async function contact(): Promise<number> {
  const result = await exec.runAsync("INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)", [uid(), "Alex", 30, NOW, NOW]);
  return result.lastInsertRowId;
}

describe("isFieldEmpty", () => {
  it("uses a bound field_def_id, treating only NULL as empty", async () => {
    const fieldDefId = await makeDef();
    const contactId = await contact();
    expect(await isFieldEmpty(exec, fieldDefId)).toBe(true);
    await exec.runAsync("INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)", [uid(), contactId, fieldDefId, "", NOW, NOW]);
    expect(await isFieldEmpty(exec, fieldDefId)).toBe(false);
  });

  it("restores metadata only because quarantined definitions retain their pairs", async () => {
    const fieldDefId = await makeDef();
    const contactId = await contact();
    await exec.runAsync("INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)", [uid(), contactId, fieldDefId, "Ace", NOW, NOW]);
    await quarantineField(exec, fieldDefId, NOW);
    await restoreField(exec, fieldDefId, NOW);
    expect(await exec.getFirstAsync("SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?", [contactId, fieldDefId])).toEqual({ value: "Ace" });
  });
});
