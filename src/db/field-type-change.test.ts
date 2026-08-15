/**
 * The type-change layer — behavioural proof (FLD-04).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL DDL/type-change code, asserting: the read-only pre-flight
 * partitions stored values into convert-vs-flag by the TARGET parser; the
 * options pre-flight partitions keep-vs-flag by option membership; and — the
 * load-bearing invariant — `applyTypeChange` is EXACTLY `UPDATE defs.type` + a
 * same-transaction `field_history` snapshot, leaving `contact_custom_values`
 * value bytes BYTE-IDENTICAL (blast radius zero, §14.2 / T-03-02).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createField } from "@/db/field-ddl";
import {
  applyTypeChange,
  preflightOptionsChange,
  preflightTypeChange,
} from "@/db/field-type-change";
import type { NewFieldDef } from "@/db/field-types";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";
const LATER = "2026-08-15 09:30:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** A minimal valid create payload with a caller-supplied col_name. */
function newDef(overrides: Partial<NewFieldDef> = {}): NewFieldDef {
  return {
    uid: uid(),
    col_name: "score",
    label: "Score",
    type: "number",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: 0,
    share_with_ai: 0,
    now: NOW,
    ...overrides,
  };
}

/** Insert a contact plus its contact_custom_values row; returns contact_id. */
async function seedContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  const contactId = result.lastInsertRowId;
  await exec.runAsync(
    "INSERT INTO contact_custom_values (contact_id, uid, modified_at) VALUES (?, ?, ?)",
    [contactId, uid(), NOW],
  );
  return contactId;
}

/** Write a raw value into a field's value column for a contact. */
async function setValue(
  colName: string,
  contactId: number,
  value: string,
): Promise<void> {
  await exec.runAsync(
    `UPDATE contact_custom_values SET "${colName}" = ? WHERE contact_id = ?`,
    [value, contactId],
  );
}

/** Look up the assigned id for a col_name. */
async function defId(colName: string): Promise<number> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE col_name = ?",
    [colName],
  );
  if (!row) throw new Error(`no def for ${colName}`);
  return row.id;
}

/**
 * Capture the raw stored bytes of a value column as `contact_id → hex` — hex() is
 * SQLite's exact byte serialization, so an equal map proves BYTE-IDENTICAL
 * storage (not merely equal strings).
 */
async function valueBytes(colName: string): Promise<Record<number, string>> {
  const rows = await exec.getAllAsync<{
    contact_id: number;
    hx: string | null;
  }>(
    `SELECT contact_id, hex("${colName}") AS hx FROM contact_custom_values ORDER BY contact_id`,
  );
  const out: Record<number, string> = {};
  for (const r of rows) out[r.contact_id] = r.hx ?? "<null>";
  return out;
}

describe("preflightTypeChange — read-only convert/flag partition (FLD-04)", () => {
  it("partitions stored values by the TARGET parser", async () => {
    await createField(exec, newDef({ col_name: "score", type: "number" }));
    const a = await seedContact("Alex");
    const b = await seedContact("Bo");
    const c = await seedContact("Cy");
    await setValue("score", a, "42");
    await setValue("score", b, "about 60k");
    await setValue("score", c, "7");

    // Target number: "42"/"7" convert, "about 60k" flags.
    const result = await preflightTypeChange(
      exec,
      { col_name: "score" },
      "number",
    );
    expect(result.total).toBe(3);
    expect(result.convert.sort()).toEqual([a, c].sort());
    expect(result.flag).toEqual([b]);
  });

  it("target text accepts everything (all convert, none flagged)", async () => {
    await createField(exec, newDef({ col_name: "score", type: "number" }));
    const a = await seedContact("Alex");
    const b = await seedContact("Bo");
    await setValue("score", a, "42");
    await setValue("score", b, "about 60k");

    const result = await preflightTypeChange(
      exec,
      { col_name: "score" },
      "text",
    );
    expect(result.total).toBe(2);
    expect(result.convert.sort()).toEqual([a, b].sort());
    expect(result.flag).toEqual([]);
  });

  it("writes NOTHING — the value bytes are unchanged after a pre-flight", async () => {
    await createField(exec, newDef({ col_name: "score", type: "number" }));
    const a = await seedContact("Alex");
    await setValue("score", a, "about 60k");
    const before = await valueBytes("score");

    await preflightTypeChange(exec, { col_name: "score" }, "number");

    expect(await valueBytes("score")).toEqual(before);
    // No history rows written by a read-only pre-flight.
    const hist = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM field_history",
    );
    expect(hist?.n).toBe(0);
  });
});

