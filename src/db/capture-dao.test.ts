/**
 * Share-sheet writers (Phase 38.10 D-02, D-04, D-12, D-28, D-46, D-57, D-69,
 * D-77, D-78, D-79, D-106, D-108, D-110; convergence c1 F-D6, c10).
 *
 * Every case drives a real in-memory node:sqlite database at the migration
 * head through the real DAOs: a share lands in Thought of Them with Allow AI
 * off and its link kept, is never a touchpoint, every wrapper advances the
 * data revision exactly once, a create-plus-share is one transaction, chip
 * moves keep the share's origin, and Undo deletes only the share's own rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { setAiPermissionDefault } from "@/db/ai-permissions-dao";
import {
  applyShareNote,
  assertShareUndoRowsCore,
  createContactAndShare,
  moveShareRows,
  type ShareRowRef,
  ShareUndoRefusedError,
  setShareRowsAllowAi,
  shareRowsMatchCreatedContactCore,
  shareToContacts,
  undoShareRows,
} from "@/db/capture-dao";
import { getCurrentStateHistory } from "@/db/current-state-history-read";
import { readDataRevision } from "@/db/data-revision-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addMemory } from "@/db/memories-dao";
import { listMemoriesForContact } from "@/db/memories-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import type { CapturePayload } from "@/logic/capture-logic";

const CREATED = "2026-09-01 08:00:00";
const NOW = "2026-10-13 12:00:00";
const LATER = "2026-10-13 12:05:00";
const TODAY = "2026-10-13";

const LINK_SHARE: CapturePayload = {
  displayText: "A great article",
  url: "https://example.com/article",
};

let counter = 0;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: CREATED,
    newUid: () => `migration-${++counter}`,
  });
});

// --- Fixtures ------------------------------------------------------------------

async function seedContact(name = "Alex"): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, 30, ?, ?)`,
      [`contact-${++counter}`, name, CREATED, CREATED],
    )
  ).lastInsertRowId;
}

async function memoriesOf(contactId: number) {
  return listMemoriesForContact(exec, contactId);
}

async function lastTalkedAboutOf(contactId: number) {
  return getCurrentStateHistory(exec, contactId, "last_talked_about");
}

async function count(sql: string, params: (string | number)[] = []) {
  return (
    (await exec.getFirstAsync<{ n: number }>(sql, params))?.n ?? Number.NaN
  );
}

/** Run `fn` and return how far it moved `data_revision`. */
async function revisionDelta(fn: () => Promise<unknown>): Promise<number> {
  const before = await readDataRevision(exec);
  await fn();
  return (await readDataRevision(exec)) - before;
}

// --- shareToContacts -----------------------------------------------------------

describe("shareToContacts: a share lands in Thought of Them (D-04, D-12, D-57)", () => {
  it("writes one AI-off thought_of_them share memory with the link kept", async () => {
    const a = await seedContact();

    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ table: "memories", contactId: a });
    const [memory] = await memoriesOf(a);
    expect(memory).toMatchObject({
      id: rows[0]?.id,
      type: "thought_of_them",
      value: "A great article",
      url: "https://example.com/article",
      provenance: "share",
      allow_ai: 0,
      meaningful_date: null,
      created_at: NOW,
    });
  });

  it("starts AI-off even when the Thought of Them default allows AI (D-57)", async () => {
    await setAiPermissionDefault(exec, "thought_of_them", 1, CREATED);
    const a = await seedContact();

    await shareToContacts(exec, [a], LINK_SHARE, NOW);

    const [memory] = await memoriesOf(a);
    expect(memory?.allow_ai).toBe(0);
  });

  it("stores the link as the value of a link-only share", async () => {
    const a = await seedContact();

    await shareToContacts(
      exec,
      [a],
      { displayText: null, url: "https://example.com/only" },
      NOW,
    );

    const [memory] = await memoriesOf(a);
    expect(memory?.value).toBe("https://example.com/only");
    expect(memory?.url).toBe("https://example.com/only");
  });

  it("writes an independent row per person, in input order (D-12, D-79)", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const c = await seedContact("Casey");

    const rows = await shareToContacts(exec, [a, b, c], LINK_SHARE, NOW);

    expect(rows.map((r) => r.contactId)).toEqual([a, b, c]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
    for (const id of [a, b, c]) {
      const memories = await memoriesOf(id);
      expect(memories).toHaveLength(1);
      expect(memories[0]?.type).toBe("thought_of_them");
    }
  });

  it("rolls back every row when one person fails", async () => {
    const a = await seedContact();

    await expect(
      shareToContacts(exec, [a, 999999], LINK_SHARE, NOW),
    ).rejects.toThrow();

    expect(await count("SELECT COUNT(*) AS n FROM memories")).toBe(0);
  });

  it("refuses an empty pick and a contentless share", async () => {
    const a = await seedContact();
    await expect(shareToContacts(exec, [], LINK_SHARE, NOW)).rejects.toThrow();
    await expect(
      shareToContacts(exec, [a], { displayText: null, url: null }, NOW),
    ).rejects.toThrow();
    expect(await count("SELECT COUNT(*) AS n FROM memories")).toBe(0);
  });

  it("is not a touchpoint: last_contact stays NULL and no interaction is written", async () => {
    const a = await seedContact();

    await shareToContacts(exec, [a], LINK_SHARE, NOW);

    const contact = await exec.getFirstAsync<{ last_contact: string | null }>(
      "SELECT last_contact FROM contacts WHERE id = ?",
      [a],
    );
    expect(contact?.last_contact).toBeNull();
    expect(await count("SELECT COUNT(*) AS n FROM interactions")).toBe(0);
  });

  it("advances data_revision by exactly 1 for one person and for several", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");

    expect(
      await revisionDelta(() => shareToContacts(exec, [a], LINK_SHARE, NOW)),
    ).toBe(1);
    expect(
      await revisionDelta(() => shareToContacts(exec, [a, b], LINK_SHARE, NOW)),
    ).toBe(1);
  });
});

