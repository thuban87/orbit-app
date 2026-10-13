import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  deleteStampAt,
  resolveUndoLinkCore,
  undoModifiedAt,
} from "@/db/undo-restore";

const NOW = "2026-10-13 12:00:00";
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

async function seedInteraction(
  contactId: number,
  options: {
    uid?: string;
    note?: string | null;
    occurredAt?: string;
    allowAi?: 0 | 1;
    groupEventId?: number | null;
    id?: number;
  } = {},
): Promise<{ id: number; uid: string }> {
  const uid = options.uid ?? `interaction-${++counter}`;
  const columns = [
    "uid",
    "contact_id",
    "occurred_at",
    "recorded_at",
    "note",
    "source",
    "modified_at",
    "allow_ai",
    "group_event_id",
  ];
  const values: (string | number | null)[] = [
    uid,
    contactId,
    options.occurredAt ?? "2026-10-01 09:00:00",
    NOW,
    options.note === undefined ? "We talked about sailing" : options.note,
    "manual",
    NOW,
    options.allowAi ?? 0,
    options.groupEventId ?? null,
  ];
  if (options.id !== undefined) {
    columns.unshift("id");
    values.unshift(options.id);
  }
  const result = await exec.runAsync(
    `INSERT INTO interactions (${columns.join(", ")})
     VALUES (${columns.map(() => "?").join(", ")})`,
    values,
  );
  return { id: options.id ?? result.lastInsertRowId, uid };
}

