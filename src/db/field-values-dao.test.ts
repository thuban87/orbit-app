import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import type { CustomFieldDef } from "@/db/field-types";
import {
  defsForCreateForm,
  defsForEditForm,
  getValuesForContact,
  upsertValue,
  visibleDefsForProfile,
} from "@/db/field-values-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-24 12:00:00";
const LATER = "2026-08-25 09:00:00";
let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let idCounter = 0;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  idCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(
    exec,
    [migration001, migration002, migration003, migration004, migration005, migration006, migration007],
    7,
    { now: NOW, newUid: uid },
  );
});

function def(overrides: Partial<CustomFieldDef> & { col_name: string }): CustomFieldDef {
  return {
    id: ++idCounter,
    uid: uid(),
    label: overrides.col_name,
    type: "text",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: 0,
    quarantined_at: null,
    share_with_ai: 0,
    scope: "global",
    history_retained: 0,
    field_group: null,
    created_at: NOW,
    modified_at: NOW,
    ...overrides,
  };
}

async function persistDef(definition: CustomFieldDef): Promise<void> {
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

async function makeContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function valueRow(contactId: number, fieldDefId: number) {
  return exec.getFirstAsync<{
    uid: string;
    value: string | null;
    created_at: string;
    modified_at: string;
  }>(
    `SELECT uid, value, created_at, modified_at
       FROM custom_field_values
      WHERE contact_id = ? AND field_def_id = ?`,
    [contactId, fieldDefId],
  );
}

describe("normalized custom-value reads", () => {
  it("returns only values for the passed definition list", async () => {
    const contactId = await makeContact();
    const visible = def({ col_name: "visible", share_with_ai: 1 });
    const quarantined = def({ col_name: "quarantined", quarantined_at: NOW });
    const privateDef = def({ col_name: "private", share_with_ai: 0 });
    await Promise.all([persistDef(visible), persistDef(quarantined), persistDef(privateDef)]);
    await Promise.all([
      upsertValue(exec, contactId, visible.id, uid(), "shown", NOW),
      upsertValue(exec, contactId, quarantined.id, uid(), "hidden-quarantine", NOW),
      upsertValue(exec, contactId, privateDef.id, uid(), "hidden-private", NOW),
    ]);

    await expect(getValuesForContact(exec, contactId, [visible])).resolves.toEqual({
      visible: "shown",
    });
    await expect(getValuesForContact(exec, contactId, [])).resolves.toEqual({});
  });
});

describe("normalized custom-value UPSERT", () => {
  it("updates an existing pair without rewriting its immutable uid or created_at", async () => {
    const contactId = await makeContact();
    const definition = def({ col_name: "nickname" });
    await persistDef(definition);
    await upsertValue(exec, contactId, definition.id, "first-uid", "Ace", NOW);
    await upsertValue(exec, contactId, definition.id, "second-uid", "Bee", LATER);

    expect(await valueRow(contactId, definition.id)).toEqual({
      uid: "first-uid",
      value: "Bee",
      created_at: NOW,
      modified_at: LATER,
    });
  });

  it("clears to NULL without deleting or re-keying the pair row", async () => {
    const contactId = await makeContact();
    const definition = def({ col_name: "nickname" });
    await persistDef(definition);
    await upsertValue(exec, contactId, definition.id, "pair-uid", "Ace", NOW);
    await upsertValue(exec, contactId, definition.id, "ignored-uid", null, LATER);

    expect(await valueRow(contactId, definition.id)).toEqual({
      uid: "pair-uid",
      value: null,
      created_at: NOW,
      modified_at: LATER,
    });
  });

  it("self-heals a missing pair with uid and both required timestamps", async () => {
    const contactId = await makeContact();
    const definition = def({ col_name: "nickname" });
    await persistDef(definition);

    await upsertValue(exec, contactId, definition.id, "new-pair-uid", "Ace", LATER);

    expect(await valueRow(contactId, definition.id)).toEqual({
      uid: "new-pair-uid",
      value: "Ace",
      created_at: LATER,
      modified_at: LATER,
    });
  });
});

describe("visibility selectors — the three §14.7 surfaces (FLD-07)", () => {
  const onNew = def({ col_name: "nickname", show_on_new: 1, display_order: 2 });
  const alwaysShown = def({ col_name: "birthday", always_show: 1, display_order: 0 });
  const plain = def({ col_name: "city", display_order: 1 });
  const quarantined = def({
    col_name: "old_field",
    show_on_new: 1,
    always_show: 1,
    display_order: 3,
    quarantined_at: NOW,
  });
  const allDefs = [onNew, alwaysShown, plain, quarantined];
  const cols = (defs: CustomFieldDef[]) => defs.map((definition) => definition.col_name);

  it("preserves the existing pure create, edit, and profile placement rules", () => {
    expect(cols(defsForCreateForm(allDefs))).toEqual(["nickname"]);
    expect(cols(defsForEditForm(allDefs))).toEqual(["birthday", "city", "nickname"]);
    expect(cols(visibleDefsForProfile(allDefs, { city: "Leeds", nickname: null }))).toEqual([
      "birthday",
      "city",
    ]);
  });
});
