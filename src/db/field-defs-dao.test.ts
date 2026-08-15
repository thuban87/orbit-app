/**
 * Custom-field def metadata DAO — behavioural proof (FLD-03).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL DAO, asserting: rename edits label only (col_name + physical
 * column unchanged); reorder permutes display_order; changeFieldOptions edits
 * options only; updateFieldCuration persists both curation flags;
 * quarantine/restore toggle quarantined_at without touching the value column;
 * listDefs({includeQuarantined:true}) surfaces quarantined defs; non-existent-id
 * ops throw via the changes !== 1 guard; isFieldEmpty is correct and rejects an
 * unsafe col_name; and every mutating op runs through inWriteTransaction
 * (single-BEGIN) while pure reads open none.
 */
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
} from "@/db/field-defs-dao";
import type { NewFieldDef } from "@/db/field-types";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";
const LATER = "2026-08-20 09:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
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

/** Create a def via the real DDL and return its assigned id. */
async function makeDef(overrides: Partial<NewFieldDef> = {}): Promise<number> {
  await createField(exec, newDef(overrides));
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE col_name = ?",
    [overrides.col_name ?? "nickname"],
  );
  if (!row) throw new Error("def not created");
  return row.id;
}

async function readDef(id: number): Promise<Record<string, unknown>> {
  const row = await exec.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM custom_field_defs WHERE id = ?",
    [id],
  );
  if (!row) throw new Error(`no def ${id}`);
  return row;
}

async function valueColumns(): Promise<string[]> {
  const rows = await exec.getAllAsync<{ name: string }>(
    "PRAGMA table_info(contact_custom_values)",
  );
  return rows.map((r) => r.name);
}

describe("renameField — label only, col_name stable (FLD-03)", () => {
  it("edits label and leaves col_name + the physical column identical", async () => {
    const id = await makeDef({ col_name: "nickname", label: "Nickname" });

    await renameField(exec, id, "Nick", LATER);

    const def = await readDef(id);
    expect(def.label).toBe("Nick");
    expect(def.col_name).toBe("nickname");
    expect(def.modified_at).toBe(LATER);
    expect(await valueColumns()).toContain("nickname");
  });

  it("throws on a non-existent id (changes !== 1)", async () => {
    await expect(renameField(exec, 999, "X", LATER)).rejects.toThrow();
  });
});

describe("reorderFields — display_order permutation", () => {
  it("rewrites display_order to the given index order", async () => {
    const a = await makeDef({ col_name: "a", label: "A", display_order: 0 });
    const b = await makeDef({ col_name: "b", label: "B", display_order: 1 });
    const c = await makeDef({ col_name: "c", label: "C", display_order: 2 });

    await reorderFields(exec, [c, a, b], LATER);

    expect((await readDef(c)).display_order).toBe(0);
    expect((await readDef(a)).display_order).toBe(1);
    expect((await readDef(b)).display_order).toBe(2);
  });

  it("rolls the whole batch back when an id does not match", async () => {
    const a = await makeDef({ col_name: "a", label: "A", display_order: 0 });
    await expect(reorderFields(exec, [a, 999], LATER)).rejects.toThrow();
    // a's display_order was rolled back to its original value.
    expect((await readDef(a)).display_order).toBe(0);
  });
});

describe("changeFieldOptions / updateFieldCuration", () => {
  it("changeFieldOptions edits options only", async () => {
    const id = await makeDef({ col_name: "tier", type: "dropdown" });

    await changeFieldOptions(exec, id, '["basic","premium"]', LATER);

    const def = await readDef(id);
    expect(def.options).toBe('["basic","premium"]');
    expect(def.modified_at).toBe(LATER);
  });

  it("updateFieldCuration flips show_on_new / always_show", async () => {
    const id = await makeDef({ col_name: "nickname" });

    await updateFieldCuration(exec, id, 1, 1, LATER);

    const def = await readDef(id);
    expect(def.show_on_new).toBe(1);
    expect(def.always_show).toBe(1);
    expect(def.modified_at).toBe(LATER);
  });

  it("updateFieldCuration throws on a non-existent id", async () => {
    await expect(updateFieldCuration(exec, 999, 1, 0, LATER)).rejects.toThrow();
  });
});