// --- createContactAndShare -----------------------------------------------------

describe("createContactAndShare: one transaction (D-28, NEW-3, D-83)", () => {
  const contactInput = {
    uid: "new-contact",
    name: "Robin",
    intervalDays: 30,
    methodDrafts: [],
  };

  it("creates a never-contacted contact and its share with one created_at", async () => {
    const { contactId, rows } = await createContactAndShare(
      exec,
      contactInput,
      LINK_SHARE,
      NOW,
    );

    const contact = await exec.getFirstAsync<{
      name: string;
      interval_days: number;
      last_contact: string | null;
      created_at: string;
    }>(
      "SELECT name, interval_days, last_contact, created_at FROM contacts WHERE id = ?",
      [contactId],
    );
    expect(contact).toEqual({
      name: "Robin",
      interval_days: 30,
      last_contact: null,
      created_at: NOW,
    });
    expect(rows).toEqual([
      { table: "memories", id: expect.any(Number), contactId },
    ]);
    const [memory] = await memoriesOf(contactId);
    expect(memory).toMatchObject({
      type: "thought_of_them",
      provenance: "share",
      allow_ai: 0,
      url: "https://example.com/article",
      created_at: NOW,
    });
    expect(await count("SELECT COUNT(*) AS n FROM interactions")).toBe(0);
  });

  it("advances data_revision by exactly 1", async () => {
    expect(
      await revisionDelta(() =>
        createContactAndShare(exec, contactInput, LINK_SHARE, NOW),
      ),
    ).toBe(1);
  });

  it("rolls back: a failed share leaves no contact behind", async () => {
    // The memory insert fails inside the transaction: a trigger rejects it.
    await exec.execAsync(
      `CREATE TRIGGER fail_share BEFORE INSERT ON memories
       BEGIN SELECT RAISE(ABORT, 'forced share failure'); END;`,
    );
    const revision = await readDataRevision(exec);

    await expect(
      createContactAndShare(exec, contactInput, LINK_SHARE, NOW),
    ).rejects.toThrow(/forced share failure/);

    expect(
      await count("SELECT COUNT(*) AS n FROM contacts WHERE uid = ?", [
        "new-contact",
      ]),
    ).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM memories")).toBe(0);
    expect(await readDataRevision(exec)).toBe(revision);
  });

  it("re-checks the cadence guard and refuses a contentless share before any write", async () => {
    await expect(
      createContactAndShare(
        exec,
        { ...contactInput, intervalDays: 0 },
        LINK_SHARE,
        NOW,
      ),
    ).rejects.toThrow(/intervalDays/);
    await expect(
      createContactAndShare(
        exec,
        { ...contactInput, intervalDays: null },
        LINK_SHARE,
        NOW,
      ),
    ).rejects.toThrow(/intervalDays/);
    await expect(
      createContactAndShare(
        exec,
        contactInput,
        { displayText: null, url: null },
        NOW,
      ),
    ).rejects.toThrow();
    expect(await count("SELECT COUNT(*) AS n FROM contacts")).toBe(0);
  });
});

// --- moveShareRows -------------------------------------------------------------

