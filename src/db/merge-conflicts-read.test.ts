import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { readMergeConflictData } from "@/db/merge-conflicts-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

/**
 * Merge conflicts read (38.12 D-44 DAO rule, D-129): the conflict data the
 * Merge conflicts screen shows, read through a DAO. A photo-type field whose
 * two values are stored photos is a photo choice; text left in a photo field is
 * shown as text.
 */

const NOW = "2026-10-17 12:00:00";
let exec: SqlExecutor;
let n = 0;
const uid = () => `uid-${++n}`;

async function contact(
  name: string,
  extra: { birthday?: string; photo?: string; archived?: boolean } = {},
): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO contacts (uid, name, birthday, photo, archived_at, tracking_enabled, created_at, modified_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
    [
      uid(),
      name,
      extra.birthday ?? null,
      extra.photo ?? null,
      extra.archived ? NOW : null,
      NOW,
      NOW,
    ],
  );
  return row.lastInsertRowId;
}
async function def(
  label: string,
  type: string,
  order: number,
  colName = label.toLowerCase(),
): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [uid(), colName, label, type, order, NOW, NOW],
  );
  return row.lastInsertRowId;
}
async function value(
  contactId: number,
  fieldDefId: number,
  text: string | null,
): Promise<void> {
  await exec.runAsync(
    "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
    [uid(), contactId, fieldDefId, text, NOW, NOW],
  );
}
async function method(
  contactId: number,
  type: "phone" | "email",
  raw: string,
): Promise<void> {
  await exec.runAsync(
    "INSERT INTO contact_methods (uid, contact_id, method_type, raw_value, display_value, canonical_value, is_primary, display_order, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)",
    [uid(), contactId, type, raw, raw, raw, NOW, NOW],
  );
}

beforeEach(async () => {
  n = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

describe("readMergeConflictData", () => {
  it("reads both contacts, differing custom values and primary-method conflicts", async () => {
    const survivor = await contact("Ana", { birthday: "1990-01-01" });
    const absorbed = await contact("Anna", { birthday: "1990-01-02" });
    const nickname = await def("Nickname", "text", 0);
    const same = await def("Team", "text", 1);
    await value(survivor, nickname, "A");
    await value(absorbed, nickname, "Annie");
    await value(survivor, same, "Tuesday");
    await value(absorbed, same, "Tuesday");
    await method(survivor, "phone", "+15550001");
    await method(absorbed, "phone", "+15550002");
    await method(survivor, "email", "a@example.com");
    await method(absorbed, "email", "a@example.com");

    const data = await readMergeConflictData(exec, survivor, absorbed);
    expect(data.survivor.name).toBe("Ana");
    expect(data.absorbed.birthday).toBe("1990-01-02");
    expect(data.customFields).toEqual([
      {
        field_def_id: nickname,
        label: "Nickname",
        type: "text",
        kind: "text",
        survivor_value: "A",
        absorbed_value: "Annie",
      },
    ]);
    expect(Object.keys(data.primaryByType)).toEqual(["phone"]);
    expect(data.primaryByType.phone?.absorbed.raw_value).toBe("+15550002");
  });

  it("marks a photo-type field with two stored photos as a photo choice", async () => {
    const survivor = await contact("Ana");
    const absorbed = await contact("Anna");
    const portrait = await def("Portrait", "photo", 0);
    await value(survivor, portrait, `avatars/cv-${survivor}-portrait.jpg`);
    await value(absorbed, portrait, `avatars/cv-${absorbed}-portrait.jpg`);

    const data = await readMergeConflictData(exec, survivor, absorbed);
    expect(data.customFields).toHaveLength(1);
    expect(data.customFields[0]?.kind).toBe("photo");
  });

  it("shows text left in a photo field as text", async () => {
    const survivor = await contact("Ana");
    const absorbed = await contact("Anna");
    const portrait = await def("Portrait", "photo", 0);
    await value(survivor, portrait, "Rex");
    await value(absorbed, portrait, "hello");

    const data = await readMergeConflictData(exec, survivor, absorbed);
    expect(data.customFields[0]).toMatchObject({
      kind: "text",
      survivor_value: "Rex",
      absorbed_value: "hello",
    });
  });

  it("shows a photo field holding a photo on one side and text on the other as text", async () => {
    const survivor = await contact("Ana");
    const absorbed = await contact("Anna");
    const portrait = await def("Portrait", "photo", 0);
    await value(survivor, portrait, `avatars/cv-${survivor}-portrait.jpg`);
    await value(absorbed, portrait, "hello");

    const data = await readMergeConflictData(exec, survivor, absorbed);
    expect(data.customFields[0]?.kind).toBe("text");
  });

  it("rejects when either contact is in the Bin or gone", async () => {
    const survivor = await contact("Ana");
    const absorbed = await contact("Anna", { archived: true });
    await expect(
      readMergeConflictData(exec, survivor, absorbed),
    ).rejects.toThrow();
    await expect(readMergeConflictData(exec, survivor, 9999)).rejects.toThrow();
  });
});
