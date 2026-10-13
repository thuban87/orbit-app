/**
 * Off Limits DAO (Phase 38.10 plan 02; D-09, D-11, D-69, F-D4, c9, W6).
 *
 * Re-expresses the D-11 safety tests (workpaper §5d 1) against `off_limits` as
 * cross-contact cases, plus delete with Undo and the revision-bump rule.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { compareRowAndTombstone } from "@/backup/reconciliation";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  addOffLimits,
  addOffLimitsCore,
  deleteOffLimits,
  deleteOffLimitsCore,
  editOffLimits,
  undoDeleteOffLimits,
} from "@/db/off-limits-dao";
import { listOffLimitsForContact } from "@/db/off-limits-read";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";
const LATER = "2026-10-13 13:00:00";
let exec: SqlExecutor;
let counter = 0;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-uid-${++counter}`,
  });
});

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, 30, ?, ?)`,
    [`contact-${++counter}`, name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function revision(): Promise<number> {
  return (await exec.getFirstAsync<{ data_revision: number }>(
    "SELECT data_revision FROM app_settings WHERE id = 1",
  ))!.data_revision;
}

async function rowById(id: number) {
  return exec.getFirstAsync<{
    id: number;
    uid: string;
    contact_id: number;
    label: string | null;
    text: string | null;
    url: string | null;
    group_note_copy: number;
    from_share: number;
    created_at: string;
    modified_at: string;
  }>("SELECT * FROM off_limits WHERE id = ?", [id]);
}

async function tombstone(uid: string) {
  return exec.getFirstAsync<{ deleted_at: string }>(
    "SELECT deleted_at FROM tombstones WHERE entity_type = 'off_limits' AND entity_uid = ?",
    [uid],
  );
}

function add(contactId: number, text = "Their divorce", uid = "ol-1") {
  return addOffLimits(exec, { uid, contactId, text, now: NOW });
}

describe("addOffLimits", () => {
  it("stores every column, defaults the markers to 0 and created_at to now", async () => {
    const contactId = await seedContact();
    const id = await addOffLimits(exec, {
      uid: "ol-1",
      contactId,
      label: "Health",
      text: "Do not ask about the surgery",
      url: "https://example.test",
      now: NOW,
    });
    expect(await rowById(id)).toEqual({
      id,
      uid: "ol-1",
      contact_id: contactId,
      label: "Health",
      text: "Do not ask about the surgery",
      url: "https://example.test",
      group_note_copy: 0,
      from_share: 0,
      created_at: NOW,
      modified_at: NOW,
    });
  });

  it("carries the origin markers and created_at a move passes (D-102, D-108)", async () => {
    const contactId = await seedContact();
    const id = await inWriteTransaction(exec, () =>
      addOffLimitsCore(exec, {
        uid: "ol-moved",
        contactId,
        text: "Moved",
        createdAt: "2026-01-01 08:00:00",
        groupNoteCopy: 1,
        fromShare: 1,
        now: NOW,
      }),
    );
    expect(await rowById(id)).toMatchObject({
      group_note_copy: 1,
      from_share: 1,
      created_at: "2026-01-01 08:00:00",
      modified_at: NOW,
    });
  });

  it("rejects a new row whose label, text and url are all blank", async () => {
    const contactId = await seedContact();
    await expect(
      addOffLimits(exec, {
        uid: "ol-blank",
        contactId,
        label: " ",
        text: "\t",
        url: "",
        now: NOW,
      }),
    ).rejects.toThrow("label, text or url is required");
    expect(await listOffLimitsForContact(exec, contactId)).toEqual([]);
  });

  it("rejects an invalid contact id", async () => {
    await expect(
      addOffLimits(exec, { uid: "x", contactId: 0, text: "x", now: NOW }),
    ).rejects.toThrow("invalid contactId");
  });
});

describe("editOffLimits — scoped by (id, contact_id) (D-11)", () => {
  it("patches only the fields present and leaves created_at alone", async () => {
    const contactId = await seedContact();
    const id = await addOffLimits(exec, {
      uid: "ol-1",
      contactId,
      label: "Work",
      text: "Original",
      now: NOW,
    });
    await editOffLimits(exec, { id, contactId, text: "Edited", now: LATER });
    expect(await rowById(id)).toMatchObject({
      label: "Work",
      text: "Edited",
      created_at: NOW,
      modified_at: LATER,
    });
  });

  it("refuses a foreign-contact id and leaves both contacts' rows untouched", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const alexRow = await add(alex, "Alex private", "ol-a");
    const blairRow = await add(blair, "Blair private", "ol-b");
    await expect(
      editOffLimits(exec, {
        id: blairRow,
        contactId: alex,
        text: "Hijacked",
        now: LATER,
      }),
    ).rejects.toThrow("editOffLimits: no Off Limits entry matched");
    expect((await rowById(alexRow))?.text).toBe("Alex private");
    expect(await rowById(blairRow)).toMatchObject({
      text: "Blair private",
      modified_at: NOW,
    });
  });

  it("refuses an unknown id and an invalid id", async () => {
    const contactId = await seedContact();
    await expect(
      editOffLimits(exec, { id: 999, contactId, text: "x", now: LATER }),
    ).rejects.toThrow("no Off Limits entry matched");
    await expect(
      editOffLimits(exec, { id: -1, contactId, text: "x", now: LATER }),
    ).rejects.toThrow("invalid id");
  });
});

describe("deleteOffLimits / undoDeleteOffLimits (D-69)", () => {
  it("refuses a foreign-contact id and an unknown id without writing a tombstone", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const blairRow = await add(blair, "Blair private", "ol-b");
    await expect(
      deleteOffLimits(exec, { id: blairRow, contactId: alex, now: LATER }),
    ).rejects.toThrow("deleteOffLimits: no Off Limits entry matched");
    await expect(
      deleteOffLimits(exec, { id: 4242, contactId: alex, now: LATER }),
    ).rejects.toThrow("no Off Limits entry matched");
    expect(await rowById(blairRow)).not.toBeNull();
    expect(await tombstone("ol-b")).toBeNull();
  });

  it("hard-deletes with a tombstone, and Undo restores the same id and uid without it", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const id = await addOffLimitsCore(exec, {
      uid: "ol-1",
      contactId: alex,
      label: "L",
      text: "T",
      url: "U",
      groupNoteCopy: 1,
      fromShare: 1,
      now: NOW,
    });
    const blairRow = await add(blair, "Blair private", "ol-b");

    const snapshot = await deleteOffLimits(exec, {
      id,
      contactId: alex,
      now: LATER,
    });
    expect(snapshot).toMatchObject({
      id,
      uid: "ol-1",
      group_note_copy: 1,
      from_share: 1,
      tombstoned_at: LATER,
    });
    expect(snapshot).not.toHaveProperty("deleted_at");
    expect(await rowById(id)).toBeNull();
    expect(await tombstone("ol-1")).toEqual({ deleted_at: LATER });

    const restoredId = await undoDeleteOffLimits(
      exec,
      snapshot,
      "2026-10-13 13:05:00",
    );
    expect(restoredId).toBe(id);
    expect(await rowById(id)).toEqual({
      id,
      uid: "ol-1",
      contact_id: alex,
      label: "L",
      text: "T",
      url: "U",
      group_note_copy: 1,
      from_share: 1,
      created_at: NOW,
      modified_at: "2026-10-13 13:05:00",
    });
    expect(await tombstone("ol-1")).toBeNull();
    expect(
      (await listOffLimitsForContact(exec, alex)).map((r) => r.id),
    ).toEqual([id]);
    expect(await rowById(blairRow)).toMatchObject({ text: "Blair private" });
  });

  it("takes a new id with the same uid when the old id was reused (W6)", async () => {
    const contactId = await seedContact();
    const id = await add(contactId, "First", "ol-1");
    const snapshot = await deleteOffLimits(exec, { id, contactId, now: NOW });
    const intruder = await exec.runAsync(
      `INSERT INTO off_limits (id, uid, contact_id, text, created_at, modified_at)
       VALUES (?, 'ol-intruder', ?, 'Intruder', ?, ?)`,
      [id, contactId, NOW, NOW],
    );
    expect(intruder.lastInsertRowId).toBe(id);

    const restoredId = await undoDeleteOffLimits(exec, snapshot, LATER);
    expect(restoredId).not.toBe(id);
    expect(await rowById(restoredId)).toMatchObject({
      uid: "ol-1",
      text: "First",
    });
    expect(await rowById(id)).toMatchObject({ uid: "ol-intruder" });
  });

  it("Undo in the same second writes modified_at one second after the tombstone (F-D4)", async () => {
    const contactId = await seedContact();
    const id = await add(contactId);
    const snapshot = await deleteOffLimits(exec, { id, contactId, now: LATER });
    const stamp = (await tombstone("ol-1"))!.deleted_at;
    expect(stamp).toBe(LATER);
    const restoredId = await undoDeleteOffLimits(exec, snapshot, LATER);
    const restored = (await rowById(restoredId))!;
    expect(restored.modified_at).toBe("2026-10-13 13:00:01");
    expect(compareRowAndTombstone(restored, { deleted_at: stamp })).toBe("row");
  });

  it("delete → Undo → delete in one second leaves a tombstone that still wins (c9)", async () => {
    const contactId = await seedContact();
    const id = await add(contactId);
    const first = await deleteOffLimits(exec, { id, contactId, now: LATER });
    const restoredId = await undoDeleteOffLimits(exec, first, LATER);
    const restored = (await rowById(restoredId))!;
    const second = await deleteOffLimits(exec, {
      id: restoredId,
      contactId,
      now: LATER,
    });
    const stamp = (await tombstone("ol-1"))!.deleted_at;
    expect(stamp >= restored.modified_at).toBe(true);
    expect(second.tombstoned_at).toBe(stamp);
    expect(compareRowAndTombstone(restored, { deleted_at: stamp })).toBe(
      "tombstone",
    );
  });
});

describe("revision bumps (checker cycle 5 B-2)", () => {
  it("each wrapper advances data_revision by exactly 1", async () => {
    const contactId = await seedContact();
    let before = await revision();
    const id = await add(contactId);
    expect(await revision()).toBe(before + 1);

    before = await revision();
    await editOffLimits(exec, { id, contactId, text: "Edit", now: LATER });
    expect(await revision()).toBe(before + 1);

    before = await revision();
    const snapshot = await deleteOffLimits(exec, { id, contactId, now: LATER });
    expect(await revision()).toBe(before + 1);

    before = await revision();
    await undoDeleteOffLimits(exec, snapshot, LATER);
    expect(await revision()).toBe(before + 1);
  });

  it("deleteOffLimitsCore with bumpRevision false advances it by 0", async () => {
    const contactId = await seedContact();
    const id = await add(contactId);
    const before = await revision();
    await inWriteTransaction(exec, () =>
      deleteOffLimitsCore(exec, {
        id,
        contactId,
        now: LATER,
        bumpRevision: false,
      }),
    );
    expect(await revision()).toBe(before);
    expect(await tombstone("ol-1")).toEqual({ deleted_at: LATER });
  });
});