describe("moveShareRows: section chips (D-46, D-77, D-79, D-108)", () => {
  it("moves every copy to Gift Ideas together, keeping link, origin and AI-off", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const rows = await shareToContacts(exec, [a, b], LINK_SHARE, NOW);

    const moved = await moveShareRows(exec, rows, "gift_idea", LATER);

    expect(moved).toEqual(rows);
    for (const id of [a, b]) {
      const [memory] = await memoriesOf(id);
      expect(memory).toMatchObject({
        type: "gift_idea",
        url: "https://example.com/article",
        provenance: "share",
        allow_ai: 0,
        created_at: NOW,
      });
    }
  });

  it("moves to Memories as a general memory", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    await moveShareRows(exec, rows, "memory", LATER);

    const [memory] = await memoriesOf(a);
    expect(memory?.type).toBe("general");
    expect(memory?.provenance).toBe("share");
  });

  it("moves to Last Talked About dated today, link and share origin kept, no interaction", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    const moved = await moveShareRows(exec, rows, "last_talked_about", LATER);

    expect(moved).toEqual([
      { table: "current_state_entries", id: expect.any(Number), contactId: a },
    ]);
    expect(await memoriesOf(a)).toHaveLength(0);
    const [entry] = await lastTalkedAboutOf(a);
    expect(entry).toMatchObject({
      id: moved[0]?.id,
      value: "A great article",
      entry_date: TODAY,
      entry_time: null,
      url: "https://example.com/article",
      interaction_id: null,
      from_share: 1,
      created_at: NOW,
    });
    expect(await count("SELECT COUNT(*) AS n FROM interactions")).toBe(0);
    const contact = await exec.getFirstAsync<{ last_contact: string | null }>(
      "SELECT last_contact FROM contacts WHERE id = ?",
      [a],
    );
    expect(contact?.last_contact).toBeNull();
  });

  it("dates the Last Talked About entry from the move's own local stamp", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    await moveShareRows(exec, rows, "last_talked_about", "2026-10-14 23:30:00");

    const [entry] = await lastTalkedAboutOf(a);
    expect(entry?.entry_date).toBe("2026-10-14");
  });

  it("chip hop through Last Talked About to Gift Ideas leaves no meaningful date (c10)", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    const viaLta = await moveShareRows(exec, rows, "last_talked_about", LATER);
    await moveShareRows(exec, viaLta, "gift_idea", LATER);

    const memories = await memoriesOf(a);
    expect(memories).toHaveLength(1);
    expect(memories[0]).toMatchObject({
      type: "gift_idea",
      meaningful_date: null,
      provenance: "share",
      url: "https://example.com/article",
      allow_ai: 0,
      created_at: NOW,
    });
    expect(await lastTalkedAboutOf(a)).toHaveLength(0);
  });

  it("chip hop through Last Talked About back to Thought of Them leaves no meaningful date (c10)", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    const viaLta = await moveShareRows(exec, rows, "last_talked_about", LATER);
    const back = await moveShareRows(exec, viaLta, "thought_of_them", LATER);

    expect(back[0]?.table).toBe("memories");
    const memories = await memoriesOf(a);
    expect(memories).toHaveLength(1);
    expect(memories[0]).toMatchObject({
      id: back[0]?.id,
      type: "thought_of_them",
      meaningful_date: null,
      provenance: "share",
      url: "https://example.com/article",
    });
  });

  it("leaves a row already in the chosen section as it is (no throw, no bump)", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    let moved: ShareRowRef[] = [];
    expect(
      await revisionDelta(async () => {
        moved = await moveShareRows(exec, rows, "thought_of_them", LATER);
      }),
    ).toBe(0);
    expect(moved).toEqual(rows);
    const [memory] = await memoriesOf(a);
    expect(memory?.modified_at).toBe(NOW);
  });

  it("moves only the copies not already there when copies have diverged", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const rows = await shareToContacts(exec, [a, b], LINK_SHARE, NOW);
    // Blair's copy was moved on its own earlier (D-79).
    await moveShareRows(exec, [rows[1] as ShareRowRef], "gift_idea", NOW);

    const moved = await moveShareRows(exec, rows, "gift_idea", LATER);

    expect(moved).toEqual(rows);
    expect((await memoriesOf(a))[0]?.type).toBe("gift_idea");
    expect((await memoriesOf(b))[0]?.type).toBe("gift_idea");
  });

  it("advances data_revision by exactly 1 over two copies", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const rows = await shareToContacts(exec, [a, b], LINK_SHARE, NOW);

    expect(
      await revisionDelta(() => moveShareRows(exec, rows, "gift_idea", LATER)),
    ).toBe(1);
    const lta = await shareToContacts(exec, [a, b], LINK_SHARE, NOW);
    expect(
      await revisionDelta(() =>
        moveShareRows(exec, lta, "last_talked_about", LATER),
      ),
    ).toBe(1);
  });

  it("refuses Off Limits as a chip target", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    await expect(
      moveShareRows(exec, rows, "off_limits" as never, LATER),
    ).rejects.toThrow();
    expect((await memoriesOf(a))[0]?.type).toBe("thought_of_them");
  });
});

