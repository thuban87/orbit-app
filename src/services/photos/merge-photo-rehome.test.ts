import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakePhotoFs } from "./__testkit__/fake-photo-fs";

const h = vi.hoisted(() => ({
  fs: null as FakePhotoFs | null,
  failDelete: false,
  afterStage: null as null | (() => Promise<void>),
}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", () => ({
  persistMaster: (source: string, target: string) =>
    h.fs!.persist(source, target),
  stageRestorePending: async (source: string, target: string) => {
    h.fs!.files.set(target, h.fs!.files.get(source) ?? "");
    await h.afterStage?.();
  },
  resolvePhotoUri: (path: string) => path,
  resolveRestorePendingUri: (path: string) => path,
  photoFileExists: (path: string) => h.fs!.files.has(path),
  deletePhoto: (path: string) => {
    if (h.failDelete) throw new Error("delete failed");
    h.fs!.files.delete(path);
  },
  deleteRestorePending: (path: string) => {
    h.fs!.files.delete(path);
  },
  listRestorePendingPhotos: () => h.fs!.pending(),
}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  insertFinalizeEntryCore,
  listJournalEntriesCore,
} from "@/db/restore-photo-journal-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { mergeContactsWithPhotoOwnership } from "./merge-photo-rehome";
import { persistOwnedMaster } from "./owned-master";
import { drainRestorePhotoJournal } from "./restore-photo-finalize-sweep";

