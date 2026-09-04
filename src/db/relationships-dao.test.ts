import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addRelationship,
  deleteRelationship,
  editRelationship,
  expireRelationshipIfStale,
  purgeRelationshipPermanently,
  restoreRelationship,
} from "@/db/relationships-dao";
import type { SqlExecutor } from "@/db/types";
import { runMigrations } from "@/db/migrations/runner";

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
    ).toEqual({
      id,
      uid: expect.any(String),
      person_name: "Cafe\u0301 ☕️ 👨‍👩‍👧‍👦",
      relation_type: "friend 🫶",
      linked_contact_id: linkedContactId,
      pinned: 0,
      hidden: null,
    });
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
    ).rejects.toThrow("relationships-dao: a contact cannot be linked to itself");
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM relationships",
      ),
    ).toEqual({ count: 0 });
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
    ).rejects.toThrow("relationships-dao: a contact cannot be linked to itself");

    expect(
      await exec.getFirstAsync<{
        person_name: string;
        relation_type: string | null;
        note: string | null;
        hidden: number | null;
        created_at: string;
      }>("SELECT * FROM relationships WHERE id = ?", [id]),
    ).toEqual({
      person_name: "Sam",
      relation_type: "Friend",
      note: "Updated",
      hidden: 1,
      created_at: NOW,
    });
  });

  it("soft-deletes, restores, and permanently purges only soft-deleted rows", async () => {
    const contactId = await seedContact();
    const id = await addRelationship(exec, {
      contactId,
      personName: "Sam",
      createdAt: NOW,
      now: NOW,
    });

    await expect(
      purgeRelationshipPermanently(exec, { id, contactId }),
    ).rejects.toThrow("purgeRelationshipPermanently: no relationship matched");
    await deleteRelationship(exec, {
      id,
      contactId,
      now: "2026-09-04 13:00:00",
    });
    expect(
      await exec.getFirstAsync<{ deleted_at: string | null }>(
        "SELECT deleted_at FROM relationships WHERE id = ?",
        [id],
      ),
    ).toEqual({ deleted_at: "2026-09-04 13:00:00" });
    await restoreRelationship(exec, {
      id,
      contactId,
      now: "2026-09-04 14:00:00",
    });
    await deleteRelationship(exec, {
      id,
      contactId,
      now: "2026-09-04 15:00:00",
    });
    await purgeRelationshipPermanently(exec, { id, contactId });
    expect(
      await exec.getFirstAsync("SELECT id FROM relationships WHERE id = ?", [id]),
    ).toBeNull();
  });

  it("expires only a relationship still past the soft-delete window under the write lock", async () => {
    const contactId = await seedContact();
    const staleId = await addRelationship(exec, {
      contactId,
      personName: "Stale",
      createdAt: NOW,
      now: NOW,
    });
    const freshId = await addRelationship(exec, {
      contactId,
      personName: "Fresh",
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync(
      "UPDATE relationships SET deleted_at = datetime('now', 'localtime', ?) WHERE id = ?",
      ["-31 days", staleId],
    );
    await exec.runAsync(
      "UPDATE relationships SET deleted_at = datetime('now', 'localtime', ?) WHERE id = ?",
      ["-1 days", freshId],
    );

    await expect(
      expireRelationshipIfStale(exec, { id: staleId, contactId }, "-30 days", NOW),
    ).resolves.toBe(true);
    await expect(
      expireRelationshipIfStale(exec, { id: freshId, contactId }, "-30 days", NOW),
    ).resolves.toBe(false);
    expect(
      await exec.getFirstAsync("SELECT id FROM relationships WHERE id = ?", [staleId]),
    ).toBeNull();
    expect(
      await exec.getFirstAsync("SELECT id FROM relationships WHERE id = ?", [freshId]),
    ).not.toBeNull();
  });
});
