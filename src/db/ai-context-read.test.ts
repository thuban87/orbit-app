/**
 * ai-context-read — H1 privacy proof (AI-03).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL DAOs, proving that `readPromptContext` serializes ONLY the closed
 * `PromptContext` allowlist: forbidden fuel, the free-text interaction column,
 * the free-text events column (a different table), non-allowlisted `contacts`
 * columns, and unapproved/quarantined/blank custom values can NEVER become prompt
 * input. Every excluded value carries a distinctive marker asserted absent from
 * the fully serialized context.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readPromptContext } from "@/db/ai-context-read";
import { recordEvent } from "@/db/events-dao";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { getValuesForContact, upsertValue } from "@/db/field-values-dao";
import { addFuel } from "@/db/fuel-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { runMigrations } from "@/db/migrations/runner";
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
  await runMigrations(
    exec,
    [migration001, migration002, migration003, migration004, migration005, migration006],
    6,
    { now: NOW, newUid: uid },
  );
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

    // Non-allowlisted contacts columns carry distinctive markers.
    await exec.runAsync(
      "UPDATE contacts SET phone = ?, email = ?, birthday = ? WHERE id = ?",
      ["555-PHONEMARK", "secret@EMAILMARK.test", "1991-02-03", c],
    );

    // Fuel: an off_limits item and an unconfirmed source='ai' item must NOT surface;
    // a normal item must.
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "off_limits",
      text: "OFFLIMITS_MARKER",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "fact",
      text: "AICONFIRM_MARKER",
      createdAt: NOW,
      source: "ai",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "topic",
      text: "Loves trail running",
      createdAt: "2026-08-01 09:00:00",
      source: "user",
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

    // The allowed fuel item is present…
    expect(serialized).toContain("Loves trail running");
    // …and every forbidden marker is absent.
    for (const marker of [
      "555-PHONEMARK",
      "EMAILMARK",
      "1991-02-03",
      "OFFLIMITS_MARKER",
      "AICONFIRM_MARKER",
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
    await upsertValue(
      exec,
      c,
      favoriteDrink.id,
      uid(),
      "Cold brew",
      NOW,
    );

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
    const sharedDefs = (await listDefs(exec, { includeQuarantined: false })).filter(
      (definition) => definition.share_with_ai === 1,
    );
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

  it("keeps ranked fuel in rank order with whole-day age, dropping raw timestamps", async () => {
    const c = await makeContact(30, 0, 1);
    // 'recent' outranks 'topic'; created 4 days before NOW.
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "topic",
      text: "Second",
      createdAt: "2026-08-10 12:00:00",
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "recent",
      text: "First",
      createdAt: "2026-08-10 12:00:00",
      source: "user",
      now: NOW,
    });
    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.rankedFuel.map((f) => f.text)).toEqual(["First", "Second"]);
    expect(ctx.rankedFuel[0].ageDays).toBe(4);
    expect(JSON.stringify(ctx)).not.toContain("2026-08-10");
  });

  it("reports newestChannel as explicit 'unspecified' when there are no interactions", async () => {
    const c = await makeContact(30, 0, 1);
    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.newestChannel).toBe("unspecified");
    expect(ctx.cadence).toEqual({ totalCount: 0, connectedCount: 0 });
  });
});
