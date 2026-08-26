import { beforeEach, describe, expect, it } from "vitest";
import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-25 12:00:00";
let uid = 0;
const newUid = () => `uid-${++uid}`;
const migrations = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008];

async function db(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, migrations, 8, { now: NOW, newUid });
  return exec;
}

beforeEach(() => { uid = 0; });

describe("applyRestore", () => {
  it("reconciles all decisions before one transaction and UID-maps an incoming contact", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["incoming-contact", "Incoming", 14, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();

    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({
      status: "applied", inserted: 1,
    });
    await expect(destination.getFirstAsync<{ name: string; interval_days: number }>(
      "SELECT name, interval_days FROM contacts WHERE uid = ?", ["incoming-contact"],
    )).resolves.toEqual({ name: "Incoming", interval_days: 14 });
  });

  it("uses an FK-safe reset for replace-all before inserting the incoming graph", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["replacement", "Replacement", 21, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();
    await destination.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["old-local", "Old", 30, 0, 0, NOW, NOW],
    );

    await expect(applyRestore(destination, manifest, "replace-all")).resolves.toMatchObject({ status: "applied", mode: "replace-all" });
    await expect(destination.getAllAsync<{ uid: string }>("SELECT uid FROM contacts ORDER BY uid")).resolves.toEqual([{ uid: "replacement" }]);
    await expect(destination.getFirstAsync<{ entity_uid: string }>(
      "SELECT entity_uid FROM tombstones WHERE entity_type = 'contact' AND entity_uid = 'old-local'",
    )).resolves.toEqual({ entity_uid: "old-local" });
  });
});
