import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";

function createExecutor(): SqlExecutor {
  return nodeSqliteExecutor(openTestDb());
}

async function migrateTo16(exec: SqlExecutor): Promise<void> {
  let counter = 0;
  await runMigrations(exec, MIGRATIONS, 16, {
    now: NOW,
    newUid: () => `migration-uid-${++counter}`,
  });
}

async function seedContact(exec: SqlExecutor): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["alex", "Alex", 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedFuel(
  exec: SqlExecutor,
  input: { uid: string; contactId: number; kind: string; text: string; source: string },
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO fuel (uid, contact_id, kind, text, url, created_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.contactId,
      input.kind,
      input.text,
      `https://example.test/${input.uid}`,
      "2026-08-01 09:00:00",
      input.source,
      NOW,
    ],
  );
}

describe("migration 017 — knowledge egress data move", () => {
  it("copies each retired fuel row before removal and defaults every Memory to AI-off", async () => {
    const exec = createExecutor();
    await migrateTo16(exec);
    const contactId = await seedContact(exec);
    const shareRows = [
      { uid: "share-one", text: "Brings climbing shoes" },
      { uid: "share-two", text: "Prefers tea" },
    ];
    for (const row of shareRows) {
      await seedFuel(exec, { ...row, contactId, kind: "topic", source: "share" });
    }
    await seedFuel(exec, {
      uid: "ordinary-fuel",
      contactId,
      kind: "topic",
      text: "Remain as ordinary fuel",
      source: "user",
    });
    await seedFuel(exec, {
      uid: "ai-proposal",
      contactId,
      kind: "fact",
      text: "AI proposal survives",
      source: "ai",
    });
    await seedFuel(exec, {
      uid: "ai-off-limits",
      contactId,
      kind: "off_limits",
      text: "AI off-limits proposal survives AI-off",
      source: "ai",
    });

    let counter = 100;
    await runMigrations(exec, MIGRATIONS, 17, {
      now: NOW,
      newUid: () => `migrated-${++counter}`,
    });

    const info = await exec.getAllAsync<{
      name: string;
      notnull: number;
      dflt_value: string | null;
    }>("PRAGMA table_info(memories)");
    expect(info).toContainEqual(
      expect.objectContaining({ name: "allow_ai", notnull: 1, dflt_value: "0" }),
    );

    const memories = await exec.getAllAsync<{
      value: string | null;
      provenance: string;
      allow_ai: number;
    }>(
      "SELECT value, provenance, allow_ai FROM memories WHERE contact_id = ? ORDER BY value",
      [contactId],
    );
    expect(memories).toHaveLength(4);
    expect(memories.filter((row) => row.provenance === "share").map((row) => row.value).sort()).toEqual(
      shareRows.map((row) => row.text).sort(),
    );
    expect(memories).toEqual(
      expect.arrayContaining([
        { value: "AI proposal survives", provenance: "user", allow_ai: 0 },
        {
          value: "AI off-limits proposal survives AI-off",
          provenance: "user",
          allow_ai: 0,
        },
      ]),
    );
    expect(memories.every((row) => row.allow_ai === 0)).toBe(true);

    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM fuel WHERE kind = ? AND source = ?",
        ["topic", "share"],
      ),
    ).toEqual({ count: 0 });
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM fuel WHERE source = ?",
        ["ai"],
      ),
    ).toEqual({ count: 0 });
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM fuel WHERE uid = ?",
        ["ordinary-fuel"],
      ),
    ).toEqual({ count: 1 });

    const defaultMemory = await exec.runAsync(
      `INSERT INTO memories (uid, contact_id, type, value, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["default-off", contactId, "general", "New default", NOW, NOW],
    );
    expect(
      await exec.getFirstAsync<{ allow_ai: number }>(
        "SELECT allow_ai FROM memories WHERE id = ?",
        [defaultMemory.lastInsertRowId],
      ),
    ).toEqual({ allow_ai: 0 });
  });
});
