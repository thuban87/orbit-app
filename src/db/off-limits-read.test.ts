import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { listOffLimitsForContact } from "@/db/off-limits-read";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";
let exec: SqlExecutor;
let counter = 0;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-uid-${++counter}`,
  });
});

async function seedContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, 30, ?, ?)`,
    [`contact-${++counter}`, name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedRow(
  contactId: number,
  uid: string,
  createdAt: string,
  values: { label?: string | null; text?: string | null; url?: string | null },
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO off_limits (uid, contact_id, label, text, url, group_note_copy,
                             from_share, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      uid,
      contactId,
      values.label ?? null,
      values.text ?? null,
      values.url ?? null,
      uid === "share" ? 1 : 0,
      createdAt,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

describe("listOffLimitsForContact", () => {
  it("returns [] for a contact with none", async () => {
    const alex = await seedContact("Alex");
    expect(await listOffLimitsForContact(exec, alex)).toEqual([]);
  });

  it("returns only this contact's rows, newest first with an id tiebreak, markers included", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const older = await seedRow(alex, "old", "2026-10-01 08:00:00", {
      text: "Old",
    });
    const tieA = await seedRow(alex, "tie-a", "2026-10-02 08:00:00", {
      text: "Tie A",
    });
    const tieB = await seedRow(alex, "share", "2026-10-02 08:00:00", {
      label: "Tie B",
    });
    await seedRow(blair, "blair", "2026-10-03 08:00:00", { text: "Blair" });

    const rows = await listOffLimitsForContact(exec, alex);
    expect(rows.map((row) => row.id)).toEqual([tieB, tieA, older]);
    expect(rows[0]).toEqual({
      id: tieB,
      uid: "share",
      contact_id: alex,
      label: "Tie B",
      text: null,
      url: null,
      group_note_copy: 0,
      from_share: 1,
      created_at: "2026-10-02 08:00:00",
      modified_at: NOW,
    });
  });

  it("accepts a legacy contentless row (D-97)", async () => {
    const alex = await seedContact("Alex");
    const id = await seedRow(alex, "empty", "2026-10-01 08:00:00", {});
    expect(await listOffLimitsForContact(exec, alex)).toEqual([
      expect.objectContaining({ id, label: null, text: null, url: null }),
    ]);
  });
});
