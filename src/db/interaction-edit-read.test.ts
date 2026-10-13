import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  blankNoteBlockedBy,
  readInteractionForEdit,
  readOwnNoteLinkedSection,
} from "@/db/interaction-edit-read";
import type { LinkedEntry } from "@/db/linked-entry-dao";
import { runMigrations } from "@/db/migrations/runner";
import { recordTouchpointWithLinkedEntry } from "@/db/recency-dao";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-11 12:00:00";
let exec: SqlExecutor;
let sequence = 0;
const uid = () => `interaction-edit-read-${++sequence}`;

beforeEach(async () => {
  sequence = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

async function contact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, 30, 1, ?, ?)`,
    [uid(), name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function interaction(
  contactId: number,
  overrides: {
    occurredAt?: string;
    channel?: string;
    direction?: string | null;
    connected?: number;
    quality?: string | null;
    note?: string | null;
    duration?: number | null;
    allowAi?: number;
  } = {},
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, direction,
        connected, quality, note, duration, allow_ai, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
    [
      uid(),
      contactId,
      overrides.occurredAt ?? "2026-09-01 09:30:00",
      NOW,
      overrides.channel ?? "Message",
      "direction" in overrides ? overrides.direction : "outbound",
      overrides.connected ?? 1,
      "quality" in overrides ? overrides.quality : "Positive",
      "note" in overrides ? overrides.note : "private long-form note",
      "duration" in overrides ? overrides.duration : null,
      overrides.allowAi ?? 0,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

function readOnly(): ReadOnlyExecutor {
  return {
    getFirstAsync: exec.getFirstAsync.bind(exec),
    getAllAsync: exec.getAllAsync.bind(exec),
  };
}

describe("readInteractionForEdit — contact-scoped single-row load for editing", () => {
  it("returns every editable field including note, duration, and allow_ai", async () => {
    const contactId = await contact();
    const id = await interaction(contactId, {
      occurredAt: "2026-08-20 18:00:00",
      channel: "Call",
      direction: "inbound",
      connected: 0,
      quality: "Neutral",
      note: "quick call about the trip",
      duration: 900,
      allowAi: 1,
    });

    expect(await readInteractionForEdit(readOnly(), contactId, id)).toEqual({
      id,
      contactId,
      occurredAt: "2026-08-20 18:00:00",
      channel: "Call",
      direction: "inbound",
      connected: 0,
      quality: "Neutral",
      note: "quick call about the trip",
      duration: 900,
      allowAi: 1,
      noteAiLocked: 0,
    });
  });

  it("reports a note moved into Off Limits as AI-locked (38.10 D-103)", async () => {
    const contactId = await contact();
    const id = await interaction(contactId, { allowAi: 0 });
    expect(
      (await readInteractionForEdit(readOnly(), contactId, id))?.noteAiLocked,
    ).toBe(0);
    await exec.runAsync(
      "UPDATE interactions SET note_ai_locked = 1 WHERE id = ?",
      [id],
    );
    expect(
      (await readInteractionForEdit(readOnly(), contactId, id))?.noteAiLocked,
    ).toBe(1);
  });

  it("reads a null note, null duration, and allow_ai=0 back faithfully", async () => {
    const contactId = await contact();
    const id = await interaction(contactId, {
      note: null,
      duration: null,
      allowAi: 0,
    });
    const loaded = await readInteractionForEdit(readOnly(), contactId, id);
    expect(loaded?.note).toBeNull();
    expect(loaded?.duration).toBeNull();
    expect(loaded?.allowAi).toBe(0);
  });

  it("is scoped by BOTH id AND contact_id — a mismatched contactId returns null", async () => {
    const owner = await contact("Owner");
    const other = await contact("Other");
    const id = await interaction(owner);

    expect(await readInteractionForEdit(readOnly(), owner, id)).not.toBeNull();
    // Right interaction id, WRONG contact — must not leak another contact's row.
    expect(await readInteractionForEdit(readOnly(), other, id)).toBeNull();
  });

  it("returns null for an interaction id that does not exist", async () => {
    const contactId = await contact();
    expect(await readInteractionForEdit(readOnly(), contactId, 999)).toBeNull();
  });

  it("accepts a ReadOnlyExecutor (no write surface — opens no transaction)", async () => {
    const contactId = await contact();
    const id = await interaction(contactId);
    // A ReadOnlyExecutor exposes only getFirstAsync/getAllAsync; passing exactly
    // that surface proves the read never reaches for a write/exec method.
    const ro: ReadOnlyExecutor = {
      getFirstAsync: exec.getFirstAsync.bind(exec),
      getAllAsync: exec.getAllAsync.bind(exec),
    };
    expect(await readInteractionForEdit(ro, contactId, id)).not.toBeNull();
  });
});

function entry(
  interactionId: number,
  linkSource: LinkedEntry["linkSource"],
  section: LinkedEntry["section"] = "gift_idea",
): LinkedEntry {
  return {
    table:
      section === "last_talked_about" ? "current_state_entries" : "memories",
    id: interactionId * 10,
    contactId: 1,
    interactionId,
    linkSource,
    section,
    label: section,
  };
}

describe("blankNoteBlockedBy — own-note links only (Research Q4; checker cycle 5 W-4; D-113)", () => {
  it("a blank participant note with only a Group Note copy is not blocked", () => {
    expect(
      blankNoteBlockedBy([entry(7, "group_note")], { interactionId: 7 }),
    ).toBeNull();
  });

  it("a blank participant note with a note link is blocked, naming its section", () => {
    expect(
      blankNoteBlockedBy(
        [
          entry(7, "group_note", "memory"),
          entry(7, "note", "last_talked_about"),
        ],
        { interactionId: 7 },
      ),
    ).toBe("last_talked_about");
  });

  it("a blank own note with only group_note entries for that interaction is not blocked", () => {
    expect(
      blankNoteBlockedBy(
        [entry(7, "group_note", "memory"), entry(7, "group_note", "gift_idea")],
        { interactionId: 7 },
      ),
    ).toBeNull();
  });

  it("another interaction's note link never blocks this one", () => {
    expect(
      blankNoteBlockedBy([entry(8, "note")], { interactionId: 7 }),
    ).toBeNull();
    expect(blankNoteBlockedBy([], { interactionId: 7 })).toBeNull();
  });
});

describe("readOwnNoteLinkedSection — the edit screens' pre-check read", () => {
  it("returns the section of the interaction's own linked note, else null", async () => {
    const contactId = await contact();
    const plain = await interaction(contactId);
    expect(await readOwnNoteLinkedSection(readOnly(), plain)).toBeNull();

    const { interactionId } = await recordTouchpointWithLinkedEntry(
      exec,
      {
        contactId,
        uid: uid(),
        occurredAt: "2026-09-01 09:30:00",
        now: NOW,
        channel: "Call",
        direction: "outbound",
        connected: 1,
        quality: null,
        note: "Loves kites",
        duration: null,
        allowAi: 0,
        source: "manual",
      },
      "gift_idea",
    );
    expect(await readOwnNoteLinkedSection(readOnly(), interactionId)).toBe(
      "gift_idea",
    );
  });
});