describe("preflightOptionsChange — read-only keep/flag by option membership", () => {
  it("flags a stored value dropped from the NEW options list", async () => {
    await createField(
      exec,
      newDef({
        col_name: "tier",
        type: "dropdown",
        options: JSON.stringify(["a", "b"]),
      }),
    );
    const a = await seedContact("Alex");
    const b = await seedContact("Bo");
    await setValue("tier", a, "a");
    await setValue("tier", b, "c"); // "c" is not even in the current options

    // Next options exclude "c" (and "b") — "a" is kept, "c" is flagged.
    const result = await preflightOptionsChange(
      exec,
      { col_name: "tier" },
      JSON.stringify(["a"]),
    );
    expect(result.total).toBe(2);
    expect(result.keep).toEqual([a]);
    expect(result.flag).toEqual([b]);
  });

  it("writes nothing", async () => {
    await createField(
      exec,
      newDef({
        col_name: "tier",
        type: "dropdown",
        options: JSON.stringify(["a", "b"]),
      }),
    );
    const a = await seedContact("Alex");
    await setValue("tier", a, "b");
    const before = await valueBytes("tier");

    await preflightOptionsChange(
      exec,
      { col_name: "tier" },
      JSON.stringify(["a"]),
    );

    expect(await valueBytes("tier")).toEqual(before);
  });
});

describe("applyTypeChange — defs.type UPDATE + same-txn snapshot, values untouched", () => {
  it("changes the def type, snapshots the transition, and leaves value bytes BYTE-IDENTICAL", async () => {
    await createField(exec, newDef({ col_name: "score", type: "number" }));
    const a = await seedContact("Alex");
    const b = await seedContact("Bo");
    await setValue("score", a, "42");
    await setValue("score", b, "about 60k"); // unconvertible under number

    const id = await defId("score");
    const before = await valueBytes("score");

    await applyTypeChange(
      exec,
      { id, col_name: "score", type: "number" },
      "text",
      LATER,
    );

    // (i) def type is the new type.
    const def = await exec.getFirstAsync<{ type: string; modified_at: string }>(
      "SELECT type, modified_at FROM custom_field_defs WHERE id = ?",
      [id],
    );
    expect(def?.type).toBe("text");
    expect(def?.modified_at).toBe(LATER);

    // (ii) field_history holds the pre-change snapshot with the transition encoded
    //      in operation (there is no type column).
    const hist = await exec.getAllAsync<{
      contact_id: number;
      old_value: string;
      operation: string;
      created_at: string;
    }>(
      "SELECT contact_id, old_value, operation, created_at FROM field_history WHERE field_col_name = ? ORDER BY contact_id",
      ["score"],
    );
    expect(hist).toEqual([
      {
        contact_id: a,
        old_value: "42",
        operation: "type_change:number->text",
        created_at: LATER,
      },
      {
        contact_id: b,
        old_value: "about 60k",
        operation: "type_change:number->text",
        created_at: LATER,
      },
    ]);

    // (iii) BLAST RADIUS ZERO — the value column bytes are byte-identical; the
    //       unconvertible "about 60k" is neither cleared nor coerced.
    expect(await valueBytes("score")).toEqual(before);
  });

  it("snapshots ONLY non-null values (a contact with no value gets no history row)", async () => {
    await createField(exec, newDef({ col_name: "score", type: "number" }));
    const a = await seedContact("Alex");
    await seedContact("Bo"); // row exists but value is null
    await setValue("score", a, "42");

    const id = await defId("score");
    await applyTypeChange(
      exec,
      { id, col_name: "score", type: "number" },
      "text",
      LATER,
    );

    const hist = await exec.getAllAsync<{ contact_id: number }>(
      "SELECT contact_id FROM field_history",
    );
    expect(hist).toEqual([{ contact_id: a }]);
  });
});
