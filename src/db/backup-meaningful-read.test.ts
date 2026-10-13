import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { hasMeaningfulBackupData } from "@/db/backup-meaningful-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";
let exec: SqlExecutor;
let n = 0;
const uid = () => `uid-${++n}`;

beforeEach(async () => {
  n = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function contact(): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, 'Ada', 0, ?, ?)",
    [uid(), NOW, NOW],
  );
  return row.lastInsertRowId;
}

describe("hasMeaningfulBackupData", () => {
  it("is false on a fresh database", async () => {
    expect(await hasMeaningfulBackupData(exec)).toBe(false);
  });

  it("is true once a contact exists", async () => {
    await contact();
    expect(await hasMeaningfulBackupData(exec)).toBe(true);
  });

  it("counts an Off Limits row", async () => {
    // Foreign keys off so the row can stand alone: the check reads the table
    // itself, not the contact that owns it.
    const id = await contact();
    await exec.runAsync(
      "INSERT INTO off_limits (uid, contact_id, text, created_at, modified_at) VALUES (?, ?, 'Topic', ?, ?)",
      [uid(), id, NOW, NOW],
    );
    await exec.execAsync("PRAGMA foreign_keys = OFF");
    await exec.runAsync("DELETE FROM contacts");
    expect(await hasMeaningfulBackupData(exec)).toBe(true);
    await exec.runAsync("DELETE FROM off_limits");
    expect(await hasMeaningfulBackupData(exec)).toBe(false);
  });

  it("counts a named profile but not the empty default profile row", async () => {
    expect(await hasMeaningfulBackupData(exec)).toBe(false);
    await exec.runAsync("UPDATE profile SET name = 'Me'");
    expect(await hasMeaningfulBackupData(exec)).toBe(true);
  });
});
