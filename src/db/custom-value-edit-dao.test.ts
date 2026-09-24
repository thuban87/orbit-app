import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createContactFull, updateContactFull } from "@/db/contacts-dao";
import { saveUserCustomValueEdit } from "@/db/custom-value-edit-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { createField } from "@/db/field-ddl";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-23 12:00:00";
let exec: SqlExecutor;
let sequence = 0;
const uid = () => `edit-${++sequence}`;

beforeEach(async () => {
  sequence = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function setup(retained: number) {
  const rapid = await createContactFull(exec, {
    uid: uid(),
    name: "Rapid",
    intervalDays: 30,
    now: NOW,
  });
  const full = await createContactFull(exec, {
    uid: uid(),
    name: "Full",
    intervalDays: 30,
    now: NOW,
  });
  await createField(exec, {
    uid: uid(),
    col_name: `note_${retained}`,
    label: "Note",
    type: "text",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: 0,
    share_with_ai: 0,
    history_retained: retained as 0 | 1,
    now: NOW,
  });
  const def = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE col_name = ?",
    [`note_${retained}`],
  );
  if (!def) throw new Error("missing definition");
  return { rapidId: rapid.contactId, fullId: full.contactId, defId: def.id };
}

async function snapshot(contactId: number, fieldDefId: number) {
  const pair = await exec.getFirstAsync<{ uid: string; value: string | null }>(
    "SELECT uid, value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
    [contactId, fieldDefId],
  );
  const history = await exec.getAllAsync<{ value: string | null }>(
    "SELECT value FROM custom_field_value_history WHERE contact_id = ? AND field_def_id = ? ORDER BY id",
    [contactId, fieldDefId],
  );
  return { pair, history: history.map((row) => row.value) };
}

describe("shared user custom-value edit", () => {
  for (const retained of [0, 1]) {
    it(`matches full-editor first, unchanged, changed and cleared edits (retained=${retained})`, async () => {
      const { rapidId, fullId, defId } = await setup(retained);
      let priorRapidUid: string | undefined;
      let priorFullUid: string | undefined;
      for (const [index, value] of [
        "raw  text",
        "raw  text",
        "next",
        null,
      ].entries()) {
        const now = `2026-09-23 12:0${index}:00`;
        await saveUserCustomValueEdit(exec, {
          contactId: rapidId,
          fieldDefId: defId,
          value,
          now,
        });
        await updateContactFull(exec, {
          id: fullId,
          name: "Full",
          intervalDays: 30,
          rarelyResponds: 0,
          remindersOff: 0,
          now,
          customValues: [{ fieldDefId: defId, value }],
        });
        const rapid = await snapshot(rapidId, defId);
        const full = await snapshot(fullId, defId);
        expect(rapid.pair?.value).toEqual(full.pair?.value);
        expect(rapid.history).toEqual(full.history);
        if (priorRapidUid) expect(rapid.pair?.uid).toBe(priorRapidUid);
        if (priorFullUid) expect(full.pair?.uid).toBe(priorFullUid);
        priorRapidUid = rapid.pair?.uid;
        priorFullUid = full.pair?.uid;
      }
      expect(
        (
          await exec.getFirstAsync<{ n: number }>(
            "SELECT COUNT(*) AS n FROM field_history",
          )
        )?.n,
      ).toBe(0);
    });
  }

  it("does not write or bump data_revision for an unchanged rapid edit", async () => {
    const { rapidId, defId } = await setup(1);
    await saveUserCustomValueEdit(exec, {
      contactId: rapidId,
      fieldDefId: defId,
      value: "same",
      now: NOW,
    });
    const before = await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id = 1",
    );
    const pair = await snapshot(rapidId, defId);
    await saveUserCustomValueEdit(exec, {
      contactId: rapidId,
      fieldDefId: defId,
      value: "same",
      now: "2026-09-23 12:10:00",
    });
    expect(
      await exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id = 1",
      ),
    ).toEqual(before);
    expect(await snapshot(rapidId, defId)).toEqual(pair);
  });

  it("rolls back history and value if upsert fails after history append", async () => {
    const { rapidId, defId } = await setup(1);
    await saveUserCustomValueEdit(exec, {
      contactId: rapidId,
      fieldDefId: defId,
      value: "before",
      now: NOW,
    });
    const before = await snapshot(rapidId, defId);
    const failingExec: SqlExecutor = {
      ...exec,
      runAsync: (sql, params) =>
        sql.includes("INSERT INTO custom_field_values (")
          ? Promise.reject(new Error("injected upsert failure"))
          : exec.runAsync(sql, params),
    };
    await expect(
      saveUserCustomValueEdit(failingExec, {
        contactId: rapidId,
        fieldDefId: defId,
        value: "after",
        now: NOW,
      }),
    ).rejects.toThrow("injected upsert failure");
    expect(await snapshot(rapidId, defId)).toEqual(before);
  });
});