// --- undoShareRows ---------------------------------------------------------------

describe("undoShareRows: delete at once with tombstones (D-69)", () => {
  it("removes every copy and writes a tombstone for each, one bump", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const rows = await shareToContacts(exec, [a, b], LINK_SHARE, NOW);
    const uids = (
      await exec.getAllAsync<{ uid: string }>(
        "SELECT uid FROM memories ORDER BY id",
      )
    ).map((r) => r.uid);

    expect(await revisionDelta(() => undoShareRows(exec, rows, LATER))).toBe(1);

    expect(await count("SELECT COUNT(*) AS n FROM memories")).toBe(0);
    const tombstones = await exec.getAllAsync<{ entity_uid: string }>(
      "SELECT entity_uid FROM tombstones WHERE entity_type = 'memory' ORDER BY entity_uid",
    );
    expect(tombstones.map((t) => t.entity_uid)).toEqual([...uids].sort());
  });

  it("undoes a share that was moved to Last Talked About", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);
    const moved = await moveShareRows(exec, rows, "last_talked_about", LATER);

    await undoShareRows(exec, moved, LATER);

    expect(await lastTalkedAboutOf(a)).toHaveLength(0);
    expect(
      await count(
        "SELECT COUNT(*) AS n FROM tombstones WHERE entity_type = 'current_state_entry'",
      ),
    ).toBe(1);
  });
});

describe("undoShareRows guard: only the share's own rows (F-D6, D-106)", () => {
  async function expectRefusedAndUntouched(rows: ShareRowRef[]) {
    const memoriesBefore = await count("SELECT COUNT(*) AS n FROM memories");
    const revision = await readDataRevision(exec);
    await expect(undoShareRows(exec, rows, LATER)).rejects.toBeInstanceOf(
      ShareUndoRefusedError,
    );
    expect(await count("SELECT COUNT(*) AS n FROM memories")).toBe(
      memoriesBefore,
    );
    expect(await readDataRevision(exec)).toBe(revision);
  }

  it("refuses an empty list", async () => {
    await expectRefusedAndUntouched([]);
  });

  it("refuses a user memory of the same contact, deleting nothing (not even the share)", async () => {
    const a = await seedContact();
    const [share] = await shareToContacts(exec, [a], LINK_SHARE, NOW);
    const userId = await addMemory(exec, {
      contactId: a,
      type: "thought_of_them",
      value: "Typed by the user",
      createdAt: NOW,
      now: NOW,
    });

    await expectRefusedAndUntouched([
      share as ShareRowRef,
      { table: "memories", id: userId, contactId: a },
    ]);
  });

  it("refuses a ref whose contactId is not the row's owner", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const [share] = await shareToContacts(exec, [a], LINK_SHARE, NOW);

    await expectRefusedAndUntouched([
      { table: "memories", id: share?.id ?? 0, contactId: b },
    ]);
  });

  it("refuses a typed Last Talked About entry", async () => {
    const a = await seedContact();
    const id = (
      await exec.runAsync(
        `INSERT INTO current_state_entries
           (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
         VALUES ('typed-lta', ?, 'last_talked_about', 'Typed', ?, ?, ?)`,
        [a, TODAY, NOW, NOW],
      )
    ).lastInsertRowId;

    await expect(
      assertShareUndoRowsCore(exec, [
        { table: "current_state_entries", id, contactId: a },
      ]),
    ).rejects.toBeInstanceOf(ShareUndoRefusedError);
    expect(await lastTalkedAboutOf(a)).toHaveLength(1);
  });
});

// --- shareRowsMatchCreatedContactCore ------------------------------------------

