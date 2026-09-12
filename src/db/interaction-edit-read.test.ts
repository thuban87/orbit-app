import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { readInteractionForEdit } from "@/db/interaction-edit-read";
import { runMigrations } from "@/db/migrations/runner";
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
    });
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
