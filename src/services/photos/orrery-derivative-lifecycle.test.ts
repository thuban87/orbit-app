/**
 * 38.6 D-41 privacy: the Orrery's cache-dir derivative of a photo goes with the
 * photo's bytes on EVERY ownership-layer path that replaces or deletes them —
 * replace (crop / picker), remove, owned delete intents, contact purge,
 * custom-field definition delete, merge clean-up, restore finalize and the
 * `.bak` reconcile — and survives when the bytes do (a retained shared photo).
 * Real migrations + journal over node SQLite; the canonical files are a byte
 * fake and the derivative store is a set of canonicals that have a derivative.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakePhotoFs } from "./__testkit__/fake-photo-fs";

const h = vi.hoisted(() => ({
  fs: null as FakePhotoFs | null,
  /** Canonicals with an Orrery derivative in the cache dir. */
  derivatives: new Set<string>(),
  order: [] as string[],
}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", () => ({
  persistMaster: (source: string, target: string) =>
    h.fs!.persist(source, target),
  stageRestorePending: async (source: string, target: string) => {
    h.fs!.files.set(target, h.fs!.files.get(source) ?? "");
  },
  resolvePhotoUri: (path: string) => path,
  resolveRestorePendingUri: (path: string) => path,
  photoFileExists: (path: string) => h.fs!.files.has(path),
  deletePhoto: (path: string) => {
    h.fs!.files.delete(path);
  },
  deleteRestorePending: (path: string) => {
    h.fs!.files.delete(path);
  },
  listRestorePendingPhotos: () => h.fs!.pending(),
  listCanonicalSidecarPaths: () =>
    [...h.fs!.files.keys()]
      .filter((p) => p.endsWith(".tmp") || p.endsWith(".bak"))
      .map((p) => p.slice(0, -4)),
  reconcilePhotoWritesForCanonical: async (path: string) => {
    h.fs!.reconcile(path);
  },
}));
vi.mock("./orrery-derivative-store", () => ({
  discardOrreryDerivatives: (relative: string) => {
    h.order.push(`discard ${relative}`);
    h.derivatives.delete(relative);
    return true;
  },
}));
vi.mock("@/stores/photo-cache-bust-store", async (original) => {
  const actual =
    await original<typeof import("@/stores/photo-cache-bust-store")>();
  return {
    ...actual,
    bumpPhotoCacheBust: (relative: string) => {
      h.order.push(`bump ${relative}`);
      actual.bumpPhotoCacheBust(relative);
    },
  };
});

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { dropField } from "@/db/field-ddl";
import { runMigrations } from "@/db/migrations/runner";
import { purgeContact } from "@/db/purge-dao";
import { insertJournalEntryCore } from "@/db/restore-photo-journal-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { mergeContactsWithPhotoOwnership } from "./merge-photo-rehome";
import {
  deleteStagedPhotosOwned,
  executeDeleteIntentOwned,
  finalizeJournalEntryOwned,
  notifyPhotoBytesChanged,
  persistOwnedMaster,
  reconcilePhotoWritesOwned,
  removeOwnedMaster,
} from "./owned-master";
import { buildPhotoPurgeCleanup } from "./purge-photo-cleanup";
import { drainRestorePhotoJournal } from "./restore-photo-finalize-sweep";

const NOW = "2026-09-30 12:00:00";
let exec: SqlExecutor;
let counter = 0;
const uid = () => `life-${++counter}`;

beforeEach(async () => {
  h.fs = new FakePhotoFs();
  h.derivatives.clear();
  h.order.length = 0;
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

/** A contact whose photo exists on disk AND has an Orrery derivative. */
async function contact(
  name: string,
  opts: { photo?: boolean; archived?: boolean } = {},
): Promise<{ id: number; uid: string; path: string }> {
  const identity = uid();
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, archived_at, created_at, modified_at) VALUES (?, ?, 0, ?, ?, ?)",
    [identity, name, opts.archived ? NOW : null, NOW, NOW],
  );
  const id = result.lastInsertRowId;
  const path = `avatars/contact-${id}.jpg`;
  if (opts.photo) {
    await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
      path,
      id,
    ]);
    h.fs!.files.set(path, name);
    h.derivatives.add(path);
  }
  return { id, uid: identity, path };
}

async function photoField(
  contactId: number,
  col: string,
): Promise<{ defId: number; path: string }> {
  const def = await exec.runAsync(
    "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, ?, ?, 'photo', 0, ?, ?)",
    [uid(), col, col, NOW, NOW],
  );
  const path = `avatars/cv-${contactId}-${col}.jpg`;
  await exec.runAsync(
    "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
    [uid(), contactId, def.lastInsertRowId, path, NOW, NOW],
  );
  h.fs!.files.set(path, col);
  h.derivatives.add(path);
  return { defId: def.lastInsertRowId, path };
}

