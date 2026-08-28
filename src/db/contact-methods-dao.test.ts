import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  applyContactMethodDiff,
  listContactMethods,
  type ContactMethodDraft,
} from "@/db/contact-methods-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-28 10:00:00";
let counter = 0;
const uid = () => `method-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration009], 9, { now: NOW, newUid: uid, defaultPhoneRegion: "US" });
});

async function contact(name = "Method owner"): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

const phone = (value: string, overrides: Partial<ContactMethodDraft> = {}): ContactMethodDraft => ({ uid: uid(), type: "phone", value, ...overrides });
const email = (value: string, overrides: Partial<ContactMethodDraft> = {}): ContactMethodDraft => ({ uid: uid(), type: "email", value, ...overrides });

describe("applyContactMethodDiff", () => {
  it("stores ordered normalized rows with canonical_region and treats a singleton as primary", async () => {
    const contactId = await contact();
    await applyContactMethodDiff(exec, { contactId, seeded: [], current: [phone("(312) 555-1234"), email("Person@Example.com")], now: NOW, effectivePhoneRegion: "US" });
    expect(await listContactMethods(exec, contactId)).toMatchObject([
      { method_type: "phone", canonical_value: "+13125551234", canonical_region: "US", is_actionable: 1, is_primary: 1, display_order: 0 },
      { method_type: "email", canonical_value: "person@example.com", canonical_region: null, is_actionable: 1, is_primary: 1, display_order: 0 },
    ]);
  });

  it("keeps raw/non-actionable values with a NULL canonical_region", async () => {
    const contactId = await contact();
    await applyContactMethodDiff(exec, { contactId, seeded: [], current: [phone("not a phone")], now: NOW, effectivePhoneRegion: "US" });
    expect(await listContactMethods(exec, contactId)).toMatchObject([{ raw_value: "not a phone", canonical_value: null, canonical_region: null, is_actionable: 0 }]);
  });

  it("collapses same-contact canonical duplicates and returns the surviving draft uid", async () => {
    const contactId = await contact();
    const first = phone("312 555 1234");
    const duplicate = phone("+1 312 555 1234");
    const result = await applyContactMethodDiff(exec, { contactId, seeded: [], current: [first, duplicate], now: NOW, effectivePhoneRegion: "US" });
    expect(result).toMatchObject({ status: "canonicalDuplicate", methodType: "phone", survivingDraftUid: first.uid });
    expect(await listContactMethods(exec, contactId)).toHaveLength(1);
  });

  it("does not treat a canonical match owned by another contact as a collision", async () => {
    const first = await contact("First");
    const second = await contact("Second");
    await applyContactMethodDiff(exec, { contactId: first, seeded: [], current: [phone("312 555 1234")], now: NOW, effectivePhoneRegion: "US" });
    expect((await applyContactMethodDiff(exec, { contactId: second, seeded: [], current: [phone("+1 312 555 1234")], now: NOW, effectivePhoneRegion: "US" })).status).toBe("saved");
    expect(await listContactMethods(exec, second)).toHaveLength(1);
  });

  it("promotes the next stored row of a type when its primary is removed", async () => {
    const contactId = await contact();
    await applyContactMethodDiff(exec, { contactId, seeded: [], current: [phone("312 555 1234"), phone("773 555 1234")], now: NOW, effectivePhoneRegion: "US" });
    const seeded = await listContactMethods(exec, contactId);
    await applyContactMethodDiff(exec, { contactId, seeded, current: [{ id: seeded[1].id, uid: seeded[1].uid, type: "phone", value: seeded[1].raw_value }], now: NOW, effectivePhoneRegion: "US" });
    expect(await listContactMethods(exec, contactId)).toMatchObject([{ id: seeded[1].id, is_primary: 1 }]);
  });

  it("rolls back inserts and tombstones when a later seeded deletion cannot match", async () => {
    const contactId = await contact();
    await applyContactMethodDiff(exec, { contactId, seeded: [], current: [phone("312 555 1234")], now: NOW, effectivePhoneRegion: "US" });
    const [stored] = await listContactMethods(exec, contactId);
    await expect(applyContactMethodDiff(exec, { contactId, seeded: [...(await listContactMethods(exec, contactId)), { ...stored, id: 99999, uid: "phantom" }], current: [phone("773 555 1234")], now: NOW, effectivePhoneRegion: "US" })).rejects.toThrow();
    expect(await listContactMethods(exec, contactId)).toHaveLength(1);
    expect(await exec.getAllAsync("SELECT * FROM tombstones WHERE entity_type = 'contact_method'")).toEqual([]);
  });
});
