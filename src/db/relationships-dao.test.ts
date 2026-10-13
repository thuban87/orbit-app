import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { compareRowAndTombstone } from "@/backup/reconciliation";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  addRelationship,
  deleteRelationshipNow,
  deleteRelationshipNowCore,
  editRelationship,
  undoRelationshipDelete,
} from "@/db/relationships-dao";
import { listRelationshipsForContact } from "@/db/relationships-read";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";
let exec: SqlExecutor;
let uidCounter = 0;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-uid-${++uidCounter}`,
  });
});

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`contact-${++uidCounter}`, name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("relationships DAO", () => {
  it("adds a relationship with optional link fields and preserves multi-byte text", async () => {
    const contactId = await seedContact();
    const linkedContactId = await seedContact("Blair");
    const id = await addRelationship(exec, {
      contactId,
      personName: "Cafe\u0301 ☕️ 👨‍👩‍👧‍👦",
      relationType: "friend 🫶",
      linkedContactId,
      note: "Met at the cafe",
      createdAt: NOW,
      now: NOW,
    });
    const unlinkedId = await addRelationship(exec, {
      contactId,
      personName: "Casey",
      createdAt: NOW,
      now: NOW,
    });

    expect(
      await exec.getFirstAsync<{
        id: number;
        uid: string;
        person_name: string;
        relation_type: string | null;
        linked_contact_id: number | null;
        pinned: number;
        hidden: number | null;
      }>("SELECT * FROM relationships WHERE id = ?", [id]),
    ).toEqual(
      expect.objectContaining({
        id,
        uid: expect.any(String),
        person_name: "Cafe\u0301 ☕️ 👨‍👩‍👧‍👦",
        relation_type: "friend 🫶",
        linked_contact_id: linkedContactId,
        pinned: 0,
        hidden: null,
      }),
    );
    expect(
      await exec.getFirstAsync<{ linked_contact_id: number | null }>(
        "SELECT linked_contact_id FROM relationships WHERE id = ?",
        [unlinkedId],
      ),
    ).toEqual({ linked_contact_id: null });
  });

  it("rejects blank names and self-links before writing", async () => {
    const contactId = await seedContact();
    await expect(
      addRelationship(exec, {
        contactId,
        personName: " \t\n",
        createdAt: NOW,
        now: NOW,
      }),
    ).rejects.toThrow("relationships-dao: person_name is required");
    await expect(
      addRelationship(exec, {
        contactId,
        personName: "Self",
        linkedContactId: contactId,
        createdAt: NOW,
        now: NOW,
      }),
    ).rejects.toThrow(
      "relationships-dao: a contact cannot be linked to itself",
    );
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM relationships",
      ),
    ).toEqual({ count: 0 });
  });

  it("rejects invalid visibility flags without changing relationship rows", async () => {
    const contactId = await seedContact();
    await expect(
      addRelationship(exec, {
        contactId,
        personName: "Invalid new flag",
        hidden: 2 as never,
        createdAt: NOW,
        now: NOW,
      }),
    ).rejects.toThrow("relationships-dao: hidden must be 0, 1, or null");

    const id = await addRelationship(exec, {
      contactId,
      personName: "Existing flag",
      hidden: null,
      createdAt: NOW,
      now: NOW,
    });
    await expect(
      editRelationship(exec, {
        id,
        contactId,
        hidden: 2 as never,
        now: "2026-09-04 13:00:00",
      }),
    ).rejects.toThrow("relationships-dao: hidden must be 0, 1, or null");
    await expect(
      exec.getFirstAsync<{ hidden: number | null }>(
        "SELECT hidden FROM relationships WHERE id = ?",
        [id],
      ),
    ).resolves.toEqual({ hidden: null });
  });

  it("patches only supplied fields, scopes by both keys, and rejects edit self-links", async () => {
    const contactId = await seedContact();
    const otherContactId = await seedContact("Blair");
    const id = await addRelationship(exec, {
      contactId,
      personName: "Sam",
      relationType: "Friend",
      note: "Original",
      createdAt: NOW,
      now: NOW,
    });

    await editRelationship(exec, {
      id,
      contactId,
      note: "Updated",
      hidden: 1,
      now: "2026-09-04 13:00:00",
    });
    await expect(
      editRelationship(exec, {
        id,
        contactId: otherContactId,
        personName: "Wrong contact",
        now: "2026-09-04 14:00:00",
      }),
    ).rejects.toThrow("editRelationship: no relationship matched");
    await expect(
      editRelationship(exec, {
        id,
        contactId,
        linkedContactId: contactId,
        now: "2026-09-04 14:00:00",
      }),
    ).rejects.toThrow(
      "relationships-dao: a contact cannot be linked to itself",
    );

    expect(
      await exec.getFirstAsync<{
        person_name: string;
        relation_type: string | null;
        note: string | null;
        hidden: number | null;
        created_at: string;
      }>("SELECT * FROM relationships WHERE id = ?", [id]),
    ).toEqual(
      expect.objectContaining({
        person_name: "Sam",
        relation_type: "Friend",
        note: "Updated",
        hidden: 1,
        created_at: NOW,
      }),
    );
  });
});

describe("key people delete with Undo (D-69)", () => {
  const LATER = "2026-09-04 13:00:00";

  async function revision(): Promise<number> {
    return (await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id=1",
    ))!.data_revision;
  }

  async function tombstoneStamp(uid: string): Promise<string | null> {
    return (
      (
        await exec.getFirstAsync<{ deleted_at: string }>(
          "SELECT deleted_at FROM tombstones WHERE entity_type='relationship' AND entity_uid=?",
          [uid],
        )
      )?.deleted_at ?? null
    );
  }

  async function rowById(id: number) {
    return exec.getFirstAsync<{
      id: number;
      uid: string;
      person_name: string;
      linked_contact_id: number | null;
      modified_at: string;
      deleted_at: string | null;
    }>(
      "SELECT id, uid, person_name, linked_contact_id, modified_at, deleted_at FROM relationships WHERE id=?",
      [id],
    );
  }

  it("deletes with a tombstone and Undo brings it back live with the same id and uid", async () => {
    const contactId = await seedContact();
    const id = await addRelationship(exec, {
      contactId,
      personName: "Sam",
      relationType: "sibling",
      note: "Older",
      pinned: true,
      hidden: 0,
      createdAt: NOW,
      now: NOW,
    });
    const snapshot = await deleteRelationshipNow(exec, {
      id,
      contactId,
      now: LATER,
    });
    expect(snapshot).not.toHaveProperty("deleted_at");
    expect(snapshot.tombstoned_at).toBe(LATER);
    expect(await rowById(id)).toBeNull();
    expect(await tombstoneStamp(snapshot.uid)).toBe(LATER);
    expect(await listRelationshipsForContact(exec, contactId)).toEqual([]);

    const restoredId = await undoRelationshipDelete(
      exec,
      snapshot,
      "2026-09-04 13:05:00",
    );
    expect(restoredId).toBe(id);
    expect(await tombstoneStamp(snapshot.uid)).toBeNull();
    expect(await listRelationshipsForContact(exec, contactId)).toEqual([
      expect.objectContaining({
        id,
        uid: snapshot.uid,
        person_name: "Sam",
        relation_type: "sibling",
        note: "Older",
        pinned: 1,
        hidden: 0,
        created_at: NOW,
        modified_at: "2026-09-04 13:05:00",
        deleted_at: null,
      }),
    ]);
  });

  it("refuses another contact's id and a soft-deleted row", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const blairRow = await addRelationship(exec, {
      contactId: blair,
      personName: "Kim",
      createdAt: NOW,
      now: NOW,
    });
    await expect(
      deleteRelationshipNow(exec, {
        id: blairRow,
        contactId: alex,
        now: LATER,
      }),
    ).rejects.toThrow("deleteRelationshipNow: no relationship matched");
    // A row with deleted_at set (only pre-033 trash; D-88) is never a target.
    await exec.runAsync(
      "UPDATE relationships SET deleted_at = ? WHERE id = ?",
      [NOW, blairRow],
    );
    await expect(
      deleteRelationshipNow(exec, {
        id: blairRow,
        contactId: blair,
        now: LATER,
      }),
    ).rejects.toThrow("no relationship matched");
    expect(await rowById(blairRow)).not.toBeNull();
  });

  it("takes a new id with the same uid when the old id was reused (W6)", async () => {
    const contactId = await seedContact();
    const id = await addRelationship(exec, {
      contactId,
      personName: "Sam",
      createdAt: NOW,
      now: NOW,
    });
    const snapshot = await deleteRelationshipNow(exec, {
      id,
      contactId,
      now: LATER,
    });
    await exec.runAsync(
      "INSERT INTO relationships (id, uid, contact_id, person_name, created_at, modified_at) VALUES (?, 'intruder', ?, 'Intruder', ?, ?)",
      [id, contactId, NOW, NOW],
    );
    const restoredId = await undoRelationshipDelete(exec, snapshot, LATER);
    expect(restoredId).not.toBe(id);
    expect(await rowById(restoredId)).toMatchObject({
      uid: snapshot.uid,
      person_name: "Sam",
    });
  });

  it("Undo in the same second is one second newer than the tombstone, and a second delete still wins (F-D4, c9)", async () => {
    const contactId = await seedContact();
    const id = await addRelationship(exec, {
      contactId,
      personName: "Sam",
      createdAt: NOW,
      now: NOW,
    });
    const first = await deleteRelationshipNow(exec, {
      id,
      contactId,
      now: LATER,
    });
    const restoredId = await undoRelationshipDelete(exec, first, LATER);
    const restored = (await rowById(restoredId))!;
    expect(restored.modified_at).toBe("2026-09-04 13:00:01");
    expect(
      compareRowAndTombstone(restored, { deleted_at: first.tombstoned_at }),
    ).toBe("row");

    const second = await deleteRelationshipNow(exec, {
      id: restoredId,
      contactId,
      now: LATER,
    });
    const stamp = (await tombstoneStamp(first.uid))!;
    expect(stamp >= restored.modified_at).toBe(true);
    expect(second.tombstoned_at).toBe(stamp);
    expect(compareRowAndTombstone(restored, { deleted_at: stamp })).toBe(
      "tombstone",
    );
  });

  describe("linked contact by uid (convergence c4)", () => {
    async function seedLinked() {
      const owner = await seedContact("Owner");
      const linked = await seedContact("Linked");
      const linkedUid = (await exec.getFirstAsync<{ uid: string }>(
        "SELECT uid FROM contacts WHERE id = ?",
        [linked],
      ))!.uid;
      const id = await addRelationship(exec, {
        contactId: owner,
        personName: "Linked Person",
        linkedContactId: linked,
        createdAt: NOW,
        now: NOW,
      });
      return { owner, linked, linkedUid, id };
    }

    it("restores the link to the same contact", async () => {
      const { owner, linked, linkedUid, id } = await seedLinked();
      const snapshot = await deleteRelationshipNow(exec, {
        id,
        contactId: owner,
        now: LATER,
      });
      expect(snapshot.linked_contact_uid).toBe(linkedUid);
      await undoRelationshipDelete(exec, snapshot, LATER);
      expect(await listRelationshipsForContact(exec, owner)).toEqual([
        expect.objectContaining({
          id,
          linked_contact_id: linked,
          linked_contact_name: "Linked",
        }),
      ]);
    });

    it("restores unlinked with the name kept when the linked contact was purged", async () => {
      const { owner, linked, id } = await seedLinked();
      const snapshot = await deleteRelationshipNow(exec, {
        id,
        contactId: owner,
        now: LATER,
      });
      await exec.runAsync("DELETE FROM contacts WHERE id = ?", [linked]);
      await undoRelationshipDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        person_name: "Linked Person",
        linked_contact_id: null,
      });
    });

    it("never links to a different contact that reused the purged id", async () => {
      const { owner, linked, id } = await seedLinked();
      const snapshot = await deleteRelationshipNow(exec, {
        id,
        contactId: owner,
        now: LATER,
      });
      await exec.runAsync("DELETE FROM contacts WHERE id = ?", [linked]);
      await exec.runAsync(
        `INSERT INTO contacts (id, uid, name, interval_days, created_at, modified_at)
         VALUES (?, 'stranger-uid', 'Stranger', 30, ?, ?)`,
        [linked, NOW, NOW],
      );
      await undoRelationshipDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        person_name: "Linked Person",
        linked_contact_id: null,
      });
    });

    it("follows the linked contact's uid to its current id", async () => {
      const { owner, linked, linkedUid, id } = await seedLinked();
      const snapshot = await deleteRelationshipNow(exec, {
        id,
        contactId: owner,
        now: LATER,
      });
      await exec.runAsync("DELETE FROM contacts WHERE id = ?", [linked]);
      // Re-inserted under another id (explicit, so SQLite cannot reuse it).
      const moved = linked + 500;
      await exec.runAsync(
        `INSERT INTO contacts (id, uid, name, interval_days, created_at, modified_at)
         VALUES (?, ?, 'Linked again', 30, ?, ?)`,
        [moved, linkedUid, NOW, NOW],
      );
      expect(moved).not.toBe(linked);
      await undoRelationshipDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({ linked_contact_id: moved });
    });
  });

  it("each wrapper advances data_revision by exactly 1; the core with bumpRevision false by 0", async () => {
    const contactId = await seedContact();
    const id = await addRelationship(exec, {
      contactId,
      personName: "Sam",
      createdAt: NOW,
      now: NOW,
    });
    let before = await revision();
    const snapshot = await deleteRelationshipNow(exec, {
      id,
      contactId,
      now: LATER,
    });
    expect(await revision()).toBe(before + 1);
    before = await revision();
    const restoredId = await undoRelationshipDelete(exec, snapshot, LATER);
    expect(await revision()).toBe(before + 1);
    before = await revision();
    await inWriteTransaction(exec, () =>
      deleteRelationshipNowCore(exec, {
        id: restoredId,
        contactId,
        now: "2026-09-04 14:00:00",
        bumpRevision: false,
      }),
    );
    expect(await revision()).toBe(before);
  });
});
