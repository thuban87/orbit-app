import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  listActionablePrimaryMethods,
  listContactMethodGroups,
} from "@/db/contact-methods-read";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { runMigrations } from "@/db/migrations/runner";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-28 10:00:00";
let counter = 0;
const uid = () => `read-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
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
      migration007,
      migration009,
      migration010,
    ],
    10,
    { now: NOW, newUid: uid, defaultPhoneRegion: "US" },
  );
});

async function contact(): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid,name,interval_days,created_at,modified_at) VALUES (?,?,?,?,?)",
    [uid(), "Reader", 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function method(
  contactId: number,
  type: "phone" | "email",
  value: string,
  order: number,
  primary = 0,
  actionable = 1,
): Promise<void> {
  await exec.runAsync(
    "INSERT INTO contact_methods (uid,contact_id,method_type,raw_value,display_value,canonical_value,canonical_region,extension,is_actionable,is_primary,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      uid(),
      contactId,
      type,
      value,
      value,
      actionable ? value : null,
      type === "phone" && actionable ? "US" : null,
      null,
      actionable,
      primary,
      order,
      NOW,
      NOW,
    ],
  );
}

describe("contact method reads", () => {
  it("returns ordered groups and excludes non-actionable rows from primary selection", async () => {
    const contactId = await contact();
    await method(contactId, "phone", "invalid", 0, 1, 0);
    await method(contactId, "phone", "+13125551234", 1, 0, 1);
    await method(contactId, "email", "a@example.com", 0, 0, 1);
    const groups = await listContactMethodGroups(exec, contactId);
    expect(groups.phone.map((row) => row.raw_value)).toEqual([
      "invalid",
      "+13125551234",
    ]);
    expect(groups.email.map((row) => row.raw_value)).toEqual(["a@example.com"]);
    expect(await listActionablePrimaryMethods(exec, contactId)).toMatchObject({
      phone: { raw_value: "+13125551234" },
      email: { raw_value: "a@example.com" },
    });
  });

  it("accepts the structurally read-only snapshot executor and preserves complete rows", async () => {
    const contactId = await contact();
    await method(contactId, "phone", "invalid", 0, 1, 0);
    await method(contactId, "phone", "+13125551234", 1, 0, 1);
    const readOnly: ReadOnlyExecutor = {
      getFirstAsync: exec.getFirstAsync.bind(exec),
      getAllAsync: exec.getAllAsync.bind(exec),
    };
    const groups = await listContactMethodGroups(readOnly, contactId);
    expect(groups.phone).toHaveLength(2);
    expect(groups.phone[0]).toMatchObject({
      raw_value: "invalid",
      is_actionable: 0,
    });
  });

  it("returns empty groups and no primary for a contact without methods", async () => {
    const contactId = await contact();
    expect(await listContactMethodGroups(exec, contactId)).toEqual({
      phone: [],
      email: [],
    });
    expect(await listActionablePrimaryMethods(exec, contactId)).toEqual({
      phone: null,
      email: null,
    });
  });
});
