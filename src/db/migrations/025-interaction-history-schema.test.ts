/**
 * Migration 025 — behavioural proof (D-06 / D-07 / D-11 / HIST-14).
 *
 * Seeds an interactions fixture on the earliest schema that has both the
 * `interactions` table (v1) and `app_settings` (v2), then JUMPS straight to v25
 * with migration 025 alone pending — proving the step is additive and
 * order-independent (it assumes no particular starting state). Asserts the full
 * Tone/channel value remap, NULL/other/unspecified pass-through, `allow_ai`
 * DEFAULT 0 + CHECK, nullable `duration`, and the two `app_settings` history
 * prefs. A separate assertion pins the migration's FROZEN CASE outputs equal to
 * the shared `interaction-vocabulary` helpers (they cannot drift) while a source
 * grep proves the migration does not import or call those helpers at runtime.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  remapLegacyChannel,
  remapLegacyQuality,
} from "@/db/interaction-vocabulary";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import {
  INTERACTION_HISTORY_SCHEMA_VERSION,
  migration025,
} from "@/db/migrations/025-interaction-history-schema";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-11 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;

/** Seed a contact + one interaction carrying the given legacy quality/channel. */
async function seedContactAndInteraction(
  quality: string | null,
  channel: string,
  note: string | null,
): Promise<{ contactId: number; interactionUid: string }> {
  const contactResult = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, 'Alex', 30, ?, ?)`,
    [uid(), NOW, NOW],
  );
  const contactId = contactResult.lastInsertRowId;
  const interactionUid = uid();
  await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, quality, note, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
    [interactionUid, contactId, NOW, NOW, channel, quality, note, NOW],
  );
  return { contactId, interactionUid };
}

async function readInteraction(interactionUid: string): Promise<{
  channel: string;
  quality: string | null;
  note: string | null;
  duration: number | null;
  allow_ai: number;
}> {
  const row = await exec.getFirstAsync<{
    channel: string;
    quality: string | null;
    note: string | null;
    duration: number | null;
    allow_ai: number;
  }>(
    "SELECT channel, quality, note, duration, allow_ai FROM interactions WHERE uid = ?",
    [interactionUid],
  );
  if (!row) throw new Error(`no interaction ${interactionUid}`);
  return row;
}

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  // Reach the earliest schema that has both interactions (v1) and app_settings (v2).
  await runMigrations(exec, [migration001, migration002], 2, {
    now: NOW,
    newUid: uid,
  });
});

/** Apply migration 025 alone (the only pending step) — the jump-to-v25. */
async function migrateToV25(): Promise<void> {
  await runMigrations(
    exec,
    [migration001, migration002, migration025],
    INTERACTION_HISTORY_SCHEMA_VERSION,
    { now: NOW, newUid: uid },
  );
}

describe("migration 025 — Tone/channel value remap", () => {
  it("remaps every legacy quality value and passes NULL/other through", async () => {
    const positive = await seedContactAndInteraction("good", "unspecified", "n1");
    const neutral = await seedContactAndInteraction("fine", "unspecified", "n2");
    const negative = await seedContactAndInteraction("hard", "unspecified", "n3");
    const nullQuality = await seedContactAndInteraction(null, "unspecified", "n4");
    const otherQuality = await seedContactAndInteraction("other", "unspecified", "n5");

    await migrateToV25();

    expect((await readInteraction(positive.interactionUid)).quality).toBe("Positive");
    expect((await readInteraction(neutral.interactionUid)).quality).toBe("Neutral");
    expect((await readInteraction(negative.interactionUid)).quality).toBe("Negative");
    // NULL is NOT coerced to a Tone value.
    expect((await readInteraction(nullQuality.interactionUid)).quality).toBeNull();
    // A non-legacy value passes through unchanged.
    expect((await readInteraction(otherQuality.interactionUid)).quality).toBe("other");
  });

  it("remaps every legacy channel value and passes other/unspecified through", async () => {
    const text = await seedContactAndInteraction(null, "text", null);
    const email = await seedContactAndInteraction(null, "email", null);
    const call = await seedContactAndInteraction(null, "call", null);
    const inPerson = await seedContactAndInteraction(null, "in-person", null);
    const other = await seedContactAndInteraction(null, "other", null);
    const unspecified = await seedContactAndInteraction(null, "unspecified", null);

    await migrateToV25();

    expect((await readInteraction(text.interactionUid)).channel).toBe("Message");
    expect((await readInteraction(email.interactionUid)).channel).toBe("Message");
    expect((await readInteraction(call.interactionUid)).channel).toBe("Call");
    expect((await readInteraction(inPerson.interactionUid)).channel).toBe("In Person");
    expect((await readInteraction(other.interactionUid)).channel).toBe("other");
    expect((await readInteraction(unspecified.interactionUid)).channel).toBe("unspecified");
  });

  it("never rewrites the free-text note column", async () => {
    const { interactionUid } = await seedContactAndInteraction(
      "hard",
      "text",
      "NOTE_PRESERVED_MARKER",
    );
    await migrateToV25();
    expect((await readInteraction(interactionUid)).note).toBe("NOTE_PRESERVED_MARKER");
  });

  it("pins the frozen migration CASE outputs equal to the shared vocabulary helpers", async () => {
    // Seed one row per legacy quality AND channel input, migrate, then assert the
    // stored value equals the shared helper's output — the migration cannot drift
    // from src/db/interaction-vocabulary.ts even though it never imports it.
    const qualityCases: Array<string | null> = [
      "good",
      "fine",
      "hard",
      "other",
      "unspecified",
      null,
    ];
    const channelCases = [
      "text",
      "email",
      "call",
      "in-person",
      "other",
      "unspecified",
    ];
    const seeded: Array<{
      uid: string;
      quality: string | null;
      channel: string;
    }> = [];
    for (const quality of qualityCases) {
      for (const channel of channelCases) {
        const { interactionUid } = await seedContactAndInteraction(
          quality,
          channel,
          null,
        );
        seeded.push({ uid: interactionUid, quality, channel });
      }
    }

    await migrateToV25();

    for (const row of seeded) {
      const stored = await readInteraction(row.uid);
      expect(stored.quality).toBe(remapLegacyQuality(row.quality) ?? null);
      expect(stored.channel).toBe(remapLegacyChannel(row.channel));
    }
  });
});

describe("migration 025 — new columns", () => {
  it("sets allow_ai=0 on every migrated row and defaults a new insert to 0", async () => {
    const migrated = await seedContactAndInteraction("good", "text", null);
    await migrateToV25();

    expect((await readInteraction(migrated.interactionUid)).allow_ai).toBe(0);

    // A new insert that omits allow_ai defaults to 0.
    const freshUid = uid();
    await exec.runAsync(
      `INSERT INTO interactions
         (uid, contact_id, occurred_at, recorded_at, channel, source, modified_at)
       VALUES (?, ?, ?, ?, 'Message', 'manual', ?)`,
      [freshUid, migrated.contactId, NOW, NOW, NOW],
    );
    expect((await readInteraction(freshUid)).allow_ai).toBe(0);
  });

  it("rejects an allow_ai value outside {0,1} (CHECK enforced)", async () => {
    const { contactId } = await seedContactAndInteraction("good", "text", null);
    await migrateToV25();
    // node:sqlite throws synchronously from run(); wrap in an async thunk so the
    // sync throw surfaces as a rejected promise for `.rejects`.
    await expect(
      (async () =>
        exec.runAsync(
          `INSERT INTO interactions
             (uid, contact_id, occurred_at, recorded_at, channel, source, allow_ai, modified_at)
           VALUES (?, ?, ?, ?, 'Message', 'manual', 2, ?)`,
          [uid(), contactId, NOW, NOW, NOW],
        ))(),
    ).rejects.toThrow();
  });

  it("leaves duration NULL when absent (never 0)", async () => {
    const { interactionUid } = await seedContactAndInteraction("good", "text", null);
    await migrateToV25();
    expect((await readInteraction(interactionUid)).duration).toBeNull();
  });

  it("adds the two app_settings history preferences with their defaults", async () => {
    await migrateToV25();
    const settings = await exec.getFirstAsync<{
      history_lens: string;
      history_cycle_count: number;
    }>("SELECT history_lens, history_cycle_count FROM app_settings WHERE id = 1");
    expect(settings).toEqual({ history_lens: "cycles", history_cycle_count: 10 });
  });

  it("resolves the exported version constant to 25", () => {
    expect(INTERACTION_HISTORY_SCHEMA_VERSION).toBe(25);
    expect(migration025.version).toBe(25);
  });
});

describe("migration 025 — source discipline (D-07/D-12, review cycle-2)", () => {
  const source = readFileSync(
    fileURLToPath(
      new URL("./025-interaction-history-schema.ts", import.meta.url),
    ),
    "utf8",
  );
  // Strip block + line comments — the doc comment legitimately explains WHY the
  // migration avoids these patterns, so grep the executable CODE only.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("contains no note rewrite, no table rebuild, and no group-event schema", () => {
    expect(code).not.toMatch(/SET\s+note/i);
    expect(code).not.toMatch(/DROP\s+TABLE/i);
    expect(code).not.toMatch(/group_event_id/i);
  });

  it("does not import or call the runtime remap helpers (frozen CASE literals only)", () => {
    expect(code).not.toMatch(/interaction-vocabulary/);
    expect(code).not.toMatch(/remapLegacyQuality|remapLegacyChannel/);
    // The frozen CASE literals are present in the migration file itself.
    expect(code).toMatch(/WHEN 'good' THEN 'Positive'/);
    expect(code).toMatch(/WHEN 'in-person' THEN 'In Person'/);
  });
});
