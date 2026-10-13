/**
 * Move DAO (Phase 38.10 D-84, D-85, D-93, D-102, D-103, D-108, D-118;
 * convergence c1 F-D7/F-D8, c5, c9, c10, c11).
 *
 * Every case drives a real in-memory node:sqlite database at the migration
 * head through the real DAOs. AI never widens on a move, a move into Off
 * Limits locks a linked interaction's note for good, markers and share
 * origin survive every hop, and every move can be undone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { setAiPermissionDefault } from "@/db/ai-permissions-dao";
import { addCurrentStateEntry } from "@/db/current-state-history-dao";
import { getCurrentStateHistory } from "@/db/current-state-history-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  fieldsDroppedByMove,
  type KnowledgeEntryRef,
  type KnowledgeMoveEntry,
  KnowledgeMoveSourceError,
  KnowledgeMoveTargetError,
  KnowledgeMoveUndoError,
  type KnowledgeSection,
  moveKnowledgeEntriesCore,
  moveKnowledgeEntry,
  moveKnowledgeEntryCore,
  undoKnowledgeMove,
} from "@/db/knowledge-move-dao";
import {
  addMemory,
  deleteMemoryNow,
  type NewMemoryInput,
} from "@/db/memories-dao";
import { listMemoriesForContact } from "@/db/memories-read";
import { runMigrations } from "@/db/migrations/runner";
import { addOffLimits } from "@/db/off-limits-dao";
import { listOffLimitsForContact } from "@/db/off-limits-read";
import { editTouchpointFull } from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";
const LATER = "2026-10-13 12:05:00";
const TODAY = "2026-10-13";
const CREATED = "2026-09-01 08:00:00";

let counter = 0;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-${++counter}`,
  });
});

// --- Fixtures ------------------------------------------------------------------

async function seedContact(name = "Alex"): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, 30, ?, ?)`,
      [`contact-${++counter}`, name, NOW, NOW],
    )
  ).lastInsertRowId;
}

async function seedInteraction(
  contactId: number,
  note: string | null,
  options: {
    allowAi?: 0 | 1;
    occurredAt?: string;
    groupEventId?: number | null;
  } = {},
): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO interactions
         (uid, contact_id, occurred_at, recorded_at, note, source, modified_at,
          allow_ai, group_event_id)
       VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?)`,
      [
        `interaction-${++counter}`,
        contactId,
        options.occurredAt ?? "2026-09-20 18:30:00",
        NOW,
        note,
        NOW,
        options.allowAi ?? 0,
        options.groupEventId ?? null,
      ],
    )
  ).lastInsertRowId;
}

async function seedGroupEvent(groupNote: string): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO group_events (uid, title, occurred_at, group_note, created_at, modified_at)
       VALUES (?, 'Dinner', '2026-09-25 19:00:00', ?, ?, ?)`,
      [`group-${++counter}`, groupNote, NOW, NOW],
    )
  ).lastInsertRowId;
}

async function seedMemory(
  contactId: number,
  input: Partial<Omit<NewMemoryInput, "contactId">> = {},
): Promise<KnowledgeEntryRef> {
  const id = await addMemory(exec, {
    contactId,
    type: "general",
    value: "Loves climbing",
    createdAt: CREATED,
    now: CREATED,
    ...input,
  });
  return { table: "memories", id, contactId };
}

async function seedLta(
  contactId: number,
  input: {
    value?: string;
    entryDate?: string;
    entryTime?: string | null;
    url?: string | null;
    interactionId?: number | null;
    linkSource?: "note" | "group_note" | null;
    groupNoteCopy?: 0 | 1;
    fromShare?: 0 | 1;
    fieldKey?: "last_talked_about" | "current_location";
  } = {},
): Promise<KnowledgeEntryRef> {
  const id = await addCurrentStateEntry(exec, {
    contactId,
    fieldKey: input.fieldKey ?? "last_talked_about",
    value: input.value ?? "Their new job",
    entryDate: input.entryDate ?? "2026-09-10",
    entryTime: input.entryTime ?? null,
    url: input.url ?? null,
    interactionId: input.interactionId ?? null,
    linkSource: input.linkSource ?? null,
    groupNoteCopy: input.groupNoteCopy,
    fromShare: input.fromShare,
    createdAt: CREATED,
    now: CREATED,
  });
  return { table: "current_state_entries", id, contactId };
}

async function seedOffLimits(
  contactId: number,
  input: {
    label?: string | null;
    text?: string | null;
    url?: string | null;
  } = {},
): Promise<KnowledgeEntryRef> {
  const id = await addOffLimits(exec, {
    uid: `ol-${++counter}`,
    contactId,
    label: input.label === undefined ? null : input.label,
    text: input.text === undefined ? "Avoid the layoffs" : input.text,
    url: input.url ?? null,
    createdAt: CREATED,
    now: CREATED,
  });
  return { table: "off_limits", id, contactId };
}

async function revision(): Promise<number> {
  return (await exec.getFirstAsync<{ data_revision: number }>(
    "SELECT data_revision FROM app_settings WHERE id = 1",
  ))!.data_revision;
}

async function row(ref: KnowledgeEntryRef) {
  return exec.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${ref.table} WHERE id = ?`,
    [ref.id],
  );
}

async function count(table: string, contactId: number): Promise<number> {
  return (await exec.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE contact_id = ?`,
    [contactId],
  ))!.n;
}

async function tombstone(entityType: string, uid: string) {
  return (
    (
      await exec.getFirstAsync<{ deleted_at: string }>(
        "SELECT deleted_at FROM tombstones WHERE entity_type = ? AND entity_uid = ?",
        [entityType, uid],
      )
    )?.deleted_at ?? null
  );
}

async function interactionAi(id: number) {
  return exec.getFirstAsync<{ allow_ai: number; note_ai_locked: number }>(
    "SELECT allow_ai, note_ai_locked FROM interactions WHERE id = ?",
    [id],
  );
}

async function editInteractionAllowAi(
  interactionId: number,
  contactId: number,
  allowAi: number,
) {
  const cur = await exec.getFirstAsync<{
    occurred_at: string;
    channel: string;
    direction: string | null;
    connected: number;
    quality: string | null;
    note: string | null;
    duration: number | null;
  }>(
    "SELECT occurred_at, channel, direction, connected, quality, note, duration FROM interactions WHERE id = ?",
    [interactionId],
  );
  await editTouchpointFull(exec, {
    interactionId,
    contactId,
    now: LATER,
    occurredAt: cur!.occurred_at,
    channel: cur!.channel,
    direction: cur!.direction,
    connected: cur!.connected,
    quality: cur!.quality,
    note: cur!.note,
    duration: cur!.duration,
    allowAi,
  });
}

function move(
  ref: KnowledgeEntryRef,
  target: KnowledgeSection,
  extra: { carryEntryDate?: boolean; entryDate?: string; now?: string } = {},
) {
  return moveKnowledgeEntry(exec, {
    ref,
    target,
    now: extra.now ?? NOW,
    carryEntryDate: extra.carryEntryDate,
    entryDate: extra.entryDate,
  });
}

const MEMORY_ROW: Extract<KnowledgeMoveEntry, { table: "memories" }>["row"] = {
  type: "general",
  custom_label: null,
  value: "Loves climbing",
  note: null,
  meaningful_date: null,
  pinned: 0,
  outdated: 0,
  hidden: null,
  interaction_id: null,
};

// --- Within memories -------------------------------------------------------------

describe("type change within memories", () => {
  it("general → gift_idea keeps the row and its allow_ai, and drops nothing", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c, { allowAi: 1 });
    const before = await revision();

    const { ref: moved } = await move(ref, "gift_idea");

    expect(moved).toEqual(ref);
    expect(await row(ref)).toMatchObject({ type: "gift_idea", allow_ai: 1 });
    expect(await revision()).toBe(before + 1);
    expect(
      fieldsDroppedByMove(
        { table: "memories", row: { ...MEMORY_ROW, note: "x", pinned: 1 } },
        "gift_idea",
        TODAY,
      ),
    ).toEqual([]);
  });

  it("refuses a move into the section the entry is already in", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c);
    await expect(move(ref, "memory")).rejects.toBeInstanceOf(
      KnowledgeMoveTargetError,
    );
    const lta = await seedLta(c);
    await expect(move(lta, "last_talked_about")).rejects.toBeInstanceOf(
      KnowledgeMoveTargetError,
    );
  });
});

// --- Memory → Off Limits ------------------------------------------------------------

describe("memory → Off Limits", () => {
  it("copies label/text/url, tombstones and removes the source, new uid, one bump", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c, {
      value: "Their divorce",
      customLabel: "Family",
      url: "https://example.test/x",
      note: "Ask later",
      meaningfulDate: "2026-01-02",
      pinned: true,
    });
    const source = await row(ref);
    const before = await revision();

    const { ref: moved } = await move(ref, "off_limits");

    expect(moved.table).toBe("off_limits");
    expect(await row(moved)).toMatchObject({
      label: "Family",
      text: "Their divorce",
      url: "https://example.test/x",
      created_at: CREATED,
      group_note_copy: 0,
      from_share: 0,
    });
    expect((await row(moved))?.uid).not.toBe(source?.uid);
    expect(await row(ref)).toBeNull();
    expect(await tombstone("memory", source?.uid as string)).toBe(NOW);
    expect(await revision()).toBe(before + 1);
    expect(
      fieldsDroppedByMove(
        {
          table: "memories",
          row: {
            ...MEMORY_ROW,
            custom_label: "Family",
            value: "Their divorce",
            note: "Ask later",
            meaningful_date: "2026-01-02",
            pinned: 1,
          },
        },
        "off_limits",
        TODAY,
      ),
    ).toEqual(["note", "meaningful date", "pinned"]);
  });

  it("revision: three moves in one call bump once; bumpRevision false inside a caller transaction bumps 0", async () => {
    const c = await seedContact();
    const refs = [
      await seedMemory(c, { value: "a" }),
      await seedMemory(c, { value: "b" }),
      await seedMemory(c, { value: "c" }),
    ];
    let before = await revision();
    const moved = await inWriteTransaction(exec, () =>
      moveKnowledgeEntriesCore(exec, refs, "off_limits", NOW),
    );
    expect(moved.map((r) => r.table)).toEqual([
      "off_limits",
      "off_limits",
      "off_limits",
    ]);
    expect(await revision()).toBe(before + 1);

    before = await revision();
    await inWriteTransaction(exec, () =>
      moveKnowledgeEntriesCore(exec, moved, "memory", LATER, {
        bumpRevision: false,
      }),
    );
    expect(await revision()).toBe(before);
    expect(await count("memories", c)).toBe(3);
  });
});

// --- D-93 / D-103 ------------------------------------------------------------------

describe("D-93 / D-103: a note link into Off Limits locks the interaction's AI", () => {
  it("sets allow_ai 0 and note_ai_locked 1 in the same transaction; a later edit cannot widen it", async () => {
    const c = await seedContact();
    const interactionId = await seedInteraction(c, "Their new job", {
      allowAi: 1,
    });
    const ref = await seedMemory(c, {
      value: "Their new job",
      interactionId,
      linkSource: "note",
      allowAi: 1,
    });

    const { ref: moved } = await move(ref, "off_limits");

    expect(await interactionAi(interactionId)).toEqual({
      allow_ai: 0,
      note_ai_locked: 1,
    });
    expect(await row(moved)).toMatchObject({ text: "Their new job" });
    await editInteractionAllowAi(interactionId, c, 1);
    expect(await interactionAi(interactionId)).toEqual({
      allow_ai: 0,
      note_ai_locked: 1,
    });
  });

  it("a forced failure rolls everything back", async () => {
    const c = await seedContact();
    const interactionId = await seedInteraction(c, "Their new job", {
      allowAi: 1,
    });
    const ref = await seedMemory(c, {
      value: "Their new job",
      interactionId,
      linkSource: "note",
      allowAi: 1,
    });
    const source = await row(ref);
    const before = await revision();
    await exec.execAsync(
      `CREATE TRIGGER fail_off_limits BEFORE INSERT ON off_limits
       BEGIN SELECT RAISE(ABORT, 'forced failure'); END;`,
    );

    await expect(move(ref, "off_limits")).rejects.toThrow("forced failure");

    expect(await interactionAi(interactionId)).toEqual({
      allow_ai: 1,
      note_ai_locked: 0,
    });
    expect(await row(ref)).toMatchObject({
      uid: source?.uid,
      interaction_id: interactionId,
      allow_ai: 1,
    });
    expect(await tombstone("memory", source?.uid as string)).toBeNull();
    expect(await count("off_limits", c)).toBe(0);
    expect(await revision()).toBe(before);
  });
});

// --- D-102 Group Note copies -------------------------------------------------------

describe("D-102: Group Note copies keep their marker", () => {
  it("Last Talked About → Memory → Off Limits → Memory keeps group_note_copy 1 and ends AI-off", async () => {
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    const c = await seedContact();
    const eventId = await seedGroupEvent("Group text");
    const interactionId = await seedInteraction(c, null, {
      groupEventId: eventId,
      allowAi: 1,
    });
    const lta = await seedLta(c, {
      value: "Group text",
      entryDate: "2026-09-25",
      entryTime: "19:00:00",
      interactionId,
      linkSource: "group_note",
      groupNoteCopy: 1,
    });

    const step1 = (await move(lta, "memory")).ref;
    expect(await row(step1)).toMatchObject({
      group_note_copy: 1,
      allow_ai: 0,
      interaction_id: interactionId,
      link_source: "group_note",
    });
    const step2 = (await move(step1, "off_limits")).ref;
    expect(await row(step2)).toMatchObject({ group_note_copy: 1 });
    // No interaction writer runs for a Group Note copy (checker cycle 2 I-3).
    expect(await interactionAi(interactionId)).toEqual({
      allow_ai: 1,
      note_ai_locked: 0,
    });
    const step3 = (await move(step2, "thought_of_them")).ref;
    expect(await row(step3)).toMatchObject({
      type: "thought_of_them",
      group_note_copy: 1,
      allow_ai: 0,
      interaction_id: null,
    });
  });

  it("a Group Note copy into Off Limits drops its link and touches no interaction", async () => {
    const c = await seedContact();
    const eventId = await seedGroupEvent("Group text");
    const interactionId = await seedInteraction(c, "Own note", {
      groupEventId: eventId,
      allowAi: 1,
    });
    const ref = await seedMemory(c, {
      value: "Group text",
      interactionId,
      linkSource: "group_note",
      groupNoteCopy: 1,
    });
    const { ref: moved } = await move(ref, "off_limits");
    expect(await row(moved)).toMatchObject({
      group_note_copy: 1,
      text: "Group text",
    });
    expect(await interactionAi(interactionId)).toEqual({
      allow_ai: 1,
      note_ai_locked: 0,
    });
  });
});

// --- Into memories -------------------------------------------------------------------

describe("into a memory", () => {
  it("Off Limits → Memory is AI-off even under an ON default, nothing dropped", async () => {
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    const c = await seedContact();
    const ref = await seedOffLimits(c, {
      label: "Work",
      text: "Avoid the layoffs",
      url: "https://example.test/ol",
    });
    const { ref: moved } = await move(ref, "memory");
    expect(await row(moved)).toMatchObject({
      type: "general",
      custom_label: "Work",
      value: "Avoid the layoffs",
      url: "https://example.test/ol",
      allow_ai: 0,
      provenance: "user",
      created_at: CREATED,
    });
    expect(
      fieldsDroppedByMove(
        { table: "off_limits", row: { label: "Work", text: "Avoid" } },
        "memory",
        TODAY,
      ),
    ).toEqual([]);
  });

  it("unlinked Last Talked About → Memory carries value, url and the entry date as meaningful_date (c9)", async () => {
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    const c = await seedContact();
    const ref = await seedLta(c, {
      value: "Their trip",
      url: "https://example.test/trip",
      entryDate: "2026-09-12",
    });
    const { ref: moved } = await move(ref, "memory");
    expect(await row(moved)).toMatchObject({
      value: "Their trip",
      url: "https://example.test/trip",
      meaningful_date: "2026-09-12",
      allow_ai: 0,
      interaction_id: null,
    });
    expect(
      fieldsDroppedByMove(
        { table: "current_state_entries", row: { interaction_id: null } },
        "memory",
        TODAY,
      ),
    ).toEqual([]);
  });

  it("carryEntryDate false leaves meaningful_date NULL (c10)", async () => {
    const c = await seedContact();
    const ref = await seedLta(c, {
      value: "Their trip",
      url: "https://example.test/trip",
    });
    const { ref: moved } = await move(ref, "thought_of_them", {
      carryEntryDate: false,
    });
    expect(await row(moved)).toMatchObject({
      type: "thought_of_them",
      value: "Their trip",
      url: "https://example.test/trip",
      meaningful_date: null,
    });
    expect(
      fieldsDroppedByMove(
        { table: "current_state_entries", row: { interaction_id: null } },
        "thought_of_them",
        TODAY,
      ),
    ).toEqual([]);
  });

  it("linked Last Talked About → Memory keeps the link; note links follow the interaction's AI, group notes are 0", async () => {
    const c = await seedContact();
    const noteInteraction = await seedInteraction(c, "Talked jobs", {
      allowAi: 1,
    });
    const noteRef = await seedLta(c, {
      value: "Talked jobs",
      entryDate: "2026-09-20",
      entryTime: "18:30:00",
      interactionId: noteInteraction,
      linkSource: "note",
    });
    const { ref: noteMoved } = await move(noteRef, "memory");
    expect(await row(noteMoved)).toMatchObject({
      interaction_id: noteInteraction,
      link_source: "note",
      allow_ai: 1,
      meaningful_date: null,
    });
    expect(
      fieldsDroppedByMove(
        {
          table: "current_state_entries",
          row: { interaction_id: noteInteraction },
        },
        "memory",
        TODAY,
      ),
    ).toEqual([]);

    const eventId = await seedGroupEvent("Group text");
    const groupInteraction = await seedInteraction(c, null, {
      groupEventId: eventId,
      allowAi: 1,
    });
    const groupRef = await seedLta(c, {
      value: "Group text",
      interactionId: groupInteraction,
      linkSource: "group_note",
      groupNoteCopy: 1,
    });
    const { ref: groupMoved } = await move(groupRef, "memory");
    expect(await row(groupMoved)).toMatchObject({
      interaction_id: groupInteraction,
      link_source: "group_note",
      allow_ai: 0,
    });
  });
});

// --- Into Last Talked About ------------------------------------------------------------

describe("into Last Talked About", () => {
  it("value is firstNonBlank(value, custom_label, url); a past meaningful date becomes the entry date", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c, {
      value: null,
      customLabel: "Concert",
      url: "https://example.test/c",
      meaningfulDate: "2026-10-01",
    });
    const { ref: moved } = await move(ref, "last_talked_about");
    expect(await row(moved)).toMatchObject({
      field_key: "last_talked_about",
      value: "Concert",
      url: "https://example.test/c",
      entry_date: "2026-10-01",
      entry_time: null,
      created_at: CREATED,
    });
  });

  it("a future or free-text meaningful date falls back to the creation date", async () => {
    const c = await seedContact();
    const future = await seedMemory(c, { meaningfulDate: "2026-12-25" });
    const freeText = await seedMemory(c, { meaningfulDate: "last spring" });
    expect(
      (await row((await move(future, "last_talked_about")).ref))?.entry_date,
    ).toBe("2026-09-01");
    expect(
      (await row((await move(freeText, "last_talked_about")).ref))?.entry_date,
    ).toBe("2026-09-01");
  });

  it("a linked memory takes the interaction's date and time", async () => {
    const c = await seedContact();
    const interactionId = await seedInteraction(c, "Talked jobs", {
      occurredAt: "2026-09-20 18:30",
    });
    const ref = await seedMemory(c, {
      value: "Talked jobs",
      interactionId,
      linkSource: "note",
      meaningfulDate: "2025-01-01",
    });
    const { ref: moved } = await move(ref, "last_talked_about");
    expect(await row(moved)).toMatchObject({
      entry_date: "2026-09-20",
      entry_time: "18:30:00",
      interaction_id: interactionId,
      link_source: "note",
    });
  });

  it("the entryDate option dates an unlinked entry (checker cycle 3 I-8)", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c, { meaningfulDate: "2026-10-01" });
    const { ref: moved } = await move(ref, "last_talked_about", {
      entryDate: TODAY,
    });
    expect((await row(moved))?.entry_date).toBe(TODAY);
  });

  it("Off Limits → Last Talked About: firstNonBlank(text, label, url), url kept, no time, created date or option", async () => {
    const c = await seedContact();
    const both = await seedOffLimits(c, {
      label: "Work",
      text: "Layoffs",
      url: "https://example.test/ol",
    });
    const labelOnly = await seedOffLimits(c, { label: "Politics", text: null });
    const bothMoved = (await move(both, "last_talked_about")).ref;
    expect(await row(bothMoved)).toMatchObject({
      value: "Layoffs",
      url: "https://example.test/ol",
      entry_time: null,
      entry_date: "2026-09-01",
    });
    const labelMoved = (
      await move(labelOnly, "last_talked_about", { entryDate: "2026-10-10" })
    ).ref;
    expect(await row(labelMoved)).toMatchObject({
      value: "Politics",
      entry_date: "2026-10-10",
    });
  });

  it("Memory → Last Talked About drop list, one case each (D-85; c11)", async () => {
    const unlinked = (meaningful_date: string) => ({
      table: "memories" as const,
      row: { ...MEMORY_ROW, meaningful_date },
    });
    expect(
      fieldsDroppedByMove(unlinked("2026-12-25"), "last_talked_about", TODAY),
    ).toEqual(["meaningful date"]);
    expect(
      fieldsDroppedByMove(unlinked("last spring"), "last_talked_about", TODAY),
    ).toEqual(["meaningful date"]);
    expect(
      fieldsDroppedByMove(
        {
          table: "memories",
          row: {
            ...MEMORY_ROW,
            meaningful_date: "2025-01-01",
            interaction_id: 4,
          },
        },
        "last_talked_about",
        TODAY,
      ),
    ).toEqual(["meaningful date"]);
    expect(
      fieldsDroppedByMove(unlinked("2026-10-01"), "last_talked_about", TODAY),
    ).toEqual([]);
  });
});

// --- Into Off Limits from Last Talked About ---------------------------------------------

describe("Last Talked About → Off Limits (c5)", () => {
  it("text = value, label NULL, url, from_share and group_note_copy carried", async () => {
    const c = await seedContact();
    const ref = await seedLta(c, {
      value: "Their surgery",
      url: "https://example.test/s",
      fromShare: 1,
      groupNoteCopy: 1,
    });
    const { ref: moved } = await move(ref, "off_limits");
    expect(await row(moved)).toMatchObject({
      label: null,
      text: "Their surgery",
      url: "https://example.test/s",
      from_share: 1,
      group_note_copy: 1,
      created_at: CREATED,
    });
    expect(
      fieldsDroppedByMove(
        { table: "current_state_entries", row: { interaction_id: null } },
        "off_limits",
        TODAY,
      ),
    ).toEqual(["entry date"]);
    expect(
      fieldsDroppedByMove(
        { table: "current_state_entries", row: { interaction_id: 9 } },
        "off_limits",
        TODAY,
      ),
    ).toEqual(["linked note"]);
  });
});

// --- Refused sources and targets ---------------------------------------------------------

describe("refused sources and targets", () => {
  it("imported memories and custom fields are never a source or a target", async () => {
    const c = await seedContact();
    const imported = await seedMemory(c, {
      type: "imported",
      provenance: "import",
    });
    await expect(move(imported, "memory")).rejects.toBeInstanceOf(
      KnowledgeMoveSourceError,
    );
    await expect(move(imported, "off_limits")).rejects.toBeInstanceOf(
      KnowledgeMoveSourceError,
    );
    const general = await seedMemory(c);
    await expect(
      move(general, "imported" as KnowledgeSection),
    ).rejects.toBeInstanceOf(KnowledgeMoveTargetError);
    await expect(
      move(general, "custom_field" as KnowledgeSection),
    ).rejects.toBeInstanceOf(KnowledgeMoveTargetError);
    await expect(
      move(
        {
          table: "custom_field_values" as KnowledgeEntryRef["table"],
          id: 1,
          contactId: c,
        },
        "memory",
      ),
    ).rejects.toBeInstanceOf(KnowledgeMoveSourceError);
    expect(await row(imported)).toMatchObject({ type: "imported" });
    expect(await row(general)).toMatchObject({ type: "general" });
  });

  it("a Current Location entry is refused and nothing is written (D-84; F-D7)", async () => {
    const c = await seedContact();
    const ref = await seedLta(c, {
      fieldKey: "current_location",
      value: "Lisbon",
    });
    const before = await revision();
    for (const target of ["memory", "off_limits"] as const) {
      await expect(move(ref, target)).rejects.toBeInstanceOf(
        KnowledgeMoveSourceError,
      );
    }
    expect(await row(ref)).toMatchObject({ value: "Lisbon" });
    expect(await count("memories", c)).toBe(0);
    expect(await count("off_limits", c)).toBe(0);
    expect(await revision()).toBe(before);
  });
});

// --- D-85 drop list ---------------------------------------------------------------------

describe("D-85 drop list (F-D8)", () => {
  it("lists outdated, the visibility setting, the lost label and the linked note, one case each", () => {
    const memory = (patch: Partial<typeof MEMORY_ROW>) => ({
      table: "memories" as const,
      row: { ...MEMORY_ROW, ...patch },
    });
    expect(
      fieldsDroppedByMove(memory({ outdated: 1 }), "off_limits", TODAY),
    ).toEqual(["outdated"]);
    expect(
      fieldsDroppedByMove(memory({ outdated: 1 }), "last_talked_about", TODAY),
    ).toEqual(["outdated"]);
    expect(
      fieldsDroppedByMove(memory({ hidden: 0 }), "off_limits", TODAY),
    ).toEqual(["visibility setting"]);
    expect(
      fieldsDroppedByMove(memory({ hidden: 1 }), "last_talked_about", TODAY),
    ).toEqual(["visibility setting"]);
    expect(
      fieldsDroppedByMove(
        memory({ custom_label: "Hobby" }),
        "last_talked_about",
        TODAY,
      ),
    ).toEqual(["label"]);
    // A blank value: the label becomes the entry's value, nothing lost.
    expect(
      fieldsDroppedByMove(
        memory({ custom_label: "Hobby", value: null }),
        "last_talked_about",
        TODAY,
      ),
    ).toEqual([]);
    // Off Limits has a label column.
    expect(
      fieldsDroppedByMove(
        memory({ custom_label: "Hobby" }),
        "off_limits",
        TODAY,
      ),
    ).toEqual([]);
    expect(
      fieldsDroppedByMove(memory({ interaction_id: 3 }), "off_limits", TODAY),
    ).toEqual(["linked note"]);
    expect(
      fieldsDroppedByMove(
        memory({ interaction_id: 3 }),
        "last_talked_about",
        TODAY,
      ),
    ).toEqual([]);
    expect(
      fieldsDroppedByMove(
        memory({ outdated: 1, hidden: 1, pinned: 1 }),
        "gift_idea",
        TODAY,
      ),
    ).toEqual([]);
  });

  it("Off Limits → Last Talked About lists the label only when both text and label are set", () => {
    const ol = (label: string | null, text: string | null) => ({
      table: "off_limits" as const,
      row: { label, text },
    });
    expect(
      fieldsDroppedByMove(ol("Work", "Layoffs"), "last_talked_about", TODAY),
    ).toEqual(["label"]);
    expect(
      fieldsDroppedByMove(ol("Work", "  "), "last_talked_about", TODAY),
    ).toEqual([]);
    expect(
      fieldsDroppedByMove(ol(null, "Layoffs"), "last_talked_about", TODAY),
    ).toEqual([]);
  });
});

// --- D-108 share origin ------------------------------------------------------------------

describe("D-108: share origin survives every hop", () => {
  it("a share memory → Last Talked About → Off Limits → memory keeps from_share / provenance share and created_at", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c, { provenance: "share" });

    const lta = (await move(ref, "last_talked_about")).ref;
    expect(await row(lta)).toMatchObject({
      from_share: 1,
      created_at: CREATED,
    });
    const ol = (await move(lta, "off_limits")).ref;
    expect(await row(ol)).toMatchObject({ from_share: 1, created_at: CREATED });
    const back = (await move(ol, "thought_of_them")).ref;
    expect(await row(back)).toMatchObject({
      provenance: "share",
      created_at: CREATED,
      allow_ai: 0,
    });
  });

  it("a non-share entry keeps from_share 0 and provenance user", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c);
    const lta = (await move(ref, "last_talked_about")).ref;
    expect(await row(lta)).toMatchObject({ from_share: 0 });
    const ol = (await move(lta, "off_limits")).ref;
    expect(await row(ol)).toMatchObject({ from_share: 0 });
    const back = (await move(ol, "memory")).ref;
    expect(await row(back)).toMatchObject({ provenance: "user" });
  });
});

// --- Move Undo (D-118) ----------------------------------------------------------------------

describe("move Undo (D-118)", () => {
  it("a type change is changed back, allow_ai unchanged, one bump", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c, { allowAi: 1 });
    const { undo } = await move(ref, "gift_idea");
    const before = await revision();

    const restored = await undoKnowledgeMove(exec, undo, LATER);

    expect(restored).toEqual(ref);
    expect(await row(ref)).toMatchObject({ type: "general", allow_ai: 1 });
    expect(await revision()).toBe(before + 1);
  });

  async function memoryFull(c: number) {
    return seedMemory(c, {
      value: "Loves climbing",
      customLabel: "Hobby",
      note: "Ask about the gym",
      url: "https://example.test/m",
      meaningfulDate: "2026-12-25",
      pinned: true,
      outdated: true,
      hidden: true,
      provenance: "share",
    });
  }

  type Direction = {
    name: string;
    seed: (c: number) => Promise<KnowledgeEntryRef>;
    target: KnowledgeSection;
  };
  const DIRECTIONS: Direction[] = [
    {
      name: "Memory → Last Talked About",
      seed: memoryFull,
      target: "last_talked_about",
    },
    {
      name: "Last Talked About → Memory",
      seed: (c) =>
        seedLta(c, {
          url: "https://example.test/l",
          fromShare: 1,
          groupNoteCopy: 1,
        }),
      target: "memory",
    },
    { name: "Memory → Off Limits", seed: memoryFull, target: "off_limits" },
    {
      name: "Off Limits → Memory",
      seed: (c) => seedOffLimits(c, { label: "Work", text: "Layoffs" }),
      target: "gift_idea",
    },
    {
      name: "Last Talked About → Off Limits",
      seed: (c) => seedLta(c, { entryDate: "2026-08-08", fromShare: 1 }),
      target: "off_limits",
    },
    {
      name: "Off Limits → Last Talked About",
      seed: (c) =>
        seedOffLimits(c, {
          label: "Work",
          text: "Layoffs",
          url: "https://example.test/o",
        }),
      target: "last_talked_about",
    },
  ];

  const ENTITY: Record<KnowledgeEntryRef["table"], string> = {
    memories: "memory",
    current_state_entries: "current_state_entry",
    off_limits: "off_limits",
  };

  async function publicRows(ref: KnowledgeEntryRef) {
    if (ref.table === "memories") {
      return listMemoriesForContact(exec, ref.contactId);
    }
    if (ref.table === "current_state_entries") {
      return getCurrentStateHistory(exec, ref.contactId, "last_talked_about");
    }
    return listOffLimitsForContact(exec, ref.contactId);
  }

  for (const direction of DIRECTIONS) {
    it(`round trip: ${direction.name}`, async () => {
      const c = await seedContact();
      const ref = await direction.seed(c);
      const original = (await row(ref)) as Record<string, unknown>;

      const { ref: moved, undo } = await move(ref, direction.target);
      const movedRow = (await row(moved)) as Record<string, unknown>;
      await undoKnowledgeMove(exec, undo, LATER);

      // The original is back through its public read, uid and fields intact.
      const back = (await publicRows(ref)) as unknown as Record<
        string,
        unknown
      >[];
      expect(back).toHaveLength(1);
      const { modified_at: _a, ...originalFields } = original;
      const { modified_at: _b, ...restoredFields } = back[0];
      // Compare the stored columns only: the public memory read also projects
      // a derived column (linked_note_ai_locked) the raw row does not have.
      expect(
        Object.fromEntries(
          Object.entries(restoredFields).filter(([key]) => key in original),
        ),
      ).toEqual(
        Object.fromEntries(
          Object.entries(originalFields).filter(([key]) => key in back[0]),
        ),
      );
      expect(back[0].modified_at).toBe(LATER);
      // The moved copy is gone, with a tombstone; the original's is gone.
      expect(await count(moved.table, c)).toBe(
        moved.table === ref.table ? 1 : 0,
      );
      expect(await tombstone(ENTITY[moved.table], movedRow.uid as string)).toBe(
        LATER,
      );
      expect(
        await tombstone(ENTITY[ref.table], original.uid as string),
      ).toBeNull();
    });
  }

  it("a note-linked memory moved to Last Talked About and undone comes back linked", async () => {
    const c = await seedContact();
    const interactionId = await seedInteraction(c, "Talked jobs", {
      allowAi: 1,
    });
    const ref = await seedMemory(c, {
      value: "Talked jobs",
      interactionId,
      linkSource: "note",
      allowAi: 1,
    });
    const { ref: moved, undo } = await move(ref, "last_talked_about");
    expect(await row(moved)).toMatchObject({ interaction_id: interactionId });

    const restored = await undoKnowledgeMove(exec, undo, LATER);

    expect(await row(restored)).toMatchObject({
      interaction_id: interactionId,
      link_source: "note",
      allow_ai: 1,
    });
  });

  it("Undo of a move into Off Limits keeps AI off; the interaction stays locked (D-103)", async () => {
    const c = await seedContact();
    const unlinked = await seedMemory(c, { value: "Plain", allowAi: 1 });
    const { undo: undoPlain } = await move(unlinked, "off_limits");
    const plainBack = await undoKnowledgeMove(exec, undoPlain, LATER);
    expect(await row(plainBack)).toMatchObject({ value: "Plain", allow_ai: 0 });

    const interactionId = await seedInteraction(c, "Talked jobs", {
      allowAi: 1,
    });
    const linked = await seedMemory(c, {
      value: "Talked jobs",
      interactionId,
      linkSource: "note",
      allowAi: 1,
    });
    const { undo } = await move(linked, "off_limits");
    const back = await undoKnowledgeMove(exec, undo, LATER);
    expect(await row(back)).toMatchObject({
      allow_ai: 0,
      interaction_id: interactionId,
    });
    expect(await interactionAi(interactionId)).toEqual({
      allow_ai: 0,
      note_ai_locked: 1,
    });
    await editInteractionAllowAi(interactionId, c, 1);
    expect(await interactionAi(interactionId)).toEqual({
      allow_ai: 0,
      note_ai_locked: 1,
    });
  });

  it("throws KnowledgeMoveUndoError and writes nothing when the moved copy is gone", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c);
    const { ref: moved, undo } = await move(ref, "off_limits");
    await exec.runAsync("DELETE FROM off_limits WHERE id = ?", [moved.id]);
    const before = await revision();

    await expect(undoKnowledgeMove(exec, undo, LATER)).rejects.toBeInstanceOf(
      KnowledgeMoveUndoError,
    );
    expect(await count("memories", c)).toBe(0);
    expect(await revision()).toBe(before);

    const typed = await seedMemory(c);
    const { undo: typeUndo } = await move(typed, "gift_idea");
    await deleteMemoryNow(exec, { id: typed.id, contactId: c, now: LATER });
    await expect(
      undoKnowledgeMove(exec, typeUndo, LATER),
    ).rejects.toBeInstanceOf(KnowledgeMoveUndoError);
  });

  it("a cross-table Undo bumps the revision exactly once", async () => {
    const c = await seedContact();
    const ref = await seedLta(c);
    const { undo } = await move(ref, "off_limits");
    const before = await revision();
    await undoKnowledgeMove(exec, undo, LATER);
    expect(await revision()).toBe(before + 1);
  });

  it("the core composes inside a caller transaction (bumpRevision false bumps 0)", async () => {
    const c = await seedContact();
    const ref = await seedMemory(c);
    const before = await revision();
    await inWriteTransaction(exec, () =>
      moveKnowledgeEntryCore(exec, {
        ref,
        target: "off_limits",
        now: NOW,
        bumpRevision: false,
      }),
    );
    expect(await revision()).toBe(before);
  });
});
