import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("expo-sqlite", () => ({}));
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  createField,
  deleteOrQuarantineField,
  dropField,
  expireFieldIfStale,
} from "@/db/field-ddl";
import { promoteFieldToGlobal } from "@/db/field-defs-dao";
import type { NewFieldDef } from "@/db/field-types";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-24 12:00:00";
let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uid });
});

function newDef(overrides: Partial<NewFieldDef> = {}): NewFieldDef {
  return {
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
}

async function seedContact(name: string, archived = false): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, archived_at, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
    [uid(), name, 30, archived ? NOW : null, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function defId(colName: string): Promise<number> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE col_name = ?",
    [colName],
  );
  if (!row) throw new Error(`no def for ${colName}`);
  return row.id;
}

async function value(
  contactId: number,
  fieldDefId: number,
): Promise<string | null> {
  const row = await exec.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
    [contactId, fieldDefId],
  );
  return row?.value ?? null;
}

describe("normalized field lifecycle", () => {
  it("creates durable blank pairs for every existing contact, including archived contacts", async () => {
    const live = await seedContact("Alex");
    const archived = await seedContact("Bo", true);
    await createField(exec, newDef());
    const fieldDefId = await defId("nickname");
    expect(await value(live, fieldDefId)).toBeNull();
    expect(await value(archived, fieldDefId)).toBeNull();
    const count = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM custom_field_values WHERE field_def_id = ?",
      [fieldDefId],
    );
    expect(count?.n).toBe(2);
  });

  it("rejects contact-scoped creation before inserting a definition or values", async () => {
    const contactId = await seedContact("Alex");
    const beforeDefs = await exec.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM custom_field_defs");
    const beforeValues = await exec.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM custom_field_values");
    await expect(createField(exec, newDef({ scope: "contact" }))).rejects.toThrow(/Phase 31/);
    expect(await exec.getFirstAsync("SELECT COUNT(*) AS n FROM custom_field_defs")).toEqual(beforeDefs);
    expect(await exec.getFirstAsync("SELECT COUNT(*) AS n FROM custom_field_values")).toEqual(beforeValues);
    expect(contactId).toBeGreaterThan(0);
  });

  it("promotes a directly-present contact def and seeds only missing contacts", async () => {
    const owner = await seedContact("Owner");
    const other = await seedContact("Other");
    const def = await exec.runAsync(
      `INSERT INTO custom_field_defs (
         uid, col_name, label, type, options, show_on_new, always_show,
         display_order, share_with_ai, scope, history_retained, field_group, created_at, modified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), "private_note", "Private note", "text", null, 0, 0, 0, 0, "contact", 0, null, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uid(), owner, def.lastInsertRowId, "owner value", NOW, NOW],
    );

    await promoteFieldToGlobal(exec, { fieldDefId: def.lastInsertRowId, now: NOW });

    expect(await exec.getFirstAsync("SELECT scope FROM custom_field_defs WHERE id = ?", [def.lastInsertRowId]))
      .toEqual({ scope: "global" });
    expect(await exec.getAllAsync(
      "SELECT contact_id, value FROM custom_field_values WHERE field_def_id = ? ORDER BY contact_id",
      [def.lastInsertRowId],
    )).toEqual([
      { contact_id: owner, value: "owner value" },
      { contact_id: other, value: null },
    ]);
  });

  it("tombstones and explicitly deletes retained history before deleting a definition", async () => {
    const contactId = await seedContact("Alex");
    await createField(exec, newDef({ history_retained: 1 }));
    const fieldDefId = await defId("nickname");
    const historyUid = uid();
    await exec.runAsync(
      `INSERT INTO custom_field_value_history (uid, contact_id, field_def_id, value, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [historyUid, contactId, fieldDefId, "prior", NOW],
    );
    await dropField(exec, { id: fieldDefId, col_name: "nickname" }, "delete", NOW);
    expect(await exec.getFirstAsync(
      "SELECT id FROM custom_field_value_history WHERE uid = ?", [historyUid],
    )).toBeNull();
    expect(await exec.getFirstAsync(
      "SELECT entity_uid FROM tombstones WHERE entity_type = 'custom_field_value_history' AND entity_uid = ?",
      [historyUid],
    )).toEqual({ entity_uid: historyUid });
  });

  it("snapshots non-null normalized values before deleting pairs and the definition", async () => {
    const alex = await seedContact("Alex");
    const bo = await seedContact("Bo");
    await createField(exec, newDef());
    const fieldDefId = await defId("nickname");
    await exec.runAsync(
      "UPDATE custom_field_values SET value = ? WHERE contact_id = ? AND field_def_id = ?",
      ["Al", alex, fieldDefId],
    );
    await exec.runAsync(
      "UPDATE custom_field_values SET value = ? WHERE contact_id = ? AND field_def_id = ?",
      ["", bo, fieldDefId],
    );
    const definitionUid = await exec.getFirstAsync<{ uid: string }>(
      "SELECT uid FROM custom_field_defs WHERE id = ?",
      [fieldDefId],
    );
    const valueUids = await exec.getAllAsync<{ uid: string }>(
      "SELECT uid FROM custom_field_values WHERE field_def_id = ? ORDER BY uid",
      [fieldDefId],
    );
    await dropField(
      exec,
      { id: fieldDefId, col_name: "nickname" },
      "delete",
      NOW,
    );
    expect(
      await exec.getAllAsync(
        "SELECT contact_id, old_value, operation FROM field_history WHERE field_col_name = ? ORDER BY contact_id",
        ["nickname"],
      ),
    ).toEqual([
      { contact_id: alex, old_value: "Al", operation: "delete" },
      { contact_id: bo, old_value: "", operation: "delete" },
    ]);
    expect(
      await exec.getFirstAsync(
        "SELECT id FROM custom_field_defs WHERE id = ?",
        [fieldDefId],
      ),
    ).toBeNull();
    expect(
      await exec.getFirstAsync(
        "SELECT id FROM custom_field_values WHERE field_def_id = ?",
        [fieldDefId],
      ),
    ).toBeNull();
    expect(
      await exec.getAllAsync(
        "SELECT entity_type, entity_uid, deleted_at FROM tombstones ORDER BY entity_type, entity_uid",
      ),
    ).toEqual([
      { entity_type: "custom_field_def", entity_uid: definitionUid?.uid, deleted_at: NOW },
      ...valueUids.map(({ uid: entity_uid }) => ({
        entity_type: "custom_field_value",
        entity_uid,
        deleted_at: NOW,
      })),
    ]);
  });

  it("deletes empty definitions but quarantines populated ones without removing pairs", async () => {
    const contactId = await seedContact("Alex");
    await createField(exec, newDef());
    const fieldDefId = await defId("nickname");
    expect(
      await deleteOrQuarantineField(
        exec,
        { id: fieldDefId, col_name: "nickname" },
        NOW,
      ),
    ).toBe("deleted");
    const tombstonesAfterPermanentDelete = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM tombstones WHERE entity_type IN ('custom_field_def', 'custom_field_value')",
    );
    await createField(exec, newDef({ col_name: "city", label: "City" }));
    const cityId = await defId("city");
    await exec.runAsync(
      "UPDATE custom_field_values SET value = ? WHERE contact_id = ? AND field_def_id = ?",
      ["Chicago", contactId, cityId],
    );
    expect(
      await deleteOrQuarantineField(
        exec,
        { id: cityId, col_name: "city" },
        NOW,
      ),
    ).toBe("quarantined");
    expect(await value(contactId, cityId)).toBe("Chicago");
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM tombstones WHERE entity_type IN ('custom_field_def', 'custom_field_value')",
      ),
    ).toEqual(tombstonesAfterPermanentDelete);
  });

  it("retains the under-lock stale recheck and snapshots values when expiring", async () => {
    const contactId = await seedContact("Alex");
    await createField(exec, newDef());
    const fieldDefId = await defId("nickname");
    await exec.runAsync(
      "UPDATE custom_field_values SET value = ? WHERE contact_id = ? AND field_def_id = ?",
      ["Al", contactId, fieldDefId],
    );
    await exec.runAsync(
      "UPDATE custom_field_defs SET quarantined_at = datetime('now', 'localtime', '-40 days') WHERE id = ?",
      [fieldDefId],
    );
    expect(
      await expireFieldIfStale(
        exec,
        { id: fieldDefId, col_name: "nickname" },
        "-30 days",
        NOW,
      ),
    ).toBe(true);
    expect(
      await exec.getFirstAsync(
        "SELECT old_value FROM field_history WHERE field_col_name = ? AND operation = ?",
        ["nickname", "quarantine_expiry"],
      ),
    ).toEqual({ old_value: "Al" });
  });

  it("does not delete a restored candidate", async () => {
    await createField(exec, newDef());
    const fieldDefId = await defId("nickname");
    expect(
      await expireFieldIfStale(
        exec,
        { id: fieldDefId, col_name: "nickname" },
        "-30 days",
        NOW,
      ),
    ).toBe(false);
    expect(
      await exec.getFirstAsync(
        "SELECT id FROM custom_field_defs WHERE id = ?",
        [fieldDefId],
      ),
    ).toEqual({ id: fieldDefId });
  });

  it("rolls back without deletion evidence when asked to permanently delete a missing definition", async () => {
    await expect(
      dropField(exec, { id: 999, col_name: "missing" }, "delete", NOW),
    ).rejects.toThrow();
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM tombstones WHERE entity_type IN ('custom_field_def', 'custom_field_value')",
      ),
    ).toEqual({ n: 0 });
  });
});
