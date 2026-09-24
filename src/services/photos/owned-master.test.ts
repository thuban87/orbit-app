import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakePhotoFs } from "./__testkit__/fake-photo-fs";

const h = vi.hoisted(() => ({
  fs: null as FakePhotoFs | null,
  failDelete: false,
}));
vi.mock("@/services/photos/photo-storage", () => ({
  persistMaster: (src: string, canonical: string) =>
    h.fs!.persist(src, canonical),
  deletePhoto: (path: string) => {
    if (!h.failDelete) h.fs!.files.delete(path);
  },
  photoFileExists: (path: string) => h.fs!.files.has(path),
  deleteRestorePending: (path: string) => {
    h.fs!.files.delete(path);
  },
  listRestorePendingPhotos: () => h.fs!.pending(),
  resolveRestorePendingUri: (path: string) => path,
  listCanonicalSidecarPaths: () =>
    [...h.fs!.files.keys()]
      .filter((p) => p.endsWith(".tmp") || p.endsWith(".bak"))
      .map((p) => p.slice(0, -4)),
  reconcilePhotoWritesForCanonical: async (path: string) => {
    h.fs!.reconcile(path);
  },
}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import {
  enqueueDeleteIntentCore,
  insertJournalEntryCore,
  listJournalEntriesCore,
} from "@/db/restore-photo-journal-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  canonicalGeneration,
  deleteStagedPhotosOwned,
  enqueueRemovalIntentOwned,
  executeDeleteIntentOwned,
  finalizeJournalEntryOwned,
  persistOwnedMaster,
  reconcilePhotoWritesOwned,
  removeOwnedMaster,
  settleCanonicalLocked,
  withCanonicalPathLock,
} from "./owned-master";

const canonical = "avatars/contact-7.jpg";
const pending = "avatars/_restore_pending/contact-u1-s1.jpg";
const entry = {
  relativePath: pending,
  action: "finalize" as const,
  targetKind: "contact" as const,
  contactUid: "u1",
  valueUid: null,
  fieldDefUid: null,
  canonicalRelativePath: canonical,
  createdAt: "2026-09-23 12:00:00",
};
let exec: SqlExecutor;
beforeEach(async () => {
  h.fs = new FakePhotoFs();
  h.failDelete = false;
  exec = nodeSqliteExecutor(openTestDb());
  await exec.execAsync(
    "CREATE TABLE contacts (id INTEGER PRIMARY KEY, uid TEXT, photo TEXT)",
  );
  await exec.execAsync(
    "CREATE TABLE profile (id INTEGER PRIMARY KEY, photo TEXT)",
  );
  await exec.execAsync(
    "CREATE TABLE custom_field_values (id INTEGER PRIMARY KEY, value TEXT, uid TEXT, contact_id INTEGER, field_def_id INTEGER)",
  );
  await exec.execAsync(
    "CREATE TABLE custom_field_defs (id INTEGER PRIMARY KEY, uid TEXT, type TEXT)",
  );
  await migration008.apply(exec, {
    now: entry.createdAt,
    newUid: () => "unused",
  });
  await exec.runAsync(
    "INSERT INTO contacts (id, uid, photo) VALUES (7, 'u1', ?)",
    [canonical],
  );
});

async function stage(): Promise<void> {
  h.fs!.files.set(pending, "recovered");
  await inWriteTransaction(exec, () => insertJournalEntryCore(exec, entry));
}

describe("owned canonical master", () => {
  it("settles a stale restore before the new crop and leaves no retry row", async () => {
    await stage();
    h.fs!.files.set(canonical, "prior");
    h.fs!.files.set("new", "newer");
    const before = canonicalGeneration(canonical);
    await persistOwnedMaster(exec, "new", canonical);
    expect(h.fs!.files.get(canonical)).toBe("newer");
    expect(h.fs!.writes).toEqual([canonical, canonical]);
    expect(await listJournalEntriesCore(exec)).toEqual([]);
    expect(canonicalGeneration(canonical)).toBe(before + 1);
  });
  it("rejects a nested owner acquisition and permits the lock-held operation", async () => {
    await stage();
    await withCanonicalPathLock(canonical, async (token) => {
      await expect(finalizeJournalEntryOwned(exec, entry)).rejects.toThrow(
        "reentrant canonical lock",
      );
      await settleCanonicalLocked(exec, token, canonical);
    });
    expect(await listJournalEntriesCore(exec)).toEqual([]);
  });
  it("retires an older pre-upgrade finalize before applying the later row", async () => {
    await stage();
    const later = {
      ...entry,
      relativePath: "avatars/_restore_pending/contact-u1-s2.jpg",
    };
    h.fs!.files.set(later.relativePath, "later");
    await inWriteTransaction(exec, () => insertJournalEntryCore(exec, later));
    await finalizeJournalEntryOwned(exec, later);
    expect(h.fs!.files.get(canonical)).toBe("later");
    expect(h.fs!.writes).toEqual([canonical]);
    expect(await listJournalEntriesCore(exec)).toEqual([]);
  });

  it("leaves the journal and prior canonical untouched when settle fails", async () => {
    await stage();
    h.fs!.files.set(canonical, "prior");
    h.fs!.barrier = async () => {
      throw new Error("disk failure");
    };
    await expect(persistOwnedMaster(exec, "new", canonical)).rejects.toThrow();
    expect(h.fs!.files.get(canonical)).toBe("prior");
    expect(await listJournalEntriesCore(exec)).toHaveLength(1);
  });

  it.each(["tmp", "bak", "replace"] as const)(
    "recovers a killed writer at %s without replaying stale recovery",
    async (kill) => {
      await stage();
      h.fs!.files.set(canonical, "prior");
      h.fs!.files.set("new", "newer");
      // The first persist belongs to settle. The kill hook is installed only for
      // the writer after settlement so it models a post-settle process death.
      await withCanonicalPathLock(canonical, async (token) => {
        await settleCanonicalLocked(exec, token, canonical);
        h.fs!.barrier = async (stage) => {
          if (stage === kill) throw new Error("process killed");
        };
        await expect(h.fs!.persist("new", canonical)).rejects.toThrow();
      });
      h.fs!.barrier = undefined;
      h.fs!.reconcile(canonical);
      expect(h.fs!.files.get(canonical)).toBe(
        kill === "replace" ? "newer" : "recovered",
      );
      expect(await listJournalEntriesCore(exec)).toEqual([]);
    },
  );

  it("retains failed delete evidence and protects a live reference", async () => {
    h.fs!.files.set(canonical, "live");
    await inWriteTransaction(exec, () =>
      enqueueDeleteIntentCore(exec, canonical),
    );
    await executeDeleteIntentOwned(exec, canonical);
    expect(h.fs!.files.get(canonical)).toBe("live");
    expect(await listJournalEntriesCore(exec)).toEqual([]);
  });
  it("refuses a crop after integer-id reuse without touching the replacement contact", async () => {
    await exec.runAsync("DELETE FROM contacts WHERE id = 7");
    await exec.runAsync(
      "INSERT INTO contacts (id, uid, photo) VALUES (7, 'u2', NULL)",
    );
    h.fs!.files.set(canonical, "replacement");
    await expect(
      persistOwnedMaster(exec, "new", canonical, {
        authorize: async (db) =>
          (await db.getFirstAsync(
            "SELECT 1 FROM contacts WHERE id = 7 AND uid = 'u1'",
          )) !== null,
      }),
    ).rejects.toThrow("photo target changed");
    expect(h.fs!.files.get(canonical)).toBe("replacement");
  });
  it("commits the reference clear and intent before a failed file deletion", async () => {
    h.fs!.files.set(canonical, "prior");
    await stage();
    h.failDelete = true;
    await expect(
      removeOwnedMaster(exec, canonical, {
        clearReferenceCore: async (db) => {
          await db.runAsync("UPDATE contacts SET photo = NULL WHERE id = 7");
        },
      }),
    ).rejects.toThrow("needs retry");
    expect(
      await exec.getFirstAsync<{ photo: string | null }>(
        "SELECT photo FROM contacts WHERE id = 7",
      ),
    ).toEqual({ photo: null });
    expect(
      (await listJournalEntriesCore(exec)).map((row) => row.relativePath),
    ).toEqual([`delete:${canonical}`]);
    h.failDelete = false;
    await executeDeleteIntentOwned(exec, canonical);
    expect(h.fs!.files.has(canonical)).toBe(false);
    expect(await listJournalEntriesCore(exec)).toEqual([]);
  });
  it.each(["tmp", "bak", "replace"] as const)(
    "serializes sidecar reconciliation at %s",
    async (pause) => {
      h.fs!.files.set(canonical, "prior");
      h.fs!.files.set("new", "newer");
      let release!: () => void;
      let reached!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const atStage = new Promise<void>((resolve) => {
        reached = resolve;
      });
      h.fs!.barrier = async (stage) => {
        if (stage === pause) {
          reached();
          await blocked;
        }
      };
      const writer = persistOwnedMaster(exec, "new", canonical);
      await atStage;
      const reconcile = reconcilePhotoWritesOwned();
      release();
      await writer;
      await reconcile;
      expect(h.fs!.files.get(canonical)).toBe("newer");
      expect(h.fs!.files.has(`${canonical}.tmp`)).toBe(false);
      expect(h.fs!.files.has(`${canonical}.bak`)).toBe(false);
    },
  );
  it("keeps a custom-field photo on Cancel and deletes it after Save clears the value", async () => {
    const path = "avatars/cv-7-pet_photo.jpg";
    await exec.runAsync(
      "INSERT INTO custom_field_values (id, value) VALUES (1, ?)",
      [path],
    );
    h.fs!.files.set(path, "pet");
    await enqueueRemovalIntentOwned(exec, path);
    expect(h.fs!.files.get(path)).toBe("pet");
    expect(
      (await listJournalEntriesCore(exec)).map((row) => row.relativePath),
    ).toEqual([`delete:${path}`]);
    await executeDeleteIntentOwned(exec, path); // Cancel: committed value remains.
    expect(h.fs!.files.get(path)).toBe("pet");
    expect(await listJournalEntriesCore(exec)).toEqual([]);
    await enqueueRemovalIntentOwned(exec, path);
    await exec.runAsync(
      "UPDATE custom_field_values SET value = NULL WHERE id = 1",
    );
    await executeDeleteIntentOwned(exec, path); // Save: reference is gone.
    expect(h.fs!.files.has(path)).toBe(false);
    expect(await listJournalEntriesCore(exec)).toEqual([]);
  });
  it("checks the database again when staged cleanup races a committed value", async () => {
    const kept = "avatars/cv-7-kept.jpg";
    const orphan = "avatars/cv-7-orphan.jpg";
    await exec.runAsync("INSERT INTO custom_field_values (value) VALUES (?)", [
      kept,
    ]);
    h.fs!.files.set(kept, "committed");
    h.fs!.files.set(orphan, "orphan");
    await deleteStagedPhotosOwned(exec, [kept, orphan]);
    expect(h.fs!.files.get(kept)).toBe("committed");
    expect(h.fs!.files.has(orphan)).toBe(false);
    expect(await listJournalEntriesCore(exec)).toEqual([]);
  });
});
