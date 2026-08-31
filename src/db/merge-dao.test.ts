import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { mergeContacts, normalizeMergeResolutions } from "@/db/merge-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
const MIGRATIONS = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012, migration013];
let exec: SqlExecutor;
let n = 0;
const uid = () => `uid-${++n}`;

async function contact(name: string): Promise<number> {
  const row = await exec.runAsync("INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, ?, 0, ?, ?)", [uid(), name, NOW, NOW]);
  return row.lastInsertRowId;
}

beforeEach(async () => {
  n = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, 13, { now: NOW, newUid: uid });
});

describe("mergeContacts", () => {
  it("reparents children and field history, then retires the absorbed identity as a tombstone", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    await exec.runAsync("INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at) VALUES (?, ?, ?, ?, 'manual', ?)", [uid(), absorbed, NOW, NOW, NOW]);
    await exec.runAsync("INSERT INTO field_history (contact_id, field_col_name, old_value, operation, created_at) VALUES (?, 'name', 'old', 'edit', ?)", [absorbed, NOW]);
    const absorbedUid = (await exec.getFirstAsync<{ uid: string }>("SELECT uid FROM contacts WHERE id = ?", [absorbed]))!.uid;
    await mergeContacts(exec, { survivorId: survivor, absorbedId: absorbed, now: NOW });
    expect(await exec.getFirstAsync("SELECT id FROM contacts WHERE id = ?", [absorbed])).toBeNull();
    expect(await exec.getFirstAsync<{ contact_id: number }>("SELECT contact_id FROM interactions")).toEqual({ contact_id: survivor });
    expect(await exec.getFirstAsync<{ contact_id: number }>("SELECT contact_id FROM field_history WHERE old_value = 'old'")).toEqual({ contact_id: survivor });
    expect(await exec.getFirstAsync<{ entity_uid: string }>("SELECT entity_uid FROM tombstones WHERE entity_type = 'contact'", [])).toEqual({ entity_uid: absorbedUid });
  });

  it("defaults custom-field collisions to survivor and honours an absorbed resolution", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    const def = await exec.runAsync("INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, 'nickname', 'Nickname', 'text', 0, ?, ?)", [uid(), NOW, NOW]);
    await exec.runAsync("INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, 'survivor', ?, ?), (?, ?, ?, 'absorbed', ?, ?)", [uid(), survivor, def.lastInsertRowId, NOW, NOW, uid(), absorbed, def.lastInsertRowId, NOW, NOW]);
    await mergeContacts(exec, { survivorId: survivor, absorbedId: absorbed, now: NOW, resolutions: { customFields: { [def.lastInsertRowId]: 'absorbed' } } });
    expect(await exec.getFirstAsync<{ value: string }>("SELECT value FROM custom_field_values WHERE contact_id = ?", [survivor])).toEqual({ value: "absorbed" });
  });

  it("rejects self-merges without mutating a contact", async () => {
    const id = await contact("Only");
    await expect(mergeContacts(exec, { survivorId: id, absorbedId: id, now: NOW })).rejects.toThrow("cannot absorb itself");
    expect(await exec.getFirstAsync<{ name: string }>("SELECT name FROM contacts WHERE id = ?", [id])).toEqual({ name: "Only" });
  });

  it("normalizes only known per-type primary choices", () => {
    expect(normalizeMergeResolutions({ primaryMethod: { phone: "absorbed", email: "bad" }, customFields: { 1: "survivor", nope: "absorbed" } })).toEqual({ primaryMethod: { phone: "absorbed" }, customFields: { 1: "survivor" } });
  });
});
