/**
 * Linked-entry cores (Phase 38.10 D-37, D-49, D-95, D-96, D-98, D-102,
 * D-103). Real migrations to TARGET_VERSION on node:sqlite.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  entryDateTimeOf,
  getLinkedEntriesCore,
  getLinkedInteractionRefCore,
  insertLinkedEntryCore,
  LinkedSectionTakenError,
  linkedSectionLabel,
  setLinkedAllowAiCore,
} from "@/db/linked-entry-dao";
import { runMigrations } from "@/db/migrations/runner";
import {
  createContactWithInteraction,
  recordTouchpoint,
} from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";
let counter = 0;
const uid = () => `linked-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function contactWithNote(
  note = "Their new job",
  allowAi = 0,
): Promise<{ contactId: number; interactionId: number }> {
  const { contactId } = await createContactWithInteraction(exec, {
    uid: uid(),
    name: `Contact ${counter}`,
    intervalDays: 30,
    now: NOW,
  });
  const { interactionId } = await recordTouchpoint(exec, {
    contactId,
    uid: uid(),
    occurredAt: "2026-07-01 18:45:00",
    now: NOW,
    note,
    allowAi,
  });
  return { contactId, interactionId };
}

function tx<T>(body: () => Promise<T>): Promise<T> {
  return inWriteTransaction(exec, body);
}

describe("module graph (checker W9)", () => {
  it.each([
    "@/db/linked-entry-dao",
    "@/db/recency-dao",
    "@/db/group-events-dao",
    "@/db/memories-dao",
    "@/db/current-state-history-dao",
    "@/db/ai-permissions-dao",
  ])("%s imports on its own without throwing", async (path) => {
    vi.resetModules();
    await expect(import(/* @vite-ignore */ path)).resolves.toBeDefined();
  });
});

describe("insertLinkedEntryCore", () => {
  it("marks a group_note copy in either table and keeps a memory copy AI-off (D-98, D-102)", async () => {
    const { contactId, interactionId } = await contactWithNote("Mine", 1);
    const memory = await tx(() =>
      insertLinkedEntryCore(exec, {
        interactionId,
        contactId,
        section: "memory",
        text: "Group dinner plans",
        linkSource: "group_note",
        occurredAt: "2026-07-01 18:45:00",
        now: NOW,
      }),
    );
    expect(
      await exec.getFirstAsync(
        "SELECT allow_ai, group_note_copy, link_source FROM memories WHERE id = ?",
        [memory.id],
      ),
    ).toEqual({ allow_ai: 0, group_note_copy: 1, link_source: "group_note" });

    const other = await contactWithNote("Theirs", 1);
    const lta = await tx(() =>
      insertLinkedEntryCore(exec, {
        interactionId: other.interactionId,
        contactId: other.contactId,
        section: "last_talked_about",
        text: "Group dinner plans",
        linkSource: "group_note",
        occurredAt: "2026-07-01 18:45",
        now: NOW,
      }),
    );
    expect(
      await exec.getFirstAsync(
        "SELECT group_note_copy, entry_date, entry_time FROM current_state_entries WHERE id = ?",
        [lta.id],
      ),
    ).toEqual({
      group_note_copy: 1,
      entry_date: "2026-07-01",
      entry_time: "18:45:00",
    });
  });

  it("enforces one entry per (interaction, link source) across both tables (D-95)", async () => {
    const { contactId, interactionId } = await contactWithNote();
    await tx(() =>
      insertLinkedEntryCore(exec, {
        interactionId,
        contactId,
        section: "gift_idea",
        text: "Their new job",
        linkSource: "note",
        occurredAt: "2026-07-01 18:45:00",
        now: NOW,
      }),
    );
    await expect(
      tx(() =>
        insertLinkedEntryCore(exec, {
          interactionId,
          contactId,
          section: "last_talked_about",
          text: "Their new job",
          linkSource: "note",
          occurredAt: "2026-07-01 18:45:00",
          now: NOW,
        }),
      ),
    ).rejects.toBeInstanceOf(LinkedSectionTakenError);
    // The Group Note slot is a different slot.
    await expect(
      tx(() =>
        insertLinkedEntryCore(exec, {
          interactionId,
          contactId,
          section: "last_talked_about",
          text: "Group note",
          linkSource: "group_note",
          occurredAt: "2026-07-01 18:45:00",
          now: NOW,
        }),
      ),
    ).resolves.toMatchObject({ table: "current_state_entries" });
  });

  it("a note link takes the interaction's stored allow_ai, 0 under the D-103 lock", async () => {
    const { contactId, interactionId } = await contactWithNote("Note", 1);
    await exec.runAsync(
      "UPDATE interactions SET allow_ai = 0, note_ai_locked = 1 WHERE id = ?",
      [interactionId],
    );
    const ref = await tx(() =>
      insertLinkedEntryCore(exec, {
        interactionId,
        contactId,
        section: "memory",
        text: "Note",
        linkSource: "note",
        occurredAt: "2026-07-01 18:45:00",
        now: NOW,
      }),
    );
    expect(
      await exec.getFirstAsync("SELECT allow_ai FROM memories WHERE id = ?", [
        ref.id,
      ]),
    ).toEqual({ allow_ai: 0 });
  });

  it("refuses another contact's interaction and blank text", async () => {
    const a = await contactWithNote();
    const b = await contactWithNote();
    await expect(
      tx(() =>
        insertLinkedEntryCore(exec, {
          interactionId: a.interactionId,
          contactId: b.contactId,
          section: "memory",
          text: "x",
          linkSource: "note",
          occurredAt: "2026-07-01 18:45:00",
          now: NOW,
        }),
      ),
    ).rejects.toThrow(/no interaction matched/);
    await expect(
      tx(() =>
        insertLinkedEntryCore(exec, {
          interactionId: a.interactionId,
          contactId: a.contactId,
          section: "memory",
          text: " ",
          linkSource: "note",
          occurredAt: "2026-07-01 18:45:00",
          now: NOW,
        }),
      ),
    ).rejects.toThrow(/non-blank/);
  });
});

