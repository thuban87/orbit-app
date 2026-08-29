import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  archiveContact,
  createContactFull,
  restoreContact,
  updateContactFull,
} from "@/db/contacts-dao";
import { addLink, applyLinkDiff, listLinks } from "@/db/contact-links-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { createField } from "@/db/field-ddl";
import { setFavouriteRank, rewriteFavouriteRanks } from "@/db/favourites-dao";
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
import { runMigrations } from "@/db/migrations/runner";
import { insertTombstoneCore } from "@/db/tombstones-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-25 12:00:00";
let counter = 0;
const newUid = () => `uid-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(
    exec,
    [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011],
    11,
    { now: NOW, newUid, defaultPhoneRegion: "US" },
  );
});

describe("data revision tombstone integration", () => {
  it("advances exactly once for each same-second tombstone", async () => {
    expect(await readDataRevision(exec)).toBe(0);

    await insertTombstoneCore(exec, {
      entityType: "contact",
      entityUid: "contact-a",
      deletedAt: NOW,
    });
    expect(await readDataRevision(exec)).toBe(1);

    await insertTombstoneCore(exec, {
      entityType: "interaction",
      entityUid: "interaction-a",
      deletedAt: NOW,
    });
    expect(await readDataRevision(exec)).toBe(2);
  });

  it("rejects an entity type outside the closed runtime vocabulary before writing", async () => {
    await expect(
      insertTombstoneCore(exec, {
        entityType: "not-a-real-type" as never,
        entityUid: "bad",
        deletedAt: NOW,
      }),
    ).rejects.toThrow(/unsupported tombstone entity type/i);
    expect(await readDataRevision(exec)).toBe(0);
  });
});

describe("data revision outer-writer coalescing", () => {
  it("increments once per same-second contact write, including composed create, edit, archive, and restore", async () => {
    const created = await createContactFull(exec, {
      uid: newUid(),
      name: "Alex",
      intervalDays: 30,
      now: NOW,
      firstInteraction: { uid: newUid(), occurredAt: NOW, channel: "other", connected: 1, quality: null, note: null },
    });
    expect(await readDataRevision(exec)).toBe(1);

    await updateContactFull(exec, {
      id: created.contactId,
      name: "Alex Updated",
      intervalDays: 30,
      rarelyResponds: 0,
      remindersOff: 0,
      now: NOW,
    });
    expect(await readDataRevision(exec)).toBe(2);

    await archiveContact(exec, created.contactId, NOW);
    expect(await readDataRevision(exec)).toBe(3);
    await restoreContact(exec, created.contactId, NOW);
    expect(await readDataRevision(exec)).toBe(4);
  });

  it("coalesces fan-out field creation and a mixed link diff to one increment each", async () => {
    const first = await createContactFull(exec, { uid: newUid(), name: "A", intervalDays: 30, now: NOW });
    const second = await createContactFull(exec, { uid: newUid(), name: "B", intervalDays: 30, now: NOW });
    const beforeField = await readDataRevision(exec);
    await createField(exec, {
      uid: newUid(), col_name: "nickname", label: "Nickname", type: "text", options: null,
      show_on_new: 0, always_show: 0, display_order: 0, share_with_ai: 0, now: NOW,
    });
    expect(await readDataRevision(exec)).toBe(beforeField + 1);

    await addLink(exec, { uid: newUid(), contactId: first.contactId, url: "https://one.example", label: "One", now: NOW });
    await addLink(exec, { uid: newUid(), contactId: first.contactId, url: "https://two.example", label: "Two", now: NOW });
    const seeded = await listLinks(exec, first.contactId);
    const beforeDiff = await readDataRevision(exec);
    await applyLinkDiff(exec, {
      contactId: first.contactId,
      seeded,
      current: [
        { id: seeded[0].id, uid: seeded[0].uid, url: "https://one-updated.example", label: "Updated" },
        { uid: newUid(), url: "https://three.example", label: null },
      ],
      now: NOW,
    });
    expect(await readDataRevision(exec)).toBe(beforeDiff + 1);
    expect(second.contactId).toBeGreaterThan(0);
  });

  it("keeps accepted empty reorder a no-op while a real reorder advances once", async () => {
    const beforeEmpty = await readDataRevision(exec);
    await rewriteFavouriteRanks(exec, [], NOW);
    expect(await readDataRevision(exec)).toBe(beforeEmpty);

    const contact = await createContactFull(exec, { uid: newUid(), name: "Favourite", intervalDays: 30, now: NOW });
    await setFavouriteRank(exec, contact.contactId, NOW);
    const beforeReorder = await readDataRevision(exec);
    await rewriteFavouriteRanks(exec, [contact.contactId], NOW);
    expect(await readDataRevision(exec)).toBe(beforeReorder + 1);
  });

  it("does not advance when a writer rolls back", async () => {
    const contact = await createContactFull(exec, { uid: newUid(), name: "Guarded", intervalDays: 30, now: NOW });
    const before = await readDataRevision(exec);
    await expect(archiveContact(exec, contact.contactId, NOW)).resolves.toBeUndefined();
    const archived = await readDataRevision(exec);
    await expect(archiveContact(exec, contact.contactId, NOW)).rejects.toThrow(/no live contact/);
    expect(await readDataRevision(exec)).toBe(archived);
    expect(archived).toBe(before + 1);
  });
});