describe("Orrery derivatives follow the photo bytes (38.6 D-41)", () => {
  it("notify discards the derivative BEFORE publishing the display revision", () => {
    notifyPhotoBytesChanged("avatars/contact-1.jpg");
    expect(h.order).toEqual([
      "discard avatars/contact-1.jpg",
      "bump avatars/contact-1.jpg",
    ]);
  });

  it("replace: a new crop / picked photo discards the old bytes' derivative", async () => {
    const c = await contact("Ada", { photo: true });
    h.fs!.files.set("cache://new", "new crop");
    await persistOwnedMaster(exec, "cache://new", c.path);
    expect(h.fs!.files.get(c.path)).toBe("new crop");
    expect(h.derivatives.has(c.path)).toBe(false);
  });

  it("remove: clearing a photo in the editor deletes the bytes and the derivative", async () => {
    const c = await contact("Ada", { photo: true });
    await removeOwnedMaster(exec, c.path, {
      clearReferenceCore: async (tx) => {
        await tx.runAsync("UPDATE contacts SET photo = NULL WHERE id = ?", [
          c.id,
        ]);
      },
    });
    expect(h.fs!.files.has(c.path)).toBe(false);
    expect(h.derivatives.has(c.path)).toBe(false);
  });

  it("owned delete intents (Edit Contact orphans, staged photos) delete the derivative", async () => {
    const a = await contact("A", { photo: true });
    await exec.runAsync("UPDATE contacts SET photo = NULL WHERE id = ?", [
      a.id,
    ]);
    await deleteStagedPhotosOwned(exec, [a.path]);
    expect(h.fs!.files.has(a.path)).toBe(false);
    expect(h.derivatives.has(a.path)).toBe(false);

    const b = await contact("B", { photo: true });
    await exec.runAsync("UPDATE contacts SET photo = NULL WHERE id = ?", [
      b.id,
    ]);
    await inWriteTransaction(exec, () =>
      exec.runAsync(
        "INSERT INTO restore_photo_journal (relative_path, action, target_kind, canonical_relative_path, created_at) VALUES (?, 'delete', 'contact', ?, ?)",
        [`delete:${b.path}`, b.path, NOW],
      ),
    );
    await executeDeleteIntentOwned(exec, b.path);
    expect(h.derivatives.has(b.path)).toBe(false);
  });

  it("purge: a permanently deleted contact's main and custom-field derivatives are gone", async () => {
    const c = await contact("Gone", { photo: true, archived: true });
    const field = await photoField(c.id, "headshot");
    await purgeContact(exec, c.id, {
      now: NOW,
      onPurgeExtensions: buildPhotoPurgeCleanup(exec),
    });
    expect([...h.fs!.files.keys()]).toEqual([]);
    expect(h.derivatives.has(c.path)).toBe(false);
    expect(h.derivatives.has(field.path)).toBe(false);
  });

  it("a photo still referenced elsewhere keeps its bytes AND its derivative", async () => {
    const c = await contact("Gone", { photo: true, archived: true });
    const other = await contact("Other");
    await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
      c.path,
      other.id,
    ]);
    await purgeContact(exec, c.id, {
      now: NOW,
      onPurgeExtensions: buildPhotoPurgeCleanup(exec),
    });
    expect(h.fs!.files.has(c.path)).toBe(true);
    expect(h.derivatives.has(c.path)).toBe(true);
  });

  it("definition delete: the drained delete intents remove every value's derivative", async () => {
    const one = await contact("One");
    const two = await contact("Two");
    const a = await photoField(one.id, "pet_photo");
    const defId = a.defId;
    const bPath = `avatars/cv-${two.id}-pet_photo.jpg`;
    await exec.runAsync(
      "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      [uid(), two.id, defId, bPath, NOW, NOW],
    );
    h.fs!.files.set(bPath, "b");
    h.derivatives.add(bPath);
    await dropField(exec, { id: defId, col_name: "pet_photo" }, "delete", NOW);
    await drainRestorePhotoJournal(exec);
    expect(h.fs!.files.has(a.path)).toBe(false);
    expect(h.fs!.files.has(bPath)).toBe(false);
    expect(h.derivatives.size).toBe(0);
  });

  it("merge: the absorbed photo's derivative goes, and the survivor's replaced one too", async () => {
    const s = await contact("Survivor", { photo: true });
    const a = await contact("Absorbed", { photo: true });
    await mergeContactsWithPhotoOwnership(exec, {
      survivorId: s.id,
      absorbedId: a.id,
      now: NOW,
      resolutions: { photo: { choice: "absorbed" } } as never,
    });
    expect(h.fs!.files.get(s.path)).toBe("Absorbed");
    expect(h.fs!.files.has(a.path)).toBe(false);
    expect(h.derivatives.has(a.path)).toBe(false);
    expect(h.derivatives.has(s.path)).toBe(false);
  });

  it("restore finalize: restored bytes replace the canonical and its derivative goes", async () => {
    const c = await contact("Restored", { photo: true });
    const pending = `avatars/_restore_pending/contact-${c.uid}-s1.jpg`;
    h.fs!.files.set(pending, "from backup");
    const entry = {
      relativePath: pending,
      action: "finalize" as const,
      targetKind: "contact" as const,
      contactUid: c.uid,
      valueUid: null,
      fieldDefUid: null,
      canonicalRelativePath: c.path,
      createdAt: NOW,
    };
    await inWriteTransaction(exec, () => insertJournalEntryCore(exec, entry));
    await finalizeJournalEntryOwned(exec, entry);
    expect(h.fs!.files.get(c.path)).toBe("from backup");
    expect(h.derivatives.has(c.path)).toBe(false);
  });

  it("reconcile: an interrupted swap restored from .bak discards the derivative", async () => {
    const c = await contact("Swap", { photo: true });
    h.fs!.files.set(`${c.path}.bak`, h.fs!.files.get(c.path)!);
    h.fs!.files.delete(c.path);
    await reconcilePhotoWritesOwned();
    expect(h.fs!.files.has(c.path)).toBe(true);
    expect(h.derivatives.has(c.path)).toBe(false);
  });
});