describe("shareRowsMatchCreatedContactCore: the 'created with' batch (D-100, D-110)", () => {
  it("is true for the rows createContactAndShare returned", async () => {
    const { contactId, rows } = await createContactAndShare(
      exec,
      { uid: "c-1", name: "Robin", intervalDays: 30, methodDrafts: [] },
      LINK_SHARE,
      NOW,
    );
    expect(await shareRowsMatchCreatedContactCore(exec, contactId, rows)).toBe(
      true,
    );
  });

  it("stays true after the created share is chip-moved (created_at is kept)", async () => {
    const { contactId, rows } = await createContactAndShare(
      exec,
      { uid: "c-1", name: "Robin", intervalDays: 30, methodDrafts: [] },
      LINK_SHARE,
      NOW,
    );
    const moved = await moveShareRows(exec, rows, "last_talked_about", LATER);
    expect(await shareRowsMatchCreatedContactCore(exec, contactId, moved)).toBe(
      true,
    );
  });

  it("is false for an empty list, rows of another contact, and a later share", async () => {
    const { contactId } = await createContactAndShare(
      exec,
      { uid: "c-1", name: "Robin", intervalDays: 30, methodDrafts: [] },
      LINK_SHARE,
      NOW,
    );
    const other = await seedContact("Other");
    const otherRows = await shareToContacts(exec, [other], LINK_SHARE, NOW);
    const laterRows = await shareToContacts(
      exec,
      [contactId],
      LINK_SHARE,
      LATER,
    );
    const existing = await seedContact("Existing");
    const existingRows = await shareToContacts(
      exec,
      [existing],
      LINK_SHARE,
      NOW,
    );

    expect(await shareRowsMatchCreatedContactCore(exec, contactId, [])).toBe(
      false,
    );
    expect(
      await shareRowsMatchCreatedContactCore(exec, contactId, otherRows),
    ).toBe(false);
    expect(
      await shareRowsMatchCreatedContactCore(exec, contactId, laterRows),
    ).toBe(false);
    // A share added later to an existing contact: different created_at.
    expect(
      await shareRowsMatchCreatedContactCore(exec, existing, existingRows),
    ).toBe(false);
  });
});

// --- setShareRowsAllowAi / applyShareNote --------------------------------------

describe("setShareRowsAllowAi: the card's AI switch (D-78)", () => {
  it("turns Allow AI on and off for every copy, one bump each time", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const rows = await shareToContacts(exec, [a, b], LINK_SHARE, NOW);

    expect(
      await revisionDelta(() => setShareRowsAllowAi(exec, rows, true, LATER)),
    ).toBe(1);
    for (const id of [a, b]) {
      expect((await memoriesOf(id))[0]?.allow_ai).toBe(1);
    }
    await setShareRowsAllowAi(exec, rows, false, LATER);
    for (const id of [a, b]) {
      expect((await memoriesOf(id))[0]?.allow_ai).toBe(0);
    }
  });

  it("is a no-op for a share in Last Talked About (no Allow AI there)", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);
    const moved = await moveShareRows(exec, rows, "last_talked_about", LATER);

    expect(
      await revisionDelta(() => setShareRowsAllowAi(exec, moved, true, LATER)),
    ).toBe(0);
    expect(await lastTalkedAboutOf(a)).toHaveLength(1);
  });
});

describe("applyShareNote: the note leads, the link is kept", () => {
  const base = {
    text: "A great article",
    webUrl: "https://example.com/article",
    title: null,
  };

  it("recomposes every copy as 'note — base', one bump", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const rows = await shareToContacts(exec, [a, b], LINK_SHARE, NOW);

    expect(
      await revisionDelta(() =>
        applyShareNote(exec, rows, "For your trip", base, LATER),
      ),
    ).toBe(1);

    for (const id of [a, b]) {
      const [memory] = await memoriesOf(id);
      expect(memory).toMatchObject({
        value: "For your trip — A great article",
        url: "https://example.com/article",
        created_at: NOW,
        modified_at: LATER,
      });
    }
  });

  it("writes the note to a share in Last Talked About", async () => {
    const a = await seedContact();
    const rows = await shareToContacts(exec, [a], LINK_SHARE, NOW);
    const moved = await moveShareRows(exec, rows, "last_talked_about", LATER);

    await applyShareNote(exec, moved, "For your trip", base, LATER);

    const [entry] = await lastTalkedAboutOf(a);
    expect(entry).toMatchObject({
      value: "For your trip — A great article",
      url: "https://example.com/article",
      entry_date: TODAY,
    });
  });

  it("rolls back every copy when one ref is wrong", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const rows = await shareToContacts(exec, [a, b], LINK_SHARE, NOW);

    await expect(
      applyShareNote(
        exec,
        [rows[0] as ShareRowRef, { ...(rows[1] as ShareRowRef), contactId: a }],
        "Should not stick",
        base,
        LATER,
      ),
    ).rejects.toThrow();

    for (const id of [a, b]) {
      expect((await memoriesOf(id))[0]?.value).toBe("A great article");
    }
  });
});