const NOW = "2026-09-23 12:00:00";
let exec: SqlExecutor;
let counter = 0;
const uid = () => `test-${++counter}`;
async function contact(
  name: string,
  photo = false,
): Promise<{ id: number; uid: string; path: string }> {
  const identity = uid();
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, ?, 0, ?, ?)",
    [identity, name, NOW, NOW],
  );
  const id = result.lastInsertRowId;
  const path = `avatars/contact-${id}.jpg`;
  if (photo) {
    await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
      path,
      id,
    ]);
    h.fs!.files.set(path, name);
  }
  return { id, uid: identity, path };
}
beforeEach(async () => {
  h.fs = new FakePhotoFs();
  h.failDelete = false;
  h.afterStage = null;
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

describe("merge photo ownership", () => {
  it("adopts sole absorbed bytes at the survivor path, then reused id cannot overwrite them", async () => {
    const s = await contact("Survivor");
    const a = await contact("Absorbed", true);
    await mergeContactsWithPhotoOwnership(exec, {
      survivorId: s.id,
      absorbedId: a.id,
      now: NOW,
    });
    expect(
      (
        await exec.getFirstAsync<{ photo: string }>(
          "SELECT photo FROM contacts WHERE id = ?",
          [s.id],
        )
      )?.photo,
    ).toBe(s.path);
    expect(h.fs!.files.get(s.path)).toBe("Absorbed");
    expect(h.fs!.files.has(a.path)).toBe(false);
    const reused = await contact("New", true);
    expect(reused.id).toBe(a.id);
    h.fs!.files.set(reused.path, "New crop");
    expect(h.fs!.files.get(s.path)).toBe("Absorbed");
  });

  it("takes an explicit absorbed photo and derives the path despite a crafted relative value", async () => {
    const s = await contact("Survivor", true);
    const a = await contact("Absorbed", true);
    await mergeContactsWithPhotoOwnership(exec, {
      survivorId: s.id,
      absorbedId: a.id,
      now: NOW,
      resolutions: {
        photo: { choice: "absorbed", relative: "avatars/contact-999.jpg" },
      } as never,
    });
    expect(h.fs!.files.get(s.path)).toBe("Absorbed");
    expect(
      (
        await exec.getFirstAsync<{ photo: string }>(
          "SELECT photo FROM contacts WHERE id = ?",
          [s.id],
        )
      )?.photo,
    ).toBe(s.path);
  });

  it("re-homes chosen custom photo bytes and retains the survivor pair identity", async () => {
    const s = await contact("Survivor");
    const a = await contact("Absorbed");
    const def = await exec.runAsync(
      "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, 'portrait', 'Portrait', 'photo', 0, ?, ?)",
      [uid(), NOW, NOW],
    );
    const ownUid = uid();
    const source = `avatars/cv-${a.id}-portrait.jpg`;
    const destination = `avatars/cv-${s.id}-portrait.jpg`;
    await exec.runAsync(
      "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)",
      [
        ownUid,
        s.id,
        def.lastInsertRowId,
        null,
        NOW,
        NOW,
        uid(),
        a.id,
        def.lastInsertRowId,
        source,
        NOW,
        NOW,
      ],
    );
    h.fs!.files.set(source, "Portrait bytes");
    await mergeContactsWithPhotoOwnership(exec, {
      survivorId: s.id,
      absorbedId: a.id,
      now: NOW,
    });
    expect(
      await exec.getFirstAsync<{ uid: string; value: string }>(
        "SELECT uid, value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [s.id, def.lastInsertRowId],
      ),
    ).toEqual({ uid: ownUid, value: destination });
    expect(h.fs!.files.get(destination)).toBe("Portrait bytes");
    expect(h.fs!.files.has(source)).toBe(false);
  });

  it("contains a post-replacement crash and drain replays the same bytes", async () => {
    const s = await contact("Survivor");
    const a = await contact("Absorbed", true);
    h.fs!.barrier = async (point, path) => {
      if (point === "replace" && path === s.path) throw new Error("kill point");
    };
    const result = await mergeContactsWithPhotoOwnership(exec, {
      survivorId: s.id,
      absorbedId: a.id,
      now: NOW,
    });
    expect(result.recoveryPending).toBe(true);
    expect(h.fs!.files.get(s.path)).toBe("Absorbed");
    expect(await listJournalEntriesCore(exec)).toHaveLength(1);
    h.fs!.barrier = undefined;
    await drainRestorePhotoJournal(exec);
    expect(h.fs!.files.get(s.path)).toBe("Absorbed");
    expect(await listJournalEntriesCore(exec)).toEqual([]);
  });

  it("settles a failed absorbed finalize before staging its bytes", async () => {
    const s = await contact("Survivor");
    const a = await contact("Absorbed", true);
    const pending = `avatars/_restore_pending/contact-${a.uid}-old.jpg`;
    h.fs!.files.set(pending, "Recovered");
    await inWriteTransaction(exec, () =>
      insertFinalizeEntryCore(exec, {
        relativePath: pending,
        action: "finalize",
        targetKind: "contact",
        contactUid: a.uid,
        valueUid: null,
        fieldDefUid: null,
        canonicalRelativePath: a.path,
        createdAt: NOW,
      }),
    );
    await mergeContactsWithPhotoOwnership(exec, {
      survivorId: s.id,
      absorbedId: a.id,
      now: NOW,
    });
    expect(h.fs!.files.get(s.path)).toBe("Recovered");
  });

  it("rejects sole-photo adoption when the survivor gains a reference before commit", async () => {
    const s = await contact("Survivor");
    const a = await contact("Absorbed", true);
    h.afterStage = async () => {
      await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
        s.path,
        s.id,
      ]);
    };
    await expect(
      mergeContactsWithPhotoOwnership(exec, {
        survivorId: s.id,
        absorbedId: a.id,
        now: NOW,
      }),
    ).rejects.toThrow("main photo changed");
    expect(
      await exec.getFirstAsync("SELECT id FROM contacts WHERE id = ?", [a.id]),
    ).not.toBeNull();
    expect(h.fs!.files.has(s.path)).toBe(false);
  });

  it("a failed post-commit absorbed delete resolves and the drain retries it", async () => {
    const s = await contact("Survivor");
    const a = await contact("Absorbed", true);
    h.failDelete = true;
    expect(
      (
        await mergeContactsWithPhotoOwnership(exec, {
          survivorId: s.id,
          absorbedId: a.id,
          now: NOW,
        })
      ).recoveryPending,
    ).toBe(true);
    expect(h.fs!.files.get(s.path)).toBe("Absorbed");
    expect(
      (await listJournalEntriesCore(exec)).some(
        (row) => row.action === "delete",
      ),
    ).toBe(true);
    h.failDelete = false;
    await drainRestorePhotoJournal(exec);
    expect(h.fs!.files.has(a.path)).toBe(false);
  });

  it("a crop requested during staging waits and is refused after merge", async () => {
    const s = await contact("Survivor");
    const a = await contact("Absorbed", true);
    let release!: () => void;
    let staged!: () => void;
    const entered = new Promise<void>((resolve) => {
      staged = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    h.fs!.barrier = async (point, path) => {
      if (point === "tmp" && path === s.path) {
        staged();
        await hold;
      }
    };
    const merging = mergeContactsWithPhotoOwnership(exec, {
      survivorId: s.id,
      absorbedId: a.id,
      now: NOW,
    });
    await entered;
    h.fs!.files.set("crop", "New crop");
    const crop = persistOwnedMaster(exec, "crop", a.path, {
      authorize: async (db) =>
        !!(await db.getFirstAsync(
          "SELECT 1 FROM contacts WHERE id = ? AND uid = ?",
          [a.id, a.uid],
        )),
    });
    release();
    await merging;
    await expect(crop).rejects.toThrow();
    expect(h.fs!.files.get(s.path)).toBe("Absorbed");
    expect(h.fs!.files.has(a.path)).toBe(false);
  });
});
