import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakePhotoFs } from "./__testkit__/fake-photo-fs";

const h = vi.hoisted(() => ({
  fs: null as FakePhotoFs | null,
  failDelete: false,
}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", () => ({
  persistMaster: (source: string, target: string) =>
    h.fs!.persist(source, target),
  deletePhoto: (path: string) => {
    if (!h.failDelete) h.fs!.files.delete(path);
  },
  photoFileExists: (path: string) => h.fs!.files.has(path),
  deleteRestorePending: (path: string) => {
    h.fs!.files.delete(path);
  },
  listRestorePendingPhotos: () => h.fs!.pending(),
  resolveRestorePendingUri: (path: string) => path,
}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { purgeContact } from "@/db/purge-dao";
import { listJournalEntriesCore } from "@/db/restore-photo-journal-dao";
import type { SqlExecutor } from "@/db/types";
import { buildPhotoPurgeCleanup } from "./purge-photo-cleanup";
import { drainRestorePhotoJournal } from "./restore-photo-finalize-sweep";

const NOW = "2026-09-23 12:00:00";
let exec: SqlExecutor;
let count = 0;
const uid = () => `purge-${++count}`;
beforeEach(async () => {
  count = 0;
  h.fs = new FakePhotoFs();
  h.failDelete = false;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});
async function seed(): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, archived_at, created_at, modified_at) VALUES (?, 'Purge', 0, ?, ?, ?)",
    [uid(), NOW, NOW, NOW],
  );
  return row.lastInsertRowId;
}
async function def(col: string, type: string): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    [uid(), col, col, type, NOW, NOW],
  );
  return row.lastInsertRowId;
}

describe("durable purge photo cleanup", () => {
  it("deletes main and cv files for photo, type-changed text and quarantined definitions", async () => {
    const id = await seed();
    for (const [col, type] of [
      ["headshot", "photo"],
      ["old_photo", "text"],
      ["quarantined", "photo"],
    ]) {
      await def(col, type);
      h.fs!.files.set(`avatars/cv-${id}-${col}.jpg`, col);
    }
    await exec.runAsync(
      "UPDATE custom_field_defs SET quarantined_at = ? WHERE col_name = 'quarantined'",
      [NOW],
    );
    const main = `avatars/contact-${id}.jpg`;
    h.fs!.files.set(main, "main");
    await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
      main,
      id,
    ]);
    await purgeContact(exec, id, {
      now: NOW,
      onPurgeExtensions: buildPhotoPurgeCleanup(exec),
    });
    expect([...h.fs!.files.keys()]).toEqual([]);
    expect(await listJournalEntriesCore(exec)).toEqual([]);
  });

  it("retains a shared reference and retries failed deletion on the foreground drain", async () => {
    const id = await seed();
    const other = await exec.runAsync(
      "INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, 'Other', 0, ?, ?)",
      [uid(), NOW, NOW],
    );
    const shared = `avatars/contact-${id}.jpg`;
    h.fs!.files.set(shared, "shared");
    await exec.runAsync("UPDATE contacts SET photo = ? WHERE id IN (?, ?)", [
      shared,
      id,
      other.lastInsertRowId,
    ]);
    await purgeContact(exec, id, {
      now: NOW,
      onPurgeExtensions: buildPhotoPurgeCleanup(exec),
    });
    expect(h.fs!.files.get(shared)).toBe("shared");

    const second = await seed();
    const path = `avatars/contact-${second}.jpg`;
    h.fs!.files.set(path, "retry");
    h.failDelete = true;
    await purgeContact(exec, second, {
      now: NOW,
      onPurgeExtensions: buildPhotoPurgeCleanup(exec),
    });
    expect(
      (await listJournalEntriesCore(exec)).some(
        (entry) => entry.canonicalRelativePath === path,
      ),
    ).toBe(true);
    h.failDelete = false;
    await drainRestorePhotoJournal(exec);
    expect(h.fs!.files.has(path)).toBe(false);
  });
});
