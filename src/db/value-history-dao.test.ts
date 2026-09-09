import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createContactFull, updateContactFull } from "@/db/contacts-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { createField } from "@/db/field-ddl";
import { runMigrations } from "@/db/migrations/runner";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { listValueHistory } from "@/db/value-history-dao";

const NOW = "2026-09-04 12:00:00";
const LATER = "2026-09-04 12:01:00";
let exec: SqlExecutor;
let sequence = 0;
const uid = () => `history-${++sequence}`;

async function edit(
  contactId: number,
  fieldDefId: number,
  value: string | null,
  now = LATER,
): Promise<void> {
  await updateContactFull(exec, {
    id: contactId,
    name: "Alex",
    intervalDays: 30,
    rarelyResponds: 0,
    remindersOff: 0,
    now,
    customValues: [{ fieldDefId, value }],
  });
}

beforeEach(async () => {
  sequence = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

describe("retained custom-field value history", () => {
  it("allows history reads through a structurally read-only snapshot executor", async () => {
    const readOnly: ReadOnlyExecutor = {
      getFirstAsync: exec.getFirstAsync.bind(exec),
      getAllAsync: exec.getAllAsync.bind(exec),
    };
    expect(await listValueHistory(readOnly, 999, 999)).toEqual([]);
  });
  it("records changing prior raw values through the real updateContactFull edit path", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Alex",
      intervalDays: 30,
      now: NOW,
    });
    await createField(exec, {
      uid: uid(),
      col_name: "note",
      label: "Note",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      display_order: 0,
      share_with_ai: 0,
      history_retained: 1,
      now: NOW,
    });
    const def = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM custom_field_defs WHERE col_name = 'note'",
    );
    if (!def) throw new Error("missing field definition");

    await edit(contactId, def.id, "raw  x", "2026-09-04 12:01:00"); // first set: null prior
    await edit(contactId, def.id, "raw  x", "2026-09-04 12:02:00"); // unchanged
    await edit(contactId, def.id, "next", "2026-09-04 12:03:00");
    await edit(contactId, def.id, null, "2026-09-04 12:04:00");

    expect(
      (await listValueHistory(exec, contactId, def.id)).map((row) => row.value),
    ).toEqual(["next", "raw  x"]);
  });

  it("never appends a non-history definition", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Alex",
      intervalDays: 30,
      now: NOW,
    });
    await createField(exec, {
      uid: uid(),
      col_name: "plain",
      label: "Plain",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      display_order: 0,
      share_with_ai: 0,
      now: NOW,
    });
    const def = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM custom_field_defs WHERE col_name = 'plain'",
    );
    if (!def) throw new Error("missing field definition");
    await edit(contactId, def.id, "one");
    await edit(contactId, def.id, "two", "2026-09-04 12:02:00");
    expect(await listValueHistory(exec, contactId, def.id)).toEqual([]);
  });

  it("rejects a second contact writing a directly-present contact-scoped def", async () => {
    const owner = await createContactFull(exec, {
      uid: uid(),
      name: "Owner",
      intervalDays: 30,
      now: NOW,
    });
    const other = await createContactFull(exec, {
      uid: uid(),
      name: "Other",
      intervalDays: 30,
      now: NOW,
    });
    const def = await exec.runAsync(
      `INSERT INTO custom_field_defs (
         uid, col_name, label, type, options, show_on_new, always_show,
         display_order, share_with_ai, scope, history_retained, field_group, created_at, modified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid(),
        "private",
        "Private",
        "text",
        null,
        0,
        0,
        0,
        0,
        "contact",
        0,
        null,
        NOW,
        NOW,
      ],
    );
    await edit(owner.contactId, def.lastInsertRowId, "owner value");
    await expect(
      edit(other.contactId, def.lastInsertRowId, "not allowed"),
    ).rejects.toThrow(/belongs to a different contact/);
    expect(
      await exec.getFirstAsync(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [other.contactId, def.lastInsertRowId],
      ),
    ).toBeNull();
  });

  it("rolls back both the current-value update and appended history together", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Alex",
      intervalDays: 30,
      now: NOW,
    });
    await createField(exec, {
      uid: uid(),
      col_name: "atomic",
      label: "Atomic",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      display_order: 0,
      share_with_ai: 0,
      history_retained: 1,
      now: NOW,
    });
    const def = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM custom_field_defs WHERE col_name = 'atomic'",
    );
    if (!def) throw new Error("missing field definition");
    await edit(contactId, def.id, "before");
    await expect(
      updateContactFull(exec, {
        id: contactId,
        name: "Alex",
        intervalDays: 30,
        rarelyResponds: 0,
        remindersOff: 0,
        now: "2026-09-04 12:02:00",
        customValues: [
          { fieldDefId: def.id, value: "after" },
          { fieldDefId: 999999, value: "fail" },
        ],
      }),
    ).rejects.toThrow();
    expect(
      await exec.getFirstAsync(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [contactId, def.id],
      ),
    ).toEqual({ value: "before" });
    expect(await listValueHistory(exec, contactId, def.id)).toEqual([]);
  });
});
