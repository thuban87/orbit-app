/**
 * Last Talked About / Current Location writers (Phase 38.10 D-41, D-45, D-47,
 * D-48, D-69; F-D3, F-D4, G-D1, G-D2, convergence c9).
 *
 *   - adds are plain dated inserts; nothing is demoted or promoted (D-45);
 *   - entry_time is always HH:MM:SS (checker cycle 2 I-4);
 *   - delete writes a tombstone and returns a snapshot; Undo restores the same
 *     uid, re-resolves a link by interaction uid only, re-syncs a restored
 *     link from its source, and stays newer than its tombstone;
 *   - each wrapper advances data_revision by exactly 1.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { compareRowAndTombstone } from "@/backup/reconciliation";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  addCurrentStateEntry,
  addCurrentStateEntryCore,
  deleteCurrentStateEntry,
  deleteCurrentStateEntryCore,
  editHistoryEntry,
  entryDateTimeOf,
  normalizeEntryTime,
  setCurrentStateValueCore,
  undoCurrentStateEntryDelete,
} from "@/db/current-state-history-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { createGroupEvent, detachParticipant } from "@/db/group-events-dao";
import {
  insertLinkedEntryCore,
  LinkedEntryDateError,
} from "@/db/linked-entry-dao";
import { runMigrations } from "@/db/migrations/runner";
import { recordTouchpointWithLinkedEntry } from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";
const LATER = "2026-09-04 13:00:00";

let uidCounter = 0;
const uid = () => `current-state-uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function makeContact(name = "Current state contact"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function entries(contactId: number, fieldKey = "current_location") {
  return exec.getAllAsync<Record<string, unknown>>(
    `SELECT id, uid, value, entry_date, entry_time, url, interaction_id,
            link_source, group_note_copy, from_share, created_at, modified_at
       FROM current_state_entries
      WHERE contact_id = ? AND field_key = ?
      ORDER BY id`,
    [contactId, fieldKey],
  );
}

async function rowByUid(entryUid: string) {
  return exec.getFirstAsync<Record<string, unknown>>(
    `SELECT id, uid, value, entry_date, entry_time, url, interaction_id,
            link_source, group_note_copy, from_share, created_at, modified_at
       FROM current_state_entries WHERE uid = ?`,
    [entryUid],
  );
}

async function revision(): Promise<number> {
  return (await exec.getFirstAsync<{ data_revision: number }>(
    "SELECT data_revision FROM app_settings WHERE id = 1",
  ))!.data_revision;
}

async function tombstoneStamp(entryUid: string): Promise<string | null> {
  return (
    (
      await exec.getFirstAsync<{ deleted_at: string }>(
        "SELECT deleted_at FROM tombstones WHERE entity_type = 'current_state_entry' AND entity_uid = ?",
        [entryUid],
      )
    )?.deleted_at ?? null
  );
}

async function seedInteraction(
  contactId: number,
  note: string | null,
  occurredAt = "2026-09-01 10:00:00",
): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO interactions
         (uid, contact_id, occurred_at, recorded_at, note, source, modified_at)
       VALUES (?, ?, ?, ?, ?, 'manual', ?)`,
      [`interaction-${++uidCounter}`, contactId, occurredAt, NOW, note, NOW],
    )
  ).lastInsertRowId;
}

function addLinked(
  contactId: number,
  interactionId: number,
  linkSource: "note" | "group_note",
  value: string,
  extra: { groupNoteCopy?: 0 | 1 } = {},
) {
  return addCurrentStateEntry(exec, {
    contactId,
    fieldKey: "last_talked_about",
    value,
    entryDate: "2026-09-01",
    entryTime: "10:00:00",
    interactionId,
    linkSource,
    groupNoteCopy: extra.groupNoteCopy,
    now: NOW,
  });
}

describe("setCurrentStateValueCore — a plain dated insert (D-45, D-48)", () => {
  it("creates a direct entry dated today with no time", async () => {
    const contactId = await makeContact();

    await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });

    expect(await entries(contactId)).toEqual([
      expect.objectContaining({
        value: "Chicago",
        entry_date: "2026-09-04",
        entry_time: null,
        interaction_id: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: NOW,
      }),
    ]);
  });

  it("keeps every earlier entry when a new one is added", async () => {
    const contactId = await makeContact();
    await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Madison",
      now: "2026-09-05 12:00:00",
    });

    const rows = await entries(contactId);
    expect(rows.map((row) => [row.value, row.entry_date])).toEqual([
      ["Chicago", "2026-09-04"],
      ["Madison", "2026-09-05"],
    ]);
    // The earlier row is untouched (no demote write).
    expect(rows[0].modified_at).toBe(NOW);
  });

  it("takes an explicit entry date", async () => {
    const contactId = await makeContact();
    await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Their trip",
      entryDate: "2026-08-20",
      now: NOW,
    });
    expect(await entries(contactId, "last_talked_about")).toEqual([
      expect.objectContaining({ entry_date: "2026-08-20", created_at: NOW }),
    ]);
  });

  it("rejects an unknown field and a malformed date before writing rows", async () => {
    const contactId = await makeContact();

    await expect(
      setCurrentStateValueCore(exec, {
        contactId,
        fieldKey: "bogus" as "current_location",
        value: "Nope",
        now: NOW,
      }),
    ).rejects.toThrow("current-state-history-dao: unknown field_key");
    await expect(
      setCurrentStateValueCore(exec, {
        contactId,
        fieldKey: "current_location",
        value: "Nope",
        entryDate: "Sept 4",
        now: NOW,
      }),
    ).rejects.toThrow("entry date must be YYYY-MM-DD");

    const count = await exec.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM current_state_entries WHERE contact_id = ?",
      [contactId],
    );
    expect(count?.count).toBe(0);
  });
});

describe("addCurrentStateEntry — dated add with origin markers", () => {
  it("stores date, time, url, link and markers, and bumps once", async () => {
    const contactId = await makeContact();
    const interactionId = await seedInteraction(contactId, "Talked jobs");
    const before = await revision();

    await addCurrentStateEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Talked jobs",
      entryDate: "2026-09-01",
      entryTime: "10:00",
      url: "https://example.test/job",
      interactionId,
      linkSource: "note",
      groupNoteCopy: 0,
      fromShare: 1,
      createdAt: "2026-08-01 08:00:00",
      now: NOW,
    });

    expect(await revision()).toBe(before + 1);
    expect(await entries(contactId, "last_talked_about")).toEqual([
      expect.objectContaining({
        value: "Talked jobs",
        entry_date: "2026-09-01",
        // A bare HH:MM source is padded to the HH:MM:SS shape (I-4).
        entry_time: "10:00:00",
        url: "https://example.test/job",
        interaction_id: interactionId,
        link_source: "note",
        from_share: 1,
        created_at: "2026-08-01 08:00:00",
        modified_at: NOW,
      }),
    ]);
  });

  it("rejects a malformed time, a blank value and a link without its source", async () => {
    const contactId = await makeContact();
    const base = {
      contactId,
      fieldKey: "last_talked_about" as const,
      value: "x",
      entryDate: "2026-09-01",
      now: NOW,
    };
    await expect(
      addCurrentStateEntry(exec, { ...base, entryTime: "10am" }),
    ).rejects.toThrow("entry time must be HH:MM:SS");
    await expect(
      addCurrentStateEntry(exec, { ...base, value: "   " }),
    ).rejects.toThrow("value must not be blank");
    await expect(
      addCurrentStateEntry(exec, { ...base, interactionId: 1 }),
    ).rejects.toThrow("needs its linkSource");
    expect(await entries(contactId, "last_talked_about")).toEqual([]);
  });

  it("entryDateTimeOf splits a local stamp into the stored shapes", () => {
    expect(entryDateTimeOf("2026-09-01 10:05:07")).toEqual({
      entryDate: "2026-09-01",
      entryTime: "10:05:07",
    });
    // A same-day HH:MM source.
    expect(entryDateTimeOf("2026-09-01 10:05")).toEqual({
      entryDate: "2026-09-01",
      entryTime: "10:05:00",
    });
    expect(entryDateTimeOf("2026-09-01")).toEqual({
      entryDate: "2026-09-01",
      entryTime: null,
    });
    expect(normalizeEntryTime("07:30")).toBe("07:30:00");
    expect(() => entryDateTimeOf("yesterday")).toThrow("unparseable");
  });

  it("the core composes inside a caller transaction without bumping", async () => {
    const contactId = await makeContact();
    const before = await revision();
    await inWriteTransaction(exec, () =>
      addCurrentStateEntryCore(exec, {
        contactId,
        fieldKey: "current_location",
        value: "Oslo",
        entryDate: "2026-09-01",
        now: NOW,
      }),
    );
    expect(await revision()).toBe(before);
  });
});

describe("editHistoryEntry", () => {
  it("edits value, entry date and url in place", async () => {
    const contactId = await makeContact();
    const id = await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });

    await editHistoryEntry(exec, {
      contactId,
      fieldKey: "current_location",
      entryId: id,
      value: "Milwaukee",
      entryDate: "2026-08-30",
      url: "https://example.test/map",
      now: LATER,
    });

    expect(await entries(contactId)).toEqual([
      expect.objectContaining({
        id,
        value: "Milwaukee",
        entry_date: "2026-08-30",
        url: "https://example.test/map",
        created_at: NOW,
        modified_at: LATER,
      }),
    ]);
  });

  it("rolls back an edit misrouted to another current-state field", async () => {
    const contactId = await makeContact();
    const locationId = await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });

    await expect(
      editHistoryEntry(exec, {
        contactId,
        fieldKey: "last_talked_about",
        entryId: locationId,
        value: "Misrouted",
        now: LATER,
      }),
    ).rejects.toThrow("editHistoryEntry");

    expect(
      (await entries(contactId)).find((row) => row.id === locationId),
    ).toEqual(expect.objectContaining({ value: "Chicago" }));
  });
});

describe("delete with Undo (D-69; F-D3, F-D4, G-D1, G-D2, c9)", () => {
  it("deletes with a tombstone and restores the same uid and id", async () => {
    const contactId = await makeContact();
    const id = await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      entryDate: "2026-08-01",
      now: NOW,
    });
    const [before] = await entries(contactId);

    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    expect(snapshot).toMatchObject({
      id,
      uid: before.uid,
      value: "Chicago",
      entry_date: "2026-08-01",
      tombstoned_at: LATER,
      interaction_uid: null,
    });
    expect(await entries(contactId)).toEqual([]);
    expect(await tombstoneStamp(before.uid as string)).toBe(LATER);

    const restored = await undoCurrentStateEntryDelete(
      exec,
      snapshot,
      "2026-09-04 13:05:00",
    );
    expect(restored).toBe(id);
    expect(await entries(contactId)).toEqual([
      { ...before, modified_at: "2026-09-04 13:05:00" },
    ]);
    expect(await tombstoneStamp(before.uid as string)).toBeNull();
  });

  it("a same-now Undo stamps modified_at one second after the tombstone", async () => {
    const contactId = await makeContact();
    const id = await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect((await rowByUid(snapshot.uid))?.modified_at).toBe(
      "2026-09-04 13:00:01",
    );
  });

  it("delete → Undo → delete with the same now never stamps older than the row (c9)", async () => {
    const contactId = await makeContact();
    const id = await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    const first = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    const restoredId = await undoCurrentStateEntryDelete(exec, first, LATER);
    const restored = await rowByUid(first.uid);
    const second = await deleteCurrentStateEntry(exec, {
      id: restoredId,
      contactId,
      now: LATER,
    });
    const stamp = (await tombstoneStamp(first.uid)) as string;
    expect(second.tombstoned_at).toBe(stamp);
    expect(stamp >= (restored?.modified_at as string)).toBe(true);
    expect(
      compareRowAndTombstone(
        { modified_at: restored?.modified_at as string },
        { deleted_at: stamp },
      ),
    ).toBe("tombstone");
  });

  it("reuses the old id only when it is free (W6)", async () => {
    const contactId = await makeContact();
    const id = await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (id, uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, 'squatter', ?, 'current_location', 'Squatter', '2026-09-04', ?, ?)`,
      [id, contactId, LATER, LATER],
    );
    const restored = await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(restored).not.toBe(id);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      id: restored,
      value: "Chicago",
    });
  });

  it("refuses another contact's id and writes nothing", async () => {
    const contactId = await makeContact();
    const other = await makeContact("Other");
    const id = await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    const before = await revision();
    await expect(
      deleteCurrentStateEntry(exec, { id, contactId: other, now: LATER }),
    ).rejects.toThrow("deleteCurrentStateEntry");
    expect(await entries(contactId)).toHaveLength(1);
    expect(await revision()).toBe(before);
  });

  it("a linked entry comes back linked when its source is unchanged", async () => {
    const contactId = await makeContact();
    const interactionId = await seedInteraction(contactId, "Talked jobs");
    const id = await addLinked(contactId, interactionId, "note", "Talked jobs");
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    expect(snapshot.interaction_uid).toMatch(/^interaction-/);
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      interaction_id: interactionId,
      link_source: "note",
      value: "Talked jobs",
      entry_date: "2026-09-01",
      entry_time: "10:00:00",
    });
  });

  it("FK fallback: the interaction was deleted, so the entry returns unlinked with its text", async () => {
    const contactId = await makeContact();
    const interactionId = await seedInteraction(contactId, "Talked jobs");
    const id = await addLinked(contactId, interactionId, "note", "Talked jobs");
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await exec.runAsync("DELETE FROM interactions WHERE id = ?", [
      interactionId,
    ]);
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      interaction_id: null,
      link_source: null,
      value: "Talked jobs",
      entry_date: "2026-09-01",
      entry_time: "10:00:00",
    });
  });

  it("an interaction id reused by another contact never re-links (returns unlinked)", async () => {
    const contactId = await makeContact();
    const other = await makeContact("Other");
    const interactionId = await seedInteraction(contactId, "Talked jobs");
    const id = await addLinked(contactId, interactionId, "note", "Talked jobs");
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await exec.runAsync("DELETE FROM interactions WHERE id = ?", [
      interactionId,
    ]);
    await exec.runAsync(
      `INSERT INTO interactions
         (id, uid, contact_id, occurred_at, recorded_at, note, source, modified_at)
       VALUES (?, 'someone-else', ?, '2026-09-02 10:00:00', ?, 'Their note', 'manual', ?)`,
      [interactionId, other, NOW, NOW],
    );
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      interaction_id: null,
      link_source: null,
      value: "Talked jobs",
    });
  });

  it("returns unlinked when the slot is taken in memories (cross-table)", async () => {
    const contactId = await makeContact();
    const interactionId = await seedInteraction(contactId, "Talked jobs");
    const id = await addLinked(contactId, interactionId, "note", "Talked jobs");
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await exec.runAsync(
      `INSERT INTO memories
         (uid, contact_id, type, value, provenance, created_at, modified_at,
          allow_ai, interaction_id, link_source)
       VALUES ('taker', ?, 'general', 'Talked jobs', 'user', ?, ?, 0, ?, 'note')`,
      [contactId, NOW, NOW, interactionId],
    );
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      interaction_id: null,
      link_source: null,
      value: "Talked jobs",
    });
  });

  it("returns unlinked when the slot is taken in current_state_entries", async () => {
    const contactId = await makeContact();
    const interactionId = await seedInteraction(contactId, "Talked jobs");
    const id = await addLinked(contactId, interactionId, "note", "Talked jobs");
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await addLinked(contactId, interactionId, "note", "Talked jobs");
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      interaction_id: null,
      link_source: null,
    });
  });

  it("G-D2: a source edited and re-dated during the Undo window re-syncs text, date and time", async () => {
    const contactId = await makeContact();
    const interactionId = await seedInteraction(contactId, "Talked jobs");
    const id = await addLinked(contactId, interactionId, "note", "Talked jobs");
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await exec.runAsync(
      "UPDATE interactions SET note = 'Talked new jobs', occurred_at = '2026-09-02 18:30' WHERE id = ?",
      [interactionId],
    );
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      interaction_id: interactionId,
      link_source: "note",
      value: "Talked new jobs",
      entry_date: "2026-09-02",
      entry_time: "18:30:00",
    });
  });

  it("G-D2: a source whose note was cleared returns unlinked with its snapshot text and dates", async () => {
    const contactId = await makeContact();
    const interactionId = await seedInteraction(contactId, "Talked jobs");
    const id = await addLinked(contactId, interactionId, "note", "Talked jobs");
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await exec.runAsync(
      "UPDATE interactions SET note = NULL, occurred_at = '2026-09-03 09:00:00' WHERE id = ?",
      [interactionId],
    );
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      interaction_id: null,
      link_source: null,
      value: "Talked jobs",
      entry_date: "2026-09-01",
      entry_time: "10:00:00",
    });
  });

  it("G-D2: a Group Note copy whose participant was detached returns unlinked, marker kept", async () => {
    const contactId = await makeContact();
    const other = await makeContact("Other");
    const { groupEventId } = await createGroupEvent(exec, {
      uid: "event-1",
      title: "Dinner",
      occurredAt: "2026-09-01 19:00:00",
      now: NOW,
      groupNote: "Group text",
      participants: [
        { contactId, uid: "child-1" },
        { contactId: other, uid: "child-2" },
      ],
    });
    const child = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM interactions WHERE uid = 'child-1'",
    );
    const id = await addLinked(
      contactId,
      child!.id,
      "group_note",
      "Group text",
      { groupNoteCopy: 1 },
    );
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await detachParticipant(exec, {
      groupEventId,
      interactionId: child!.id,
      now: LATER,
    });
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      interaction_id: null,
      link_source: null,
      group_note_copy: 1,
      value: "Group text",
    });
  });

  it("keeps from_share and group_note_copy through delete and Undo (D-102, D-108)", async () => {
    const contactId = await makeContact();
    const id = await addCurrentStateEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Shared link",
      entryDate: "2026-09-01",
      url: "https://example.test/a",
      fromShare: 1,
      groupNoteCopy: 1,
      createdAt: "2026-08-01 08:00:00",
      now: NOW,
    });
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await rowByUid(snapshot.uid)).toMatchObject({
      from_share: 1,
      group_note_copy: 1,
      url: "https://example.test/a",
      created_at: "2026-08-01 08:00:00",
    });
  });

  it("revision: the delete and undo wrappers each bump once; the core with bumpRevision false bumps 0", async () => {
    const contactId = await makeContact();
    const id = await setCurrentStateValueCore(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    let before = await revision();
    const snapshot = await deleteCurrentStateEntry(exec, {
      id,
      contactId,
      now: LATER,
    });
    expect(await revision()).toBe(before + 1);
    before = await revision();
    const restored = await undoCurrentStateEntryDelete(exec, snapshot, LATER);
    expect(await revision()).toBe(before + 1);
    before = await revision();
    await inWriteTransaction(exec, () =>
      deleteCurrentStateEntryCore(exec, {
        id: restored,
        contactId,
        now: "2026-09-04 14:00:00",
        bumpRevision: false,
      }),
    );
    expect(await revision()).toBe(before);
    expect(await tombstoneStamp(snapshot.uid)).toBe("2026-09-04 14:00:00");
  });
});

// --- Linked Last Talked About from the entry side (D-37, D-41, D-117) ---------

async function ltaRow(id: number) {
  return exec.getFirstAsync<{
    value: string;
    entry_date: string;
    entry_time: string | null;
    interaction_id: number | null;
    link_source: string | null;
    group_note_copy: number;
    modified_at: string;
  }>(
    `SELECT value, entry_date, entry_time, interaction_id, link_source,
            group_note_copy, modified_at
       FROM current_state_entries WHERE id = ?`,
    [id],
  );
}

describe("linked Last Talked About edits (D-37, D-41)", () => {
  async function seedLinked() {
    const contactId = await makeContact();
    const { interactionId, linkedEntry } =
      await recordTouchpointWithLinkedEntry(
        exec,
        {
          contactId,
          uid: uid(),
          occurredAt: "2026-09-01 20:15:00",
          now: NOW,
          note: "Their trip to Lisbon",
        },
        "last_talked_about",
      );
    if (!linkedEntry) throw new Error("no linked entry");
    return { contactId, interactionId, entryId: linkedEntry.id };
  }

  it("editing a note-linked entry's text changes the interaction note", async () => {
    const { contactId, interactionId, entryId } = await seedLinked();
    await editHistoryEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      entryId,
      value: "Their trip to Porto",
      now: LATER,
    });
    expect(
      await exec.getFirstAsync("SELECT note FROM interactions WHERE id = ?", [
        interactionId,
      ]),
    ).toEqual({ note: "Their trip to Porto" });
    expect(await ltaRow(entryId)).toMatchObject({
      value: "Their trip to Porto",
      entry_date: "2026-09-01",
      entry_time: "20:15:00",
      link_source: "note",
    });
  });

  it("rejects a new date on a linked entry; the date follows the interaction", async () => {
    const { contactId, entryId } = await seedLinked();
    await expect(
      editHistoryEntry(exec, {
        contactId,
        fieldKey: "last_talked_about",
        entryId,
        value: "Their trip to Lisbon",
        entryDate: "2026-08-01",
        now: LATER,
      }),
    ).rejects.toBeInstanceOf(LinkedEntryDateError);
    // The stored date passed back unchanged is accepted.
    await editHistoryEntry(exec, {
      contactId,
      fieldKey: "last_talked_about",
      entryId,
      value: "Their trip to Lisbon!",
      entryDate: "2026-09-01",
      now: LATER,
    });
    expect((await ltaRow(entryId))?.value).toBe("Their trip to Lisbon!");
  });
});

describe("editing one Group Note Last Talked About copy detaches it (D-117)", () => {
  it("keeps the new text on that copy only; the Group Note and other copies stay", async () => {
    const contacts = [
      await makeContact("Alex"),
      await makeContact("Sam"),
      await makeContact("Jordan"),
    ];
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(),
      title: "Dinner",
      occurredAt: "2026-09-01 19:00:00",
      now: NOW,
      groupNote: "Planning the reunion",
      participants: contacts.map((contactId) => ({ contactId, uid: uid() })),
    });
    const children = await exec.getAllAsync<{
      id: number;
      contact_id: number;
    }>(
      "SELECT id, contact_id FROM interactions WHERE group_event_id = ? ORDER BY id",
      [groupEventId],
    );
    const copies = await inWriteTransaction(exec, async () => {
      const refs: { contactId: number; interactionId: number; id: number }[] =
        [];
      for (const child of children) {
        const ref = await insertLinkedEntryCore(exec, {
          interactionId: child.id,
          contactId: child.contact_id,
          section: "last_talked_about",
          text: "Planning the reunion",
          linkSource: "group_note",
          occurredAt: "2026-09-01 19:00:00",
          now: NOW,
        });
        refs.push({
          contactId: child.contact_id,
          interactionId: child.id,
          id: ref.id,
        });
      }
      return refs;
    });
    const [edited, ...others] = copies;
    const before = await revision();
    await editHistoryEntry(exec, {
      contactId: edited.contactId,
      fieldKey: "last_talked_about",
      entryId: edited.id,
      value: "Just my part of it",
      now: LATER,
    });
    expect(await revision()).toBe(before + 1);
    expect(await ltaRow(edited.id)).toEqual({
      value: "Just my part of it",
      entry_date: "2026-09-01",
      entry_time: "19:00:00",
      interaction_id: null,
      link_source: null,
      group_note_copy: 1,
      modified_at: LATER,
    });
    for (const other of others) {
      expect(await ltaRow(other.id)).toMatchObject({
        value: "Planning the reunion",
        interaction_id: other.interactionId,
        link_source: "group_note",
      });
    }
    expect(
      await exec.getFirstAsync(
        "SELECT group_note FROM group_events WHERE id = ?",
        [groupEventId],
      ),
    ).toEqual({ group_note: "Planning the reunion" });
  });
});
