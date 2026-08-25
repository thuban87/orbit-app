/**
 * Type-change behavior over normalized `custom_field_values` rows.
 *
 * These fixtures deliberately seed definitions and immutable value rows directly
 * after migration 006. That keeps this regression coverage independent from the
 * field DDL and lifecycle DAOs executing alongside this plan.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  applyTypeChange,
  preflightOptionsChange,
  preflightTypeChange,
} from "@/db/field-type-change";
import type { CustomFieldDef } from "@/db/field-types";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { runMigrations } from "@/db/migrations/runner";
import type { FieldType } from "@/schemas/types";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-24 12:00:00";
const LATER = "2026-08-25 09:30:00";

let uidCounter = 0;
let defIdCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  defIdCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(
    exec,
    [migration001, migration002, migration003, migration004, migration005, migration006],
    6,
    { now: NOW, newUid: uid },
  );
});

function field(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: ++defIdCounter,
    uid: uid(),
    col_name: "score",
    label: "Score",
    type: "text",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: 0,
    quarantined_at: null,
    share_with_ai: 0,
    created_at: NOW,
    modified_at: NOW,
    ...overrides,
  };
}

async function persistField(definition: CustomFieldDef): Promise<void> {
  await exec.runAsync(
    `INSERT INTO custom_field_defs (
       id, uid, col_name, label, type, options, show_on_new, always_show,
       display_order, quarantined_at, share_with_ai, created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      definition.id,
      definition.uid,
      definition.col_name,
      definition.label,
      definition.type,
      definition.options,
      definition.show_on_new,
      definition.always_show,
      definition.display_order,
      definition.quarantined_at,
      definition.share_with_ai,
      definition.created_at,
      definition.modified_at,
    ],
  );
}

async function contact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function value(
  contactId: number,
  fieldDefId: number,
  raw: string | null,
  valueUid = uid(),
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO custom_field_values (
       uid, contact_id, field_def_id, value, created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [valueUid, contactId, fieldDefId, raw, NOW, NOW],
  );
}

describe("preflightTypeChange — normalized raw-TEXT parser partitions", () => {
  const parserCases: ReadonlyArray<{
    type: FieldType;
    clean: string;
    invalid: string;
  }> = [
    { type: "text", clean: "about 60k", invalid: "also text" },
    { type: "textarea", clean: "line one\nline two", invalid: "also text" },
    { type: "dropdown", clean: "out-of-list is parser-valid", invalid: "also text" },
    { type: "photo", clean: "file:///orbit/photo.jpg", invalid: "also text" },
    { type: "number", clean: "1,000", invalid: "about 60k" },
    { type: "date", clean: "2026-08-24 trailing note", invalid: "not a date" },
    { type: "toggle", clean: "yes", invalid: "perhaps" },
  ];

  it.each(parserCases)("uses the existing $type parser over raw normalized TEXT", async ({
    type,
    clean,
    invalid,
  }) => {
    const definition = field({ col_name: `field_${type}` });
    await persistField(definition);
    const validContact = await contact(`${type} valid`);
    const invalidContact = await contact(`${type} invalid`);
    await value(validContact, definition.id, clean);
    await value(invalidContact, definition.id, invalid);

    const identityParser = ["text", "textarea", "dropdown", "photo"].includes(type);
    await expect(preflightTypeChange(exec, definition, type)).resolves.toEqual({
      total: 2,
      convert: identityParser ? [validContact, invalidContact] : [validContact],
      flag: identityParser ? [] : [invalidContact],
    });
  });

  it("uses the bound field_def_id, excludes NULL rows, and never reads a second field", async () => {
    const target = field({ col_name: "target" });
    const unrelated = field({ col_name: "unrelated" });
    await persistField(target);
    await persistField(unrelated);
    const targetContact = await contact("Target");
    const unrelatedContact = await contact("Unrelated");
    const emptyContact = await contact("Empty");
    await value(targetContact, target.id, "7");
    await value(unrelatedContact, unrelated.id, "about 60k");
    await value(emptyContact, target.id, null);

    await expect(preflightTypeChange(exec, target, "number")).resolves.toEqual({
      total: 1,
      convert: [targetContact],
      flag: [],
    });
  });

  it("does not rewrite raw number/toggle bytes or immutable row identities", async () => {
    const definition = field({ col_name: "legacy" });
    await persistField(definition);
    const numeric = await contact("Numeric");
    const toggle = await contact("Toggle");
    await value(numeric, definition.id, "1,000", "number-value-uid");
    await value(toggle, definition.id, "yes", "toggle-value-uid");
    const before = await rowsFor(definition.id);

    await preflightTypeChange(exec, definition, "number");
    await preflightTypeChange(exec, definition, "toggle");

    expect(await rowsFor(definition.id)).toEqual(before);
  });
});

describe("preflightOptionsChange — normalized dropdown membership", () => {
  it("flags out-of-list raw values while retaining the field-object API", async () => {
    const definition = field({
      col_name: "tier",
      type: "dropdown",
      options: JSON.stringify(["basic", "premium"]),
    });
    await persistField(definition);
    const keep = await contact("Keep");
    const flag = await contact("Flag");
    await value(keep, definition.id, "basic");
    await value(flag, definition.id, "legacy");

    await expect(
      preflightOptionsChange(exec, definition, JSON.stringify(["basic"])),
    ).resolves.toEqual({ total: 2, keep: [keep], flag: [flag] });
  });
});

describe("applyTypeChange — metadata-only update and normalized audit snapshot", () => {
  it("snapshots target raw values under col_name without changing value bytes or uids", async () => {
    const definition = field({ col_name: "score", type: "number" });
    const unrelated = field({ col_name: "unrelated", type: "text" });
    await persistField(definition);
    await persistField(unrelated);
    const a = await contact("Alex");
    const b = await contact("Bo");
    await value(a, definition.id, "1,000", "target-a-uid");
    await value(b, definition.id, "about 60k", "target-b-uid");
    await value(a, unrelated.id, "do not snapshot", "unrelated-uid");
    const before = await rowsFor(definition.id);

    await applyTypeChange(exec, definition, "text", LATER);

    expect(await exec.getFirstAsync<{ type: string; modified_at: string }>(
      "SELECT type, modified_at FROM custom_field_defs WHERE id = ?",
      [definition.id],
    )).toEqual({ type: "text", modified_at: LATER });
    expect(await exec.getAllAsync<{
      contact_id: number;
      field_col_name: string;
      old_value: string;
      operation: string;
      created_at: string;
    }>(
      "SELECT contact_id, field_col_name, old_value, operation, created_at FROM field_history ORDER BY contact_id",
    )).toEqual([
      {
        contact_id: a,
        field_col_name: "score",
        old_value: "1,000",
        operation: "type_change:number->text",
        created_at: LATER,
      },
      {
        contact_id: b,
        field_col_name: "score",
        old_value: "about 60k",
        operation: "type_change:number->text",
        created_at: LATER,
      },
    ]);
    expect(await rowsFor(definition.id)).toEqual(before);
    expect(await rowsFor(unrelated.id)).toEqual([
      { contact_id: a, uid: "unrelated-uid", hx: "646F206E6F7420736E617073686F74" },
    ]);
  });
});

async function rowsFor(fieldDefId: number) {
  return exec.getAllAsync<{ contact_id: number; uid: string; hx: string | null }>(
    `SELECT contact_id, uid, hex(value) AS hx
       FROM custom_field_values
      WHERE field_def_id = ?
      ORDER BY contact_id`,
    [fieldDefId],
  );
}