async function seedGroupEvent(groupNote: string | null): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO group_events (uid, title, occurred_at, group_note, created_at, modified_at)
     VALUES (?, 'Dinner', '2026-09-30 19:00:00', ?, ?, ?)`,
    [`group-${++counter}`, groupNote, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("undoModifiedAt (F-D4)", () => {
  it("is one second after the tombstone when now equals it", () => {
    expect(undoModifiedAt(NOW, NOW)).toBe("2026-10-13 12:00:01");
  });

  it("rolls the minute and day over in local wall-clock form", () => {
    expect(undoModifiedAt("2026-12-31 23:59:59", "2026-12-31 23:59:59")).toBe(
      "2027-01-01 00:00:00",
    );
  });

  it("returns now when it is already later than the tombstone", () => {
    expect(undoModifiedAt("2026-10-13 12:00:05", NOW)).toBe(
      "2026-10-13 12:00:05",
    );
  });

  it("returns the tombstone + 1 s when the tombstone is ahead of now", () => {
    expect(undoModifiedAt(NOW, "2026-10-13 12:00:01")).toBe(
      "2026-10-13 12:00:02",
    );
  });
});

describe("deleteStampAt (convergence c9)", () => {
  it("returns the row's modified_at when it is ahead of now", () => {
    expect(deleteStampAt(NOW, "2026-10-13 12:00:01")).toBe(
      "2026-10-13 12:00:01",
    );
  });

  it("returns now otherwise", () => {
    expect(deleteStampAt(NOW, "2026-10-13 11:59:59")).toBe(NOW);
    expect(deleteStampAt(NOW, NOW)).toBe(NOW);
  });
});

describe("resolveUndoLinkCore (F-D3, G-D2)", () => {
  it("returns null without a uid or with an unknown link source", async () => {
    const contactId = await seedContact();
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: null,
        linkSource: "note",
        contactId,
      }),
    ).resolves.toBeNull();
    const { uid } = await seedInteraction(contactId);
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: uid,
        linkSource: null,
        contactId,
      }),
    ).resolves.toBeNull();
  });

  it("returns null for a missing uid", async () => {
    const contactId = await seedContact();
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: "gone",
        linkSource: "note",
        contactId,
      }),
    ).resolves.toBeNull();
  });

  it("returns null for another contact's interaction, including a reused id", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const original = await seedInteraction(alex, { uid: "alex-talk" });
    await exec.runAsync("DELETE FROM interactions WHERE id = ?", [original.id]);
    // Blair's interaction takes the freed id.
    const reused = await seedInteraction(blair, { id: original.id });
    expect(reused.id).toBe(original.id);
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: "alex-talk",
        linkSource: "note",
        contactId: alex,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: reused.uid,
        linkSource: "note",
        contactId: alex,
      }),
    ).resolves.toBeNull();
  });

  it("returns null when the slot is taken in memories", async () => {
    const contactId = await seedContact();
    const talk = await seedInteraction(contactId);
    await exec.runAsync(
      `INSERT INTO memories (uid, contact_id, type, value, provenance, created_at,
                             modified_at, interaction_id, link_source)
       VALUES ('m-1', ?, 'general', 'Sailing', 'user', ?, ?, ?, 'note')`,
      [contactId, NOW, NOW, talk.id],
    );
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: talk.uid,
        linkSource: "note",
        contactId,
      }),
    ).resolves.toBeNull();
  });

  it("returns null when the slot is taken in current_state_entries", async () => {
    const contactId = await seedContact();
    const talk = await seedInteraction(contactId);
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at,
          interaction_id, link_source)
       VALUES ('cs-1', ?, 'last_talked_about', 'Sailing', '2026-10-01', ?, ?, ?, 'note')`,
      [contactId, NOW, NOW, talk.id],
    );
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: talk.uid,
        linkSource: "note",
        contactId,
      }),
    ).resolves.toBeNull();
  });

  it("returns null for a note link whose interaction note is now blank", async () => {
    const contactId = await seedContact();
    const talk = await seedInteraction(contactId, { note: "  \n" });
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: talk.uid,
        linkSource: "note",
        contactId,
      }),
    ).resolves.toBeNull();
  });

  it("returns null for a group_note link whose participant was detached", async () => {
    const contactId = await seedContact();
    const talk = await seedInteraction(contactId, { groupEventId: null });
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: talk.uid,
        linkSource: "group_note",
        contactId,
      }),
    ).resolves.toBeNull();
  });

  it("returns null for a group_note link whose Group Note is now blank", async () => {
    const contactId = await seedContact();
    const eventId = await seedGroupEvent("   ");
    const talk = await seedInteraction(contactId, { groupEventId: eventId });
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: talk.uid,
        linkSource: "group_note",
        contactId,
      }),
    ).resolves.toBeNull();
  });

  it("returns the source as it is now for a note link (edited, re-dated, AI-off)", async () => {
    const contactId = await seedContact();
    const talk = await seedInteraction(contactId, {
      note: "Old text",
      allowAi: 1,
    });
    await exec.runAsync(
      "UPDATE interactions SET note = ?, occurred_at = ?, allow_ai = 0 WHERE id = ?",
      ["New text", "2026-10-05 10:00:00", talk.id],
    );
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: talk.uid,
        linkSource: "note",
        contactId,
      }),
    ).resolves.toEqual({
      interactionId: talk.id,
      text: "New text",
      occurredAt: "2026-10-05 10:00:00",
      allowAi: 0,
    });
  });

  it("returns the note's current allow_ai when it is on", async () => {
    const contactId = await seedContact();
    const talk = await seedInteraction(contactId, { allowAi: 1 });
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: talk.uid,
        linkSource: "note",
        contactId,
      }),
    ).resolves.toMatchObject({ allowAi: 1, text: "We talked about sailing" });
  });

  it("returns the current Group Note and event date, AI-off, for a group_note link", async () => {
    const contactId = await seedContact();
    const eventId = await seedGroupEvent("Old group note");
    const talk = await seedInteraction(contactId, {
      groupEventId: eventId,
      allowAi: 1,
    });
    await exec.runAsync(
      "UPDATE group_events SET group_note = ?, occurred_at = ? WHERE id = ?",
      ["Edited group note", "2026-09-29 18:00:00", eventId],
    );
    await expect(
      resolveUndoLinkCore(exec, {
        interactionUid: talk.uid,
        linkSource: "group_note",
        contactId,
      }),
    ).resolves.toEqual({
      interactionId: talk.id,
      text: "Edited group note",
      occurredAt: "2026-09-29 18:00:00",
      allowAi: 0,
    });
  });
});
