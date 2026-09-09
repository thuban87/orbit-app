import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  PROFILE_HISTORY_MODULE_ID,
  readProfileHistory,
} from "@/db/profile-history-read";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-09 12:00:00";
let exec: SqlExecutor;
let sequence = 0;
const uid = () => `profile-history-${++sequence}`;

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
  occurredAt: string,
  note = "private long-form note",
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, direction,
        connected, quality, note, source, modified_at)
     VALUES (?, ?, ?, ?, 'call', 'outbound', 1, 'good', ?, 'manual', ?)`,
    [uid(), contactId, occurredAt, NOW, note, NOW],
  );
  return result.lastInsertRowId;
}

function readOnly(): ReadOnlyExecutor {
  return {
    getFirstAsync: exec.getFirstAsync.bind(exec),
    getAllAsync: exec.getAllAsync.bind(exec),
  };
}

describe("bounded interim Profile history", () => {
  it("returns a useful empty summary and stable route identity", async () => {
    const contactId = await contact();
    expect(await readProfileHistory(readOnly(), contactId)).toEqual({
      moduleId: "interaction-history",
      summary: { kind: "empty", text: "No interactions yet" },
      entries: [],
      viewAll: { moduleId: "interaction-history", contactId },
    });
    expect(PROFILE_HISTORY_MODULE_ID).toBe("interaction-history");
  });

  it("returns one compact latest entry without full note text", async () => {
    const contactId = await contact();
    const id = await interaction(contactId, "2026-09-01 09:00:00");
    const result = await readProfileHistory(readOnly(), contactId);
    expect(result.summary).toEqual({
      kind: "latest",
      lastContact: "2026-09-01 09:00:00",
      text: "Last interaction 2026-09-01 09:00:00",
    });
    expect(result.entries).toEqual([
      {
        id,
        occurredAt: "2026-09-01 09:00:00",
        channel: "call",
        direction: "outbound",
        connected: 1,
        quality: "good",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private long-form note");
  });

  it("hard-caps at three and breaks timestamp ties by id descending", async () => {
    const contactId = await contact();
    await interaction(contactId, "2026-08-01 09:00:00");
    const firstTie = await interaction(contactId, "2026-09-01 09:00:00");
    const secondTie = await interaction(contactId, "2026-09-01 09:00:00");
    const latest = await interaction(contactId, "2026-09-02 09:00:00");
    await interaction(await contact("Other"), "2026-09-03 09:00:00");

    const result = await readProfileHistory(readOnly(), contactId);
    expect(result.entries.map((entry) => entry.id)).toEqual([
      latest,
      secondTie,
      firstTie,
    ]);
    expect(result.entries).toHaveLength(3);
  });
});
