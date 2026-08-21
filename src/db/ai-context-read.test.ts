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
import { readPromptContext } from "@/db/ai-context-read";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createField } from "@/db/field-ddl";
import { quarantineField } from "@/db/field-defs-dao";
import { upsertValue } from "@/db/field-values-dao";
import { addFuel } from "@/db/fuel-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { recordEvent } from "@/db/events-dao";
import { createContactWithInteraction, recordTouchpoint } from "@/db/recency-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
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
    await createField(exec, {
      uid: uid(),
      col_name: "unflagged_field",
      label: "Unflagged Field",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      display_order: 0,
      share_with_ai: 0,
      now: NOW,
    });
    await createField(exec, {
      uid: uid(),
      col_name: "quarantined_field",
      label: "Quarantined Field",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      display_order: 1,
      share_with_ai: 1,
      now: NOW,
    });
    const rowUid = uid();
    await upsertValue(exec, c, rowUid, "unflagged_field", "UNFLAGGED_MARKER", NOW);
    await upsertValue(
      exec,
      c,
      rowUid,
      "quarantined_field",
      "QUARANTINE_MARKER",
      NOW,
    );
    // Quarantine the second def AFTER writing its value.
    const qDef = (
      await exec.getAllAsync<{ id: number }>(
        "SELECT id FROM custom_field_defs WHERE col_name = 'quarantined_field'",
      )
    )[0];
    await quarantineField(exec, qDef.id, NOW);

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
    await createField(exec, {
      uid: uid(),
      col_name: "favorite_drink",
      label: "Favorite Drink",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      display_order: 0,
      share_with_ai: 1,
      now: NOW,
    });
    await upsertValue(exec, c, uid(), "favorite_drink", "Cold brew", NOW);

    const ctx = await readPromptContext(exec, c, NOW);
    expect(ctx.sharedFields).toEqual([
      { label: "Favorite Drink", value: "Cold brew" },
    ]);
  });

  it("omits a blank/null opted-in value without erroring (less data, no disclosure)", async () => {
    const c = await makeContact(30, 0, 1);
    await createField(exec, {
      uid: uid(),
      col_name: "hobby",
      label: "Hobby",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      display_order: 0,
      share_with_ai: 1,
      now: NOW,
    });
    // A whitespace-only value is treated as absent.
    await upsertValue(exec, c, uid(), "hobby", "   ", NOW);

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
