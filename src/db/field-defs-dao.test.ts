import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createField } from "@/db/field-ddl";
import {
  changeFieldOptions,
  isFieldEmpty,
  listDefs,
  quarantineField,
  renameField,
  reorderFields,
  restoreField,
  updateFieldCuration,
  updateFieldShareWithAi,
} from "@/db/field-defs-dao";
import type { CustomFieldDef, NewFieldDef } from "@/db/field-types";
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
    { now: NOW, newUid: uid },
  );
});

async function makeDef(overrides: Partial<NewFieldDef> = {}): Promise<number> {
  const definition: NewFieldDef = {
    uid: uid(),
    col_name: "nickname",
    label: "Nickname",
    type: "text",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: 0,
    share_with_ai: 0,
    now: NOW,
    ...overrides,
  };
  await createField(exec, definition);
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE col_name = ?",
    [overrides.col_name ?? "nickname"],
  );
  if (!row) throw new Error("definition missing");
  return row.id;
}

async function readDef(id: number): Promise<CustomFieldDef> {
  const row = await exec.getFirstAsync<CustomFieldDef>(
    "SELECT * FROM custom_field_defs WHERE id = ?",
    [id],
  );
  if (!row) throw new Error(`definition ${id} missing`);
  return row;
}

async function contact(): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
    [uid(), "Alex", 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("isFieldEmpty", () => {
  it("uses a bound field_def_id, treating only NULL as empty", async () => {
    const fieldDefId = await makeDef();
    const contactId = await contact();
    expect(await isFieldEmpty(exec, fieldDefId)).toBe(true);
    await exec.runAsync(
      "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      [uid(), contactId, fieldDefId, "", NOW, NOW],
    );
    expect(await isFieldEmpty(exec, fieldDefId)).toBe(false);
  });

  it("restores metadata only because quarantined definitions retain their pairs", async () => {
    const fieldDefId = await makeDef();
    const contactId = await contact();
    await exec.runAsync(
      "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      [uid(), contactId, fieldDefId, "Ace", NOW, NOW],
    );
    await quarantineField(exec, fieldDefId, NOW);
    await restoreField(exec, fieldDefId, NOW);
    expect(
      await exec.getFirstAsync(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [contactId, fieldDefId],
      ),
    ).toEqual({ value: "Ace" });
  });
});

describe("definition metadata operations", () => {
  it("renames labels without changing the immutable col_name", async () => {
    const id = await makeDef();
    await renameField(exec, id, "Nick", "2026-08-25 09:00:00");
    expect((await readDef(id)).label).toBe("Nick");
    expect((await readDef(id)).col_name).toBe("nickname");
  });

  it("reorders definitions atomically", async () => {
    const a = await makeDef({ col_name: "a", label: "A", display_order: 0 });
    const b = await makeDef({ col_name: "b", label: "B", display_order: 1 });
    await reorderFields(exec, [b, a], NOW);
    expect((await readDef(b)).display_order).toBe(0);
    expect((await readDef(a)).display_order).toBe(1);
  });

  it("rolls a reorder back when an id does not match", async () => {
    const id = await makeDef();
    await expect(reorderFields(exec, [id, 999], NOW)).rejects.toThrow();
    expect((await readDef(id)).display_order).toBe(0);
  });

  it("persists options, curation, and AI-sharing flags independently", async () => {
    const id = await makeDef({ type: "dropdown" });
    await changeFieldOptions(exec, id, '["basic","premium"]', NOW);
    await updateFieldCuration(exec, id, 1, 1, NOW);
    await updateFieldShareWithAi(exec, id, 1, NOW);
    expect(await readDef(id)).toMatchObject({
      options: '["basic","premium"]',
      show_on_new: 1,
      always_show: 1,
      share_with_ai: 1,
    });
  });

  it("lists quarantined definitions only when requested", async () => {
    const live = await makeDef({ col_name: "live", label: "Live" });
    const quarantined = await makeDef({ col_name: "old", label: "Old" });
    await quarantineField(exec, quarantined, NOW);
    expect(
      (await listDefs(exec, { includeQuarantined: false })).map((d) => d.id),
    ).toEqual([live]);
    expect(
      (await listDefs(exec, { includeQuarantined: true })).map((d) => d.id),
    ).toEqual([live, quarantined]);
  });

  it("fails loudly when an id does not match a mutating operation", async () => {
    await expect(renameField(exec, 999, "X", NOW)).rejects.toThrow();
    await expect(changeFieldOptions(exec, 999, null, NOW)).rejects.toThrow();
    await expect(updateFieldCuration(exec, 999, 1, 0, NOW)).rejects.toThrow();
    await expect(updateFieldShareWithAi(exec, 999, 1, NOW)).rejects.toThrow();
  });
});
