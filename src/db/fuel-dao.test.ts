/**
 * The Off Limits shim behind the retired knowledge-table DAO names
 * (Phase 38.10 plan 02; D-01, D-08, D-11, D-56).
 *
 *   - addFuel routes by kind: off_limits -> off_limits; gift / topic / fact ->
 *     a Gift Ideas / Thought of Them / general memory with Allow AI off, share
 *     provenance kept; recent -> a dated Last Talked About entry (plan 03).
 *   - editFuel / deleteFuel reach only off_limits, scoped by (id, contact_id).
 *   - addFuelCore composes inside a caller-opened inWriteTransaction.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { setAiPermissionDefault } from "@/db/ai-permissions-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addFuel,
  addFuelCore,
  deleteFuel,
  deleteFuelCore,
  editFuel,
} from "@/db/fuel-dao";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";
const LATER = "2026-08-16 09:30:00";

let counter = 0;
let exec: SqlExecutor;

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

async function offLimitsRows(contactId: number) {
  return exec.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM off_limits WHERE contact_id = ? ORDER BY id",
    [contactId],
  );
}

async function memoryRows(contactId: number) {
  return exec.getAllAsync<Record<string, unknown>>(
    `SELECT type, custom_label, value, url, provenance, allow_ai, created_at
       FROM memories WHERE contact_id = ? ORDER BY id`,
    [contactId],
  );
}

async function revision(): Promise<number> {
  return (await exec.getFirstAsync<{ data_revision: number }>(
    "SELECT data_revision FROM app_settings WHERE id = 1",
  ))!.data_revision;
}

describe("addFuel — routes by kind (D-56)", () => {
  it("off_limits lands in off_limits with the caller's uid and stamps", async () => {
    const c = await seedContact();
    const id = await addFuel(exec, {
      uid: "fuel-uid-1",
      contactId: c,
      kind: "off_limits",
      label: "Health",
      text: "Do not ask",
      url: "https://example.test",
      createdAt: NOW,
      source: "user",
      now: LATER,
    });
    expect(await offLimitsRows(c)).toEqual([
      {
        id,
        uid: "fuel-uid-1",
        contact_id: c,
        label: "Health",
        text: "Do not ask",
        url: "https://example.test",
        group_note_copy: 0,
        from_share: 0,
        created_at: NOW,
        modified_at: LATER,
      },
    ]);
    expect(await memoryRows(c)).toEqual([]);
  });

  it("a share off_limits add is marked from_share (D-108)", async () => {
    const c = await seedContact();
    await addFuel(exec, {
      uid: "fuel-share",
      contactId: c,
      kind: "off_limits",
      text: "Shared",
      createdAt: NOW,
      source: "share",
      now: NOW,
    });
    expect((await offLimitsRows(c))[0]).toMatchObject({ from_share: 1 });
  });

  it("gift / topic / fact land as Gift Ideas / Thought of Them / general memories, AI-off even under ON defaults", async () => {
    const c = await seedContact();
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    for (const kind of ["gift", "topic", "fact"] as const) {
      await addFuel(exec, {
        uid: `fuel-${kind}`,
        contactId: c,
        kind,
        label: kind === "gift" ? "Birthday" : null,
        text: `${kind} text`,
        createdAt: NOW,
        source: kind === "topic" ? "share" : "user",
        now: NOW,
      });
    }
    expect(await memoryRows(c)).toEqual([
      {
        type: "gift_idea",
        custom_label: "Birthday",
        value: "gift text",
        url: null,
        provenance: "user",
        allow_ai: 0,
        created_at: NOW,
      },
      {
        type: "thought_of_them",
        custom_label: null,
        value: "topic text",
        url: null,
        provenance: "share",
        allow_ai: 0,
        created_at: NOW,
      },
      {
        type: "general",
        custom_label: null,
        value: "fact text",
        url: null,
        provenance: "user",
        allow_ai: 0,
        created_at: NOW,
      },
    ]);
    expect(await offLimitsRows(c)).toEqual([]);
  });

  it("recent lands as a dated Last Talked About entry, url and share origin kept (checker W3)", async () => {
    const c = await seedContact();
    await addFuel(exec, {
      uid: "fuel-recent",
      contactId: c,
      kind: "recent",
      text: "Their new job",
      url: "https://example.test/job",
      createdAt: "2026-08-10 18:00:00",
      source: "share",
      now: NOW,
    });
    expect(
      await exec.getAllAsync(
        `SELECT field_key, value, entry_date, entry_time, url, from_share,
                created_at
           FROM current_state_entries WHERE contact_id = ?`,
        [c],
      ),
    ).toEqual([
      {
        field_key: "last_talked_about",
        value: "Their new job",
        entry_date: "2026-08-10",
        entry_time: null,
        url: "https://example.test/job",
        from_share: 1,
        created_at: "2026-08-10 18:00:00",
      },
    ]);
    expect(await memoryRows(c)).toEqual([]);
    expect(await offLimitsRows(c)).toEqual([]);
  });

  it("refuses a contentless non-Off Limits add and writes nothing", async () => {
    const c = await seedContact();
    await expect(
      addFuel(exec, {
        uid: "fuel-empty",
        contactId: c,
        kind: "topic",
        text: "  ",
        createdAt: NOW,
        source: "user",
        now: NOW,
      }),
    ).rejects.toThrow("needs a label, text or url");
    expect(await memoryRows(c)).toEqual([]);
  });

  it("addFuelCore composes inside a caller-opened transaction", async () => {
    const c = await seedContact();
    const ids = await inWriteTransaction(exec, async () => [
      await addFuelCore(exec, {
        uid: "a",
        contactId: c,
        kind: "off_limits",
        text: "A",
        createdAt: NOW,
        source: "user",
        now: NOW,
      }),
      await addFuelCore(exec, {
        uid: "b",
        contactId: c,
        kind: "off_limits",
        text: "B",
        createdAt: NOW,
        source: "user",
        now: NOW,
      }),
    ]);
    expect((await offLimitsRows(c)).map((row) => row.id)).toEqual(ids);
  });

  it("the add wrapper bumps data_revision exactly once", async () => {
    const c = await seedContact();
    const before = await revision();
    await addFuel(exec, {
      uid: "a",
      contactId: c,
      kind: "off_limits",
      text: "A",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });
    expect(await revision()).toBe(before + 1);
  });
});

describe("editFuel / deleteFuel — Off Limits only, scoped (D-11)", () => {
  async function seedOffLimits(contactId: number, uid: string, text: string) {
    return addFuel(exec, {
      uid,
      contactId,
      kind: "off_limits",
      text,
      createdAt: NOW,
      source: "user",
      now: NOW,
    });
  }

  it("edits only the fields present and leaves created_at alone", async () => {
    const c = await seedContact();
    const id = await seedOffLimits(c, "ol-1", "Original");
    await editFuel(exec, {
      id,
      contactId: c,
      kind: "off_limits",
      label: "New label",
      now: LATER,
    });
    expect((await offLimitsRows(c))[0]).toMatchObject({
      label: "New label",
      text: "Original",
      created_at: NOW,
      modified_at: LATER,
    });
  });

  it("an edit naming another kind throws and changes nothing", async () => {
    const c = await seedContact();
    const id = await seedOffLimits(c, "ol-1", "Original");
    await expect(
      editFuel(exec, {
        id,
        contactId: c,
        kind: "topic",
        text: "X",
        now: LATER,
      }),
    ).rejects.toThrow("only Off Limits entries can be edited");
    expect((await offLimitsRows(c))[0]).toMatchObject({
      text: "Original",
      modified_at: NOW,
    });
  });

  it("refuses another contact's id and an unknown id for edit and delete", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const blairRow = await seedOffLimits(blair, "ol-b", "Blair private");
    await expect(
      editFuel(exec, {
        id: blairRow,
        contactId: alex,
        text: "Hijack",
        now: LATER,
      }),
    ).rejects.toThrow("no Off Limits entry matched");
    await expect(
      deleteFuel(exec, { id: blairRow, contactId: alex, now: LATER }),
    ).rejects.toThrow("no Off Limits entry matched");
    await expect(
      deleteFuel(exec, { id: 9999, contactId: alex, now: LATER }),
    ).rejects.toThrow("no Off Limits entry matched");
    expect((await offLimitsRows(blair))[0]).toMatchObject({
      text: "Blair private",
      modified_at: NOW,
    });
  });

  it("deleteFuel removes the row with an off_limits tombstone and one bump", async () => {
    const c = await seedContact();
    const id = await seedOffLimits(c, "ol-1", "Gone");
    const before = await revision();
    await deleteFuel(exec, { id, contactId: c, now: LATER });
    expect(await offLimitsRows(c)).toEqual([]);
    expect(
      await exec.getAllAsync(
        "SELECT entity_type, entity_uid, deleted_at FROM tombstones WHERE entity_uid = 'ol-1'",
      ),
    ).toEqual([
      { entity_type: "off_limits", entity_uid: "ol-1", deleted_at: LATER },
    ]);
    expect(await revision()).toBe(before + 1);
  });

  it("deleteFuelCore with bumpRevision false does not bump", async () => {
    const c = await seedContact();
    const id = await seedOffLimits(c, "ol-1", "Gone");
    const before = await revision();
    await inWriteTransaction(exec, () =>
      deleteFuelCore(exec, {
        id,
        contactId: c,
        now: LATER,
        bumpRevision: false,
      }),
    );
    expect(await revision()).toBe(before);
  });
});