describe("quarantine / restore + listDefs visibility", () => {
  it("quarantine stamps quarantined_at without touching the value column", async () => {
    const id = await makeDef({ col_name: "nickname" });

    await quarantineField(exec, id, LATER);

    expect((await readDef(id)).quarantined_at).toBe(LATER);
    expect(await valueColumns()).toContain("nickname");
  });

  it("restore nulls quarantined_at", async () => {
    const id = await makeDef({ col_name: "nickname" });
    await quarantineField(exec, id, LATER);

    await restoreField(exec, id, LATER);

    expect((await readDef(id)).quarantined_at).toBeNull();
  });

  it("listDefs hides quarantined by default and surfaces them when asked", async () => {
    const live = await makeDef({ col_name: "a", label: "A", display_order: 0 });
    const dead = await makeDef({ col_name: "b", label: "B", display_order: 1 });
    await quarantineField(exec, dead, LATER);

    const visible = await listDefs(exec, { includeQuarantined: false });
    expect(visible.map((d) => d.id)).toEqual([live]);

    const all = await listDefs(exec, { includeQuarantined: true });
    expect(all.map((d) => d.id)).toEqual([live, dead]);
  });
});

describe("isFieldEmpty", () => {
  it("is true for an all-null column and false once a value is written", async () => {
    await makeDef({ col_name: "nickname" });
    const result = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uid(), "Alex", 30, NOW, NOW],
    );
    const contactId = result.lastInsertRowId;
    await exec.runAsync(
      "INSERT INTO contact_custom_values (contact_id, uid, modified_at) VALUES (?, ?, ?)",
      [contactId, uid(), NOW],
    );

    expect(await isFieldEmpty(exec, "nickname")).toBe(true);

    await exec.runAsync(
      'UPDATE contact_custom_values SET "nickname" = ? WHERE contact_id = ?',
      ["Al", contactId],
    );
    expect(await isFieldEmpty(exec, "nickname")).toBe(false);
  });

  it("throws on an unsafe col_name", async () => {
    await expect(
      isFieldEmpty(exec, 'x"; DROP TABLE contacts; --'),
    ).rejects.toThrow();
  });
});

describe("serialization — every mutating op runs through inWriteTransaction (review cycle-2)", () => {
  it("each mutating op issues EXACTLY ONE BEGIN; pure reads issue none", async () => {
    const id = await makeDef({ col_name: "nickname" });

    const one = async (
      run: (e: SqlExecutor) => Promise<unknown>,
    ): Promise<number> => {
      const { proxy, beginCount } = countingProxy(exec);
      await run(proxy);
      return beginCount();
    };

    expect(await one((e) => renameField(e, id, "N", LATER))).toBe(1);
    expect(await one((e) => changeFieldOptions(e, id, null, LATER))).toBe(1);
    expect(await one((e) => updateFieldCuration(e, id, 1, 0, LATER))).toBe(1);
    expect(await one((e) => quarantineField(e, id, LATER))).toBe(1);
    expect(await one((e) => restoreField(e, id, LATER))).toBe(1);

    // Pure reads open no transaction.
    expect(await one((e) => listDefs(e, { includeQuarantined: true }))).toBe(0);
    expect(await one((e) => isFieldEmpty(e, "nickname"))).toBe(0);
  });
});

/** Wrap an executor so every `BEGIN` issued via execAsync is counted. */
function countingProxy(inner: SqlExecutor): {
  proxy: SqlExecutor;
  beginCount: () => number;
} {
  let begins = 0;
  const proxy: SqlExecutor = {
    execAsync(sql: string) {
      if (/^\s*BEGIN/i.test(sql)) begins++;
      return inner.execAsync(sql);
    },
    runAsync: (sql, params) => inner.runAsync(sql, params),
    getFirstAsync: <T>(sql: string, params?: unknown[]) =>
      inner.getFirstAsync<T>(sql, params),
    getAllAsync: <T>(sql: string, params?: unknown[]) =>
      inner.getAllAsync<T>(sql, params),
  };
  return { proxy, beginCount: () => begins };
}
