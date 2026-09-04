import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addRelationship } from "@/db/relationships-dao";
import {
  listRelationshipsForContact,
  resolveRelationshipVisibility,
} from "@/db/relationships-read";
import { RELATIONSHIPS_GROUP } from "@/db/memory-registry";
import { runMigrations } from "@/db/migrations/runner";
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

async function seedContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`contact-${++uidCounter}`, name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("relationships read", () => {
  it("lists only live rows with linked names in deterministic pinned order", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const casey = await seedContact("Casey");
    await addRelationship(exec, {
      contactId: alex,
      personName: "Unlinked",
      createdAt: NOW,
      now: NOW,
    });
    const pinnedId = await addRelationship(exec, {
      contactId: alex,
      personName: "Linked",
      linkedContactId: blair,
      pinned: true,
      createdAt: NOW,
      now: NOW,
    });
    await addRelationship(exec, {
      contactId: casey,
      personName: "Other contact",
      createdAt: NOW,
      now: NOW,
    });

    expect(await listRelationshipsForContact(exec, alex)).toEqual([
      expect.objectContaining({
        id: pinnedId,
        person_name: "Linked",
        linked_contact_id: blair,
        linked_contact_name: "Blair",
      }),
      expect.objectContaining({
        person_name: "Unlinked",
        linked_contact_id: null,
        linked_contact_name: null,
      }),
    ]);
  });

  it("keeps a relationship when the linked contact is purged and resolves a null name", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    await addRelationship(exec, {
      contactId: alex,
      personName: "Blair",
      linkedContactId: blair,
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync("DELETE FROM contacts WHERE id = ?", [blair]);

    expect(await listRelationshipsForContact(exec, alex)).toEqual([
      expect.objectContaining({
        person_name: "Blair",
        linked_contact_id: null,
        linked_contact_name: null,
      }),
    ]);
  });

  it("returns an empty list for a contact with no relationships", async () => {
    expect(await listRelationshipsForContact(exec, await seedContact("Alex"))).toEqual([]);
  });

  it("resolves explicit and inherited visibility defensively", () => {
    expect(resolveRelationshipVisibility(1)).toBe("hide");
    expect(resolveRelationshipVisibility(0)).toBe("show");
    expect(resolveRelationshipVisibility(null)).toBe("show");
    expect(resolveRelationshipVisibility(2)).toBe("show");

    const group = RELATIONSHIPS_GROUP as { visibilityDefault: "show" | "hide" };
    const original = group.visibilityDefault;
    group.visibilityDefault = "hide";
    try {
      expect(resolveRelationshipVisibility(null)).toBe("hide");
    } finally {
      group.visibilityDefault = original;
    }
  });
});