describe("reads", () => {
  it("getLinkedEntriesCore returns section, registry label and link source; skips trashed memories", async () => {
    const a = await contactWithNote();
    const b = await contactWithNote();
    await tx(async () => {
      await insertLinkedEntryCore(exec, {
        interactionId: a.interactionId,
        contactId: a.contactId,
        section: "thought_of_them",
        text: "Their new job",
        linkSource: "note",
        occurredAt: "2026-07-01 18:45:00",
        now: NOW,
      });
      await insertLinkedEntryCore(exec, {
        interactionId: a.interactionId,
        contactId: a.contactId,
        section: "last_talked_about",
        text: "Group note",
        linkSource: "group_note",
        occurredAt: "2026-07-01 18:45:00",
        now: NOW,
      });
      await insertLinkedEntryCore(exec, {
        interactionId: b.interactionId,
        contactId: b.contactId,
        section: "memory",
        text: "Their new job",
        linkSource: "note",
        occurredAt: "2026-07-01 18:45:00",
        now: NOW,
      });
    });
    await exec.runAsync(
      "UPDATE memories SET deleted_at = ? WHERE interaction_id = ?",
      [NOW, b.interactionId],
    );
    const entries = await getLinkedEntriesCore(exec, [
      a.interactionId,
      b.interactionId,
    ]);
    expect(
      entries.map(({ section, label, linkSource, table }) => ({
        section,
        label,
        linkSource,
        table,
      })),
    ).toEqual([
      {
        section: "last_talked_about",
        label: linkedSectionLabel("last_talked_about"),
        linkSource: "group_note",
        table: "current_state_entries",
      },
      {
        section: "thought_of_them",
        label: "Thought of Them",
        linkSource: "note",
        table: "memories",
      },
    ]);
    expect(await getLinkedEntriesCore(exec, [])).toEqual([]);
  });

  it("getLinkedInteractionRefCore returns the interaction's event, or null when gone", async () => {
    const { contactId, interactionId } = await contactWithNote();
    expect(await getLinkedInteractionRefCore(exec, interactionId)).toEqual({
      interactionId,
      contactId,
      groupEventId: null,
    });
    expect(await getLinkedInteractionRefCore(exec, 9999)).toBeNull();
  });

  it("entryDateTimeOf slices the local stamp and pads a bare HH:MM", () => {
    expect(entryDateTimeOf("2026-07-01 18:45")).toEqual({
      entryDate: "2026-07-01",
      entryTime: "18:45:00",
    });
    expect(entryDateTimeOf("2026-07-01")).toEqual({
      entryDate: "2026-07-01",
      entryTime: null,
    });
  });
});

describe("setLinkedAllowAiCore", () => {
  it("sets the interaction flag and clamps a D-103 lock in SQL", async () => {
    const { interactionId } = await contactWithNote();
    expect(
      await tx(() =>
        setLinkedAllowAiCore(exec, { interactionId, allowAi: 1, now: NOW }),
      ),
    ).toBe(1);
    await exec.runAsync(
      "UPDATE interactions SET allow_ai = 0, note_ai_locked = 1 WHERE id = ?",
      [interactionId],
    );
    expect(
      await tx(() =>
        setLinkedAllowAiCore(exec, { interactionId, allowAi: 1, now: NOW }),
      ),
    ).toBe(0);
    expect(
      await exec.getFirstAsync(
        "SELECT allow_ai, note_ai_locked FROM interactions WHERE id = ?",
        [interactionId],
      ),
    ).toEqual({ allow_ai: 0, note_ai_locked: 1 });
  });
});
