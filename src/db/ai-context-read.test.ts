/**
 * ai-context-read — H1 privacy proof (AI-03).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration chain
 * and the REAL DAOs, proving that `readPromptContext` serializes ONLY the closed
 * `PromptContext` allowlist: Off Limits, Last Talked About, Current Location,
 * memories and notes outside the two-sided AI gate, the free-text interaction column,
 * the free-text events column (a different table), non-allowlisted `contacts`
 * columns, and unapproved/quarantined/blank custom values can NEVER become prompt
 * input. Every excluded value carries a distinctive marker asserted absent from
 * the fully serialized context.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readPromptContext } from "@/db/ai-context-read";
import { addCurrentStateEntry } from "@/db/current-state-history-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { recordEvent } from "@/db/events-dao";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { getValuesForContact, upsertValue } from "@/db/field-values-dao";
import { createGroupEvent } from "@/db/group-events-dao";
import { addMemory } from "@/db/memories-dao";
import { runMigrations } from "@/db/migrations/runner";
import { addOffLimits } from "@/db/off-limits-dao";
import {
  createContactWithInteraction,
  recordTouchpoint,
} from "@/db/recency-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let defIdCounter = 0;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  defIdCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

describe("readPromptContext — Group Notes are structurally unreachable", () => {
  it("never egresses a group note at either Allow-AI setting", async () => {
    const contactId = await makeContact();
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(),
      title: "Dinner",
      occurredAt: NOW,
      now: NOW,
      groupNote: "GROUP_NOTE_EGRESS_FORBIDDEN",
      participants: [{ contactId, uid: uid(), note: "CHILD_NOTE" }],
    });
    const child = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM interactions WHERE group_event_id = ?",
      [groupEventId],
    );
    expect(child).not.toBeNull();
    for (const allowAi of [0, 1]) {
      await exec.runAsync("UPDATE interactions SET allow_ai = ? WHERE id = ?", [
        allowAi,
        child?.id,
      ]);
      const ctx = await readPromptContext(exec, contactId, NOW);
      // The event-level Group Note is structurally unreachable (the projection
      // never reads group_events) at either Allow-AI setting — including the new
      // gated recent-interaction-note shape (D-08 / ADR-078, unchanged by D-14).
      expect(JSON.stringify(ctx)).not.toContain("GROUP_NOTE_EGRESS_FORBIDDEN");
      expect(JSON.stringify(ctx.recentInteractions ?? [])).not.toContain(
        "GROUP_NOTE_EGRESS_FORBIDDEN",
      );
    }
  });
});

async function makeContact(
  intervalDays = 137,
  rarelyResponds = 0,
  categoryId: number | null = 1,
): Promise<number> {
  const { contactId } = await createContactWithInteraction(exec, {
    uid: uid(),
    name: "Alex Rivera",
    intervalDays,
    categoryId,
    rarelyResponds,
    now: NOW,
  });
  return contactId;
}

async function addMethodPiiFixture(contactId: number): Promise<void> {
  await exec.runAsync(
    `INSERT INTO contact_methods
       (uid, contact_id, method_type, raw_value, display_value, canonical_value,
        is_actionable, is_primary, display_order, created_at, modified_at)
     VALUES (?, ?, 'phone', ?, ?, ?, 1, 1, 0, ?, ?)`,
    [
      uid(),
      contactId,
      "RAW_PHONE_MARKER",
      "FORMATTED_PHONE_MARKER",
      "CANONICAL_PHONE_MARKER",
      NOW,
      NOW,
    ],
  );
  await exec.runAsync(
    `INSERT INTO contact_methods
       (uid, contact_id, method_type, raw_value, display_value, canonical_value,
        is_actionable, is_primary, display_order, created_at, modified_at)
     VALUES (?, ?, 'email', ?, ?, ?, 1, 1, 0, ?, ?)`,
    [
      uid(),
      contactId,
      "RAW_EMAIL_MARKER",
      "FORMATTED_EMAIL_MARKER",
      "CANONICAL_EMAIL_MARKER",
      NOW,
      NOW,
    ],
  );
}

async function makeNeverAssignedUnboundContact(): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, category_id, interval_days, tracking_enabled, created_at, modified_at)
     VALUES (?, 'Unbound Alex', 3, NULL, 0, ?, ?)`,
    [uid(), NOW, NOW],
  );
  return result.lastInsertRowId;
}

function makeDef(
  colName: string,
  overrides: Partial<CustomFieldDef> = {},
): CustomFieldDef {
  return {
    id: ++defIdCounter,
    uid: uid(),
    col_name: colName,
    label: colName,
    type: "text",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: defIdCounter - 1,
    quarantined_at: null,
    share_with_ai: 0,
    scope: "global",
    history_retained: 0,
    field_group: null,
    created_at: NOW,
    modified_at: NOW,
    ...overrides,
  };
}

/** Seed definitions directly; this suite is deliberately independent of field DDL churn. */
async function persistDef(definition: CustomFieldDef): Promise<void> {
  await exec.runAsync(
    `INSERT INTO custom_field_defs (
       id, uid, col_name, label, type, options, show_on_new, always_show,
       display_order, quarantined_at, share_with_ai, created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      definition.id,
      definition.uid,
      definition.col_name,
      definition.label,
      definition.type,
      definition.options,
      definition.show_on_new,
      definition.always_show,
      definition.display_order,
      definition.quarantined_at,
      definition.share_with_ai,
      definition.created_at,
      definition.modified_at,
    ],
  );
}

describe("readPromptContext — allowlist projection (H1)", () => {
  it("egresses a Memory only after its explicit per-item opt-in", async () => {
    const c = await makeContact();
    const memoryId = await addMemory(exec, {
      contactId: c,
      type: "general",
      value: "MEMORY_EGRESS_MARKER",
      createdAt: NOW,
      now: NOW,
    });

    expect((await readPromptContext(exec, c, NOW)).sharedMemories).toEqual([]);
    await exec.runAsync("UPDATE memories SET allow_ai = 1 WHERE id = ?", [
      memoryId,
    ]);
    expect((await readPromptContext(exec, c, NOW)).sharedMemories).toEqual([
      // D-11 (34-02): the general Memory type now labels as "Memory" (was "General").
      { label: "Memory", value: "MEMORY_EGRESS_MARKER" },
    ]);
  });

  it("returns the two direct identifiers: name + category NAME from the join (C2-H1)", async () => {
    const c = await makeContact(30, 0, 3); // category_id 3 = 'Work'
    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.contactName).toBe("Alex Rivera");
    expect(ctx.category).toBe("Work");
  });

  it("maps a NULL category_id to an empty string, never leaking category_id", async () => {
    const c = await makeContact(30, 0, null);
    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.category).toBe("");
    expect(JSON.stringify(ctx)).not.toContain("category_id");
  });

  it("throws for a missing contact (loud failure, never a broad read)", async () => {
    await expect(readPromptContext(exec, 999999, NOW)).rejects.toThrow();
  });

  it("excludes every forbidden value — the H1 sensitive-column exclusion fixture", async () => {
    const c = await makeContact(137, 1, 1);

    // Normalized raw/display/canonical method values carry distinctive markers.
    await addMethodPiiFixture(c);
    await exec.runAsync("UPDATE contacts SET birthday = ? WHERE id = ?", [
      "1991-02-03",
      c,
    ]);

    // Off Limits (label and text), Last Talked About, Current Location and an
    // AI-off memory must NOT surface; an opted-in memory must (D-09, D-16, D-31).
    await addOffLimits(exec, {
      uid: uid(),
      contactId: c,
      label: "OFFLIMITS_LABEL_MARKER",
      text: "OFFLIMITS_MARKER",
      url: "https://offlimits.example/OFFLIMITS_URL_MARKER",
      now: NOW,
    });
    await addCurrentStateEntry(exec, {
      contactId: c,
      fieldKey: "last_talked_about",
      value: "LASTTALKED_MARKER",
      entryDate: "2026-08-01",
      now: NOW,
    });
    await addCurrentStateEntry(exec, {
      contactId: c,
      fieldKey: "current_location",
      value: "LOCATION_MARKER",
      entryDate: "2026-08-01",
      now: NOW,
    });
    await addMemory(exec, {
      contactId: c,
      type: "general",
      value: "AIOFF_MEMORY_MARKER",
      allowAi: 0,
      createdAt: NOW,
      now: NOW,
    });
    await addMemory(exec, {
      contactId: c,
      type: "thought_of_them",
      value: "Loves trail running",
      allowAi: 1,
      createdAt: "2026-08-01 09:00:00",
      now: NOW,
    });

    // An interaction carrying a distinctive marker in its free-text column.
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      channel: "sms",
      direction: "outbound",
      connected: 1,
      quality: "good",
      note: "NOTEPROSE_MARKER",
      now: NOW,
    });

    // An events row (DIFFERENT table) carrying a distinctive marker in its
    // free-text column.
    await recordEvent(exec, {
      contactId: c,
      uid: uid(),
      type: "archive",
      occurredAt: "2026-07-02 10:00:00",
      detail: "EVENTPROSE_MARKER",
      now: NOW,
    });

    // Custom fields: unflagged (share_with_ai=0) and quarantined must NOT surface.
    const unflaggedDef = makeDef("unflagged_field", {
      label: "Unflagged Field",
      display_order: 0,
      share_with_ai: 0,
    });
    const quarantinedDef = makeDef("quarantined_field", {
      label: "Quarantined Field",
      display_order: 1,
      share_with_ai: 1,
      quarantined_at: NOW,
    });
    await persistDef(unflaggedDef);
    await persistDef(quarantinedDef);
    await upsertValue(exec, c, unflaggedDef.id, uid(), "UNFLAGGED_MARKER", NOW);
    await upsertValue(
      exec,
      c,
      quarantinedDef.id,
      uid(),
      "QUARANTINE_MARKER",
      NOW,
    );

    const ctx = await readPromptContext(exec, c, NOW);
    const serialized = JSON.stringify(ctx);

    // The opted-in memory is present…
    expect(serialized).toContain("Loves trail running");
    // …and every forbidden marker is absent.
    for (const marker of [
      "RAW_PHONE_MARKER",
      "FORMATTED_PHONE_MARKER",
      "CANONICAL_PHONE_MARKER",
      "RAW_EMAIL_MARKER",
      "FORMATTED_EMAIL_MARKER",
      "CANONICAL_EMAIL_MARKER",
      "1991-02-03",
      "OFFLIMITS_MARKER",
      "OFFLIMITS_LABEL_MARKER",
      "OFFLIMITS_URL_MARKER",
      "LASTTALKED_MARKER",
      "LOCATION_MARKER",
      "AIOFF_MEMORY_MARKER",
      "NOTEPROSE_MARKER",
      "EVENTPROSE_MARKER",
      "UNFLAGGED_MARKER",
      "QUARANTINE_MARKER",
    ]) {
      expect(serialized).not.toContain(marker);
    }

    // The raw derivation-only interval_days (137) must not be serialized, and no
    // interval_days / rarely_responds key may appear (C3-M3).
    expect(serialized).not.toContain("137");
    expect(serialized).not.toContain("interval");
    expect(serialized).not.toContain("rarely");
    // Derived signals still exist.
    expect(ctx.gravityTier).toBeTypeOf("string");
    expect(ctx.newestChannel).toBe("sms");
  });

  it("surfaces a live share_with_ai=1 field keyed by label with its value", async () => {
    const c = await makeContact(30, 0, 1);
    const favoriteDrink = makeDef("favorite_drink", {
      label: "Favorite Drink",
      display_order: 0,
      share_with_ai: 1,
    });
    await persistDef(favoriteDrink);
    await upsertValue(exec, c, favoriteDrink.id, uid(), "Cold brew", NOW);

    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.sharedFields).toEqual([
      { label: "Favorite Drink", value: "Cold brew" },
    ]);
  });

  it("cannot widen the shared DAO map or prompt projection with non-shared and quarantined pairs", async () => {
    const c = await makeContact(30, 0, 1);
    const shared = makeDef("shared_fact", {
      label: "Shared fact",
      share_with_ai: 1,
      display_order: 0,
    });
    const blank = makeDef("blank_fact", {
      label: "Blank fact",
      share_with_ai: 1,
      display_order: 1,
    });
    const whitespace = makeDef("whitespace_fact", {
      label: "Whitespace fact",
      share_with_ai: 1,
      display_order: 2,
    });
    const nullValue = makeDef("null_fact", {
      label: "Null fact",
      share_with_ai: 1,
      display_order: 3,
    });
    const unshared = makeDef("private_fact", {
      label: "Private fact",
      display_order: 4,
    });
    const quarantined = makeDef("retired_fact", {
      label: "Retired fact",
      share_with_ai: 1,
      quarantined_at: NOW,
      display_order: 5,
    });
    for (const definition of [
      shared,
      blank,
      whitespace,
      nullValue,
      unshared,
      quarantined,
    ]) {
      await persistDef(definition);
    }
    await upsertValue(exec, c, shared.id, uid(), "Lives near the lake", NOW);
    await upsertValue(exec, c, blank.id, uid(), "", NOW);
    await upsertValue(exec, c, whitespace.id, uid(), "   ", NOW);
    await upsertValue(exec, c, nullValue.id, uid(), null, NOW);
    await upsertValue(exec, c, unshared.id, uid(), "PRIVATE_MARKER", NOW);
    await upsertValue(exec, c, quarantined.id, uid(), "RETIRED_MARKER", NOW);

    // This is the exact defs-filtered map supplied to readSharedFields.
    const sharedDefs = (
      await listDefs(exec, { includeQuarantined: false })
    ).filter((definition) => definition.share_with_ai === 1);
    expect(await getValuesForContact(exec, c, sharedDefs)).toEqual({
      shared_fact: "Lives near the lake",
      blank_fact: "",
      whitespace_fact: "   ",
      null_fact: null,
    });

    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.sharedFields).toEqual([
      { label: "Shared fact", value: "Lives near the lake" },
    ]);
    expect(JSON.stringify(ctx)).not.toContain("PRIVATE_MARKER");
    expect(JSON.stringify(ctx)).not.toContain("RETIRED_MARKER");
  });

  it("omits a blank/null opted-in value without erroring (less data, no disclosure)", async () => {
    const c = await makeContact(30, 0, 1);
    const hobby = makeDef("hobby", {
      label: "Hobby",
      display_order: 0,
      share_with_ai: 1,
    });
    await persistDef(hobby);
    // A whitespace-only value is treated as absent.
    await upsertValue(exec, c, hobby.id, uid(), "   ", NOW);

    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.sharedFields).toEqual([]);
  });

  it("reports newestChannel as explicit 'unspecified' when there are no interactions", async () => {
    const c = await makeContact(30, 0, 1);
    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.newestChannel).toBe("unspecified");
    expect(ctx.cadence).toEqual({ totalCount: 0, connectedCount: 0 });
  });

  it("keeps explicit AI context available but neutral for a dormant-cadence Unbound contact", async () => {
    const c = await makeContact(30, 0, 3);
    await exec.runAsync(
      "UPDATE contacts SET tracking_enabled = 0 WHERE id = ?",
      [c],
    );
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-10 12:00:00",
      channel: "sms",
      direction: "outbound",
      connected: 1,
      now: NOW,
    });
    await addMethodPiiFixture(c);

    const ctx = await readPromptContext(exec, c, NOW);

    expect(ctx.contactName).toBe("Alex Rivera");
    expect(ctx.category).toBe("Work");
    expect(ctx.intensity).toEqual({
      currentCount: 0,
      intendedPerPeriod: 0,
      multiple: 0,
      trailingAvgGapDays: null,
    });
    expect(JSON.stringify(ctx)).not.toMatch(/RAW_|FORMATTED_|CANONICAL_/);
  });

  it("keeps explicit AI context available but neutral for a never-assigned Unbound contact", async () => {
    const c = await makeNeverAssignedUnboundContact();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-10 12:00:00",
      channel: "email",
      direction: "outbound",
      connected: 1,
      now: NOW,
    });
    await addMethodPiiFixture(c);

    const ctx = await readPromptContext(exec, c, NOW);

    expect(ctx.contactName).toBe("Unbound Alex");
    expect(ctx.category).toBe("Work");
    expect(ctx.intensity).toEqual({
      currentCount: 0,
      intendedPerPeriod: 0,
      multiple: 0,
      trailingAvgGapDays: null,
    });
    expect(JSON.stringify(ctx)).not.toMatch(/RAW_|FORMATTED_|CANONICAL_/);
  });
});

describe("readPromptContext — gated recent-interaction notes (ADR-078 carry, D-08/D-13; off-limits closed by D-14/ADR-107)", () => {
  it("carries a recent-interaction note ONLY when that interaction's allow_ai=1", async () => {
    const c = await makeContact();
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-10 10:00:00",
      channel: "Message",
      direction: "outbound",
      connected: 1,
      note: "GATED_NOTE_MARKER",
      now: NOW,
    });

    // allow_ai defaults OFF (migration 025) → the note is NOT carried.
    expect((await readPromptContext(exec, c, NOW)).recentInteractions).toEqual([
      {
        occurredAt: "2026-08-10 10:00:00",
        channel: "Message",
        tone: null,
      },
    ]);

    // Flip the per-interaction gate ON → the note is carried.
    await exec.runAsync("UPDATE interactions SET allow_ai = 1 WHERE id = ?", [
      interactionId,
    ]);
    expect((await readPromptContext(exec, c, NOW)).recentInteractions).toEqual([
      {
        occurredAt: "2026-08-10 10:00:00",
        channel: "Message",
        tone: null,
        note: "GATED_NOTE_MARKER",
      },
    ]);
  });

  it("returns an empty (not null) collection when there are no eligible notes", async () => {
    const c = await makeContact();
    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.recentInteractions).toEqual([]);
  });

  it("omits a blank / whitespace-only note even when allow_ai=1 (less data, no disclosure)", async () => {
    const c = await makeContact();
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-10 10:00:00",
      channel: "Message",
      connected: 1,
      note: "   ",
      now: NOW,
    });
    await exec.runAsync("UPDATE interactions SET allow_ai = 1 WHERE id = ?", [
      interactionId,
    ]);
    expect((await readPromptContext(exec, c, NOW)).recentInteractions).toEqual([
      {
        occurredAt: "2026-08-10 10:00:00",
        channel: "Message",
        tone: null,
      },
    ]);
  });

  it("orders carried notes newest-first and bounds to the three most recent interactions", async () => {
    const c = await makeContact();
    // Four eligible interactions; the oldest must fall outside the 3-most-recent window.
    const specs = [
      { at: "2026-08-01 10:00:00", note: "OLDEST" },
      { at: "2026-08-05 10:00:00", note: "THIRD" },
      { at: "2026-08-09 10:00:00", note: "SECOND" },
      { at: "2026-08-12 10:00:00", note: "NEWEST" },
    ];
    for (const s of specs) {
      const { interactionId } = await recordTouchpoint(exec, {
        contactId: c,
        uid: uid(),
        occurredAt: s.at,
        channel: "Message",
        connected: 1,
        note: s.note,
        now: NOW,
      });
      await exec.runAsync("UPDATE interactions SET allow_ai = 1 WHERE id = ?", [
        interactionId,
      ]);
    }
    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.recentInteractions).toEqual([
      {
        occurredAt: "2026-08-12 10:00:00",
        channel: "Message",
        tone: null,
        note: "NEWEST",
      },
      {
        occurredAt: "2026-08-09 10:00:00",
        channel: "Message",
        tone: null,
        note: "SECOND",
      },
      {
        occurredAt: "2026-08-05 10:00:00",
        channel: "Message",
        tone: null,
        note: "THIRD",
      },
    ]);
  });

  it("never carries an Off Limits value in ANY AI-facing shape, including the gated notes (D-14 / ADR-107)", async () => {
    const c = await makeContact();
    await addOffLimits(exec, {
      uid: uid(),
      contactId: c,
      label: "OFFLIMITS_LABEL_NEVER_AI",
      text: "OFFLIMITS_NEVER_AI",
      now: NOW,
    });
    // An allow_ai=1 interaction never turns an off-limits value into a carried note.
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-10 10:00:00",
      channel: "Message",
      connected: 1,
      note: "ordinary note",
      now: NOW,
    });
    await exec.runAsync("UPDATE interactions SET allow_ai = 1 WHERE id = ?", [
      interactionId,
    ]);

    const ctx = await readPromptContext(exec, c, NOW);
    // Off Limits appears in NEITHER the memories NOR the gated notes NOR any
    // other AI-facing shape (D-09: the AI read never touches its table).
    expect(JSON.stringify(ctx)).not.toContain("OFFLIMITS_NEVER_AI");
    expect(JSON.stringify(ctx)).not.toContain("OFFLIMITS_LABEL_NEVER_AI");
    expect(ctx.recentInteractions).toEqual([
      {
        occurredAt: "2026-08-10 10:00:00",
        channel: "Message",
        tone: null,
        note: "ordinary note",
      },
    ]);
  });
});

describe("readInteractionAggregates — migrated-vocabulary regression (D-06 trip-wire)", () => {
  it("counts Positive/Neutral/Negative over a jump-from-legacy-migrated fixture (no silent zero)", async () => {
    // Build a fixture at the PRE-025 schema, seed legacy quality values via raw
    // INSERT, then apply migration 025 to remap them. If readInteractionAggregates
    // still compared the stale 'good'/'fine'/'hard' literals, every count would
    // silently read zero — this proves it compares the migrated Tone vocabulary.
    let n = 0;
    const seedUid = () => `mig-uid-${++n}`;
    const legacyExec = nodeSqliteExecutor(openTestDb());
    await runMigrations(legacyExec, MIGRATIONS, 17, {
      now: NOW,
      newUid: seedUid,
      defaultPhoneRegion: "US",
    });

    const contactResult = await legacyExec.runAsync(
      `INSERT INTO contacts
         (uid, name, interval_days, tracking_enabled, created_at, modified_at)
       VALUES (?, 'Legacy Alex', 30, 1, ?, ?)`,
      [seedUid(), NOW, NOW],
    );
    const contactId = contactResult.lastInsertRowId;
    // Two 'good', one 'fine', one 'hard' — LEGACY literals, seeded pre-migration.
    for (const quality of ["good", "good", "fine", "hard"]) {
      await legacyExec.runAsync(
        `INSERT INTO interactions
           (uid, contact_id, occurred_at, recorded_at, channel, direction,
            connected, quality, source, modified_at)
         VALUES (?, ?, ?, ?, 'text', 'outbound', 1, ?, 'manual', ?)`,
        [seedUid(), contactId, "2026-07-01 10:00:00", NOW, quality, NOW],
      );
    }

    // Apply the chain through migration 025 — which remaps the four legacy
    // rows to Positive/Neutral/Negative — and on to the current schema, so the
    // read runs where the memory and note gates find migration 033's columns.
    await runMigrations(legacyExec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: seedUid,
      defaultPhoneRegion: "US",
    });

    const ctx = await readPromptContext(legacyExec, contactId, NOW);
    // good=Positive (2), fine=Neutral (1), hard=Negative (1) — non-zero, matching.
    expect(ctx.quality).toEqual({ good: 2, fine: 1, hard: 1 });
    // The newest channel was 'text' -> migrated to 'Message'.
    expect(ctx.newestChannel).toBe("Message");
  });
});

describe("readPromptContext — two-sided AI gate in SQL (D-31, D-49, D-102, D-103)", () => {
  async function logNote(
    contactId: number,
    occurredAt: string,
    note: string,
    allowAi: 0 | 1,
  ): Promise<number> {
    const { interactionId } = await recordTouchpoint(exec, {
      contactId,
      uid: uid(),
      occurredAt,
      channel: "Message",
      connected: 1,
      note,
      now: NOW,
    });
    await exec.runAsync("UPDATE interactions SET allow_ai = ? WHERE id = ?", [
      allowAi,
      interactionId,
    ]);
    return interactionId;
  }

  async function linkMemory(
    contactId: number,
    interactionId: number,
    value: string,
    allowAi: 0 | 1,
    linkSource: "note" | "group_note" = "note",
  ): Promise<number> {
    return addMemory(exec, {
      contactId,
      type: "general",
      value,
      allowAi,
      interactionId,
      linkSource,
      createdAt: NOW,
      now: NOW,
    });
  }

  /** Push four newer interactions so `occurredAt` falls outside the 3 recent rows. */
  async function pushOutOfRecent(contactId: number): Promise<void> {
    for (const at of [
      "2026-08-11 10:00:00",
      "2026-08-12 10:00:00",
      "2026-08-13 10:00:00",
    ]) {
      await recordTouchpoint(exec, {
        contactId,
        uid: uid(),
        occurredAt: at,
        channel: "Message",
        connected: 1,
        now: NOW,
      });
    }
  }

  /** Write a row the schema CHECKs forbid, to prove the predicate on its own. */
  async function withChecksOff(sql: string, params: unknown[]): Promise<void> {
    await exec.execAsync("PRAGMA ignore_check_constraints = ON");
    try {
      await exec.runAsync(sql, params as never[]);
    } finally {
      await exec.execAsync("PRAGMA ignore_check_constraints = OFF");
    }
  }

  const occurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  it("sends a linked memory only when its interaction allows AI", async () => {
    const c = await makeContact();
    const interactionId = await logNote(
      c,
      "2026-08-01 10:00:00",
      "LINKED_TEXT",
      0,
    );
    await linkMemory(c, interactionId, "LINKED_TEXT", 1);
    await pushOutOfRecent(c);

    expect(JSON.stringify(await readPromptContext(exec, c, NOW))).not.toContain(
      "LINKED_TEXT",
    );

    await exec.runAsync("UPDATE interactions SET allow_ai = 1 WHERE id = ?", [
      interactionId,
    ]);
    expect((await readPromptContext(exec, c, NOW)).sharedMemories).toEqual([
      { label: "Memory", value: "LINKED_TEXT" },
    ]);
  });

  it("omits an interaction note whose linked memory has AI off, keeping the row", async () => {
    const c = await makeContact();
    const interactionId = await logNote(
      c,
      "2026-08-10 10:00:00",
      "ONE_SWITCH_NOTE",
      1,
    );
    await linkMemory(c, interactionId, "ONE_SWITCH_NOTE", 0);

    const ctx = await readPromptContext(exec, c, NOW);
    expect(JSON.stringify(ctx)).not.toContain("ONE_SWITCH_NOTE");
    expect(ctx.recentInteractions).toEqual([
      { occurredAt: "2026-08-10 10:00:00", channel: "Message", tone: null },
    ]);
  });

  it("never sends a Group Note-linked memory, even at Allow AI 1", async () => {
    const c = await makeContact();
    const interactionId = await logNote(
      c,
      "2026-08-01 10:00:00",
      "participant note",
      1,
    );
    await linkMemory(c, interactionId, "GROUP_LINK_MARKER", 1, "group_note");
    await pushOutOfRecent(c);

    expect(JSON.stringify(await readPromptContext(exec, c, NOW))).not.toContain(
      "GROUP_LINK_MARKER",
    );
  });

  it("sends Gift Ideas and Thought of Them only at Allow AI 1", async () => {
    const c = await makeContact();
    await addMemory(exec, {
      contactId: c,
      type: "gift_idea",
      value: "GIFT_OFF",
      allowAi: 0,
      createdAt: NOW,
      now: NOW,
    });
    await addMemory(exec, {
      contactId: c,
      type: "thought_of_them",
      value: "THOUGHT_OFF",
      allowAi: 0,
      createdAt: NOW,
      now: NOW,
    });
    await addMemory(exec, {
      contactId: c,
      type: "gift_idea",
      value: "GIFT_ON",
      allowAi: 1,
      createdAt: NOW,
      now: NOW,
    });
    await addMemory(exec, {
      contactId: c,
      type: "thought_of_them",
      value: "THOUGHT_ON",
      allowAi: 1,
      createdAt: NOW,
      now: NOW,
    });

    const ctx = await readPromptContext(exec, c, NOW);
    const values = ctx.sharedMemories?.map((m) => m.value).sort();
    expect(values).toEqual(["GIFT_ON", "THOUGHT_ON"]);
    expect(JSON.stringify(ctx)).not.toMatch(/GIFT_OFF|THOUGHT_OFF/);
  });

  it("never sends Last Talked About or Off Limits values, linked or not", async () => {
    const c = await makeContact();
    const interactionId = await logNote(
      c,
      "2026-08-10 10:00:00",
      "ordinary note",
      1,
    );
    await addCurrentStateEntry(exec, {
      contactId: c,
      fieldKey: "last_talked_about",
      value: "LTA_DIRECT_MARKER",
      entryDate: "2026-08-10",
      now: NOW,
    });
    await addCurrentStateEntry(exec, {
      contactId: c,
      fieldKey: "last_talked_about",
      value: "LTA_LINKED_MARKER",
      entryDate: "2026-08-10",
      interactionId,
      linkSource: "note",
      now: NOW,
    });
    await addOffLimits(exec, {
      uid: uid(),
      contactId: c,
      text: "OFFLIMITS_GATE_MARKER",
      now: NOW,
    });

    const serialized = JSON.stringify(await readPromptContext(exec, c, NOW));
    for (const marker of [
      "LTA_DIRECT_MARKER",
      "LTA_LINKED_MARKER",
      "OFFLIMITS_GATE_MARKER",
    ]) {
      expect(serialized).not.toContain(marker);
    }
    expect(serialized).toContain("ordinary note");
  });

  it("D-102: an unlinked Group Note copy is still never sent", async () => {
    const c = await makeContact();
    // The schema CHECK already forces a copy AI-off; forge allow_ai 1 to prove
    // the predicate's own marker term keeps it out once interaction_id is NULL
    // (FK SET NULL, detach or dissolve).
    await withChecksOff(
      `INSERT INTO memories
         (uid, contact_id, type, value, provenance, created_at, modified_at,
          allow_ai, interaction_id, link_source, group_note_copy)
       VALUES (?, ?, 'general', 'UNLINKED_COPY_MARKER', 'user', ?, ?, 1, NULL, NULL, 1)`,
      [uid(), c, NOW, NOW],
    );

    expect(JSON.stringify(await readPromptContext(exec, c, NOW))).not.toContain(
      "UNLINKED_COPY_MARKER",
    );
  });

  it("D-102: a Group Note copy whose interaction was deleted stays out", async () => {
    const c = await makeContact();
    const interactionId = await logNote(
      c,
      "2026-08-01 10:00:00",
      "participant",
      0,
    );
    await addMemory(exec, {
      contactId: c,
      type: "general",
      value: "DELETED_EVENT_COPY",
      interactionId,
      linkSource: "group_note",
      groupNoteCopy: 1,
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync("DELETE FROM interactions WHERE id = ?", [
      interactionId,
    ]);
    const copy = await exec.getFirstAsync<{
      interaction_id: number | null;
      group_note_copy: number;
    }>("SELECT interaction_id, group_note_copy FROM memories WHERE value = ?", [
      "DELETED_EVENT_COPY",
    ]);
    expect(copy).toEqual({ interaction_id: null, group_note_copy: 1 });

    expect(JSON.stringify(await readPromptContext(exec, c, NOW))).not.toContain(
      "DELETED_EVENT_COPY",
    );
  });

  it("D-103: a locked interaction note is omitted and its note-linked memory excluded", async () => {
    const c = await makeContact();
    const interactionId = await logNote(
      c,
      "2026-08-10 10:00:00",
      "LOCKED_NOTE_MARKER",
      0,
    );
    await linkMemory(c, interactionId, "LOCKED_NOTE_MARKER", 1);
    // Realistic shape: the lock forces the interaction AI-off.
    await exec.runAsync(
      "UPDATE interactions SET note_ai_locked = 1 WHERE id = ?",
      [interactionId],
    );
    expect(JSON.stringify(await readPromptContext(exec, c, NOW))).not.toContain(
      "LOCKED_NOTE_MARKER",
    );

    // Forge allow_ai 1 past the CHECK: the lock term alone still withholds both.
    await withChecksOff("UPDATE interactions SET allow_ai = 1 WHERE id = ?", [
      interactionId,
    ]);
    const ctx = await readPromptContext(exec, c, NOW);
    expect(JSON.stringify(ctx)).not.toContain("LOCKED_NOTE_MARKER");
    expect(ctx.recentInteractions).toEqual([
      { occurredAt: "2026-08-10 10:00:00", channel: "Message", tone: null },
    ]);
  });

  it("F-D1: a note-linked memory whose interaction belongs to another contact is excluded", async () => {
    const c = await makeContact();
    const other = await makeContact();
    const foreignInteraction = await logNote(
      other,
      "2026-08-01 10:00:00",
      "foreign note",
      1,
    );
    await linkMemory(c, foreignInteraction, "CROSS_CONTACT_MARKER", 1);

    expect(JSON.stringify(await readPromptContext(exec, c, NOW))).not.toContain(
      "CROSS_CONTACT_MARKER",
    );
  });

  it("F-D11: a linked note in the recent rows is sent once; an older one is sent as a memory", async () => {
    const c = await makeContact();
    const recentId = await logNote(
      c,
      "2026-08-10 10:00:00",
      "RECENT_LINKED",
      1,
    );
    await linkMemory(c, recentId, "RECENT_LINKED", 1);

    const ctx = await readPromptContext(exec, c, NOW);
    expect(occurrences(JSON.stringify(ctx), "RECENT_LINKED")).toBe(1);
    expect(ctx.recentInteractions?.[0]?.note).toBe("RECENT_LINKED");
    expect(ctx.sharedMemories).toEqual([]);

    const other = await makeContact();
    const olderId = await logNote(
      other,
      "2026-08-01 10:00:00",
      "OLDER_LINKED",
      1,
    );
    await linkMemory(other, olderId, "OLDER_LINKED", 1);
    await pushOutOfRecent(other);

    const olderCtx = await readPromptContext(exec, other, NOW);
    expect(occurrences(JSON.stringify(olderCtx), "OLDER_LINKED")).toBe(1);
    expect(olderCtx.sharedMemories).toEqual([
      { label: "Memory", value: "OLDER_LINKED" },
    ]);
  });
});
