/**
 * purge-photo-cleanup — node-side proof of the POST-COMMIT photo purge adapter
 * (the purge half of PHOTO-05).
 *
 * The adapter runs AFTER `purgeContact` commits, so the `contacts` /
 * `contact_custom_values` rows are already gone — it CANNOT read the stored
 * filename. This suite proves it rebuilds every filename from `contactId` alone:
 *   - the main `avatars/contact-<id>.jpg`;
 *   - one `avatars/cv-<id>-<col>.jpg` per SURVIVING `type='photo'` def, read via
 *     `listDefs(exec, { includeQuarantined: true })` — INCLUDING a
 *     quarantined-but-not-yet-expired photo def, whose physical column + cv- file
 *     still exist (excluding it would LEAK the file, violating PHOTO-05);
 *   - and NOTHING for a non-photo def.
 *
 * `photo-storage.deletePhoto` is mocked (the derivable path builders stay REAL,
 * proving the exact wiring); the defs are seeded through the REAL migration-1
 * fixture on a fresh `node:sqlite` DB (real defs read, no native FS).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

// Replace the native module so photo-storage's real path builders load in node.
vi.mock("expo-file-system", () => ({
  File: class {},
  Directory: class {},
  Paths: { document: { uri: "file:///doc/" } },
}));

// Keep the REAL contactId-derivable path builders; mock only the FS delete.
vi.mock("@/services/photos/photo-storage", async (importActual) => {
  const actual =
    await importActual<typeof import("@/services/photos/photo-storage")>();
  return { ...actual, deletePhoto: vi.fn() };
});

import {
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  deletePhoto,
} from "@/services/photos/photo-storage";
import { buildPhotoPurgeCleanup } from "@/services/photos/purge-photo-cleanup";

const NOW = "2026-08-15 12:00:00";
const deletePhotoMock = vi.mocked(deletePhoto);

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  deletePhotoMock.mockReset();
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Seed one custom_field_defs row; `quarantinedAt` null unless supplied. */
async function seedDef(
  colName: string,
  label: string,
  type: string,
  displayOrder: number,
  quarantinedAt: string | null = null,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO custom_field_defs
       (uid, col_name, label, type, options, show_on_new, always_show,
        display_order, quarantined_at, share_with_ai, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      colName,
      label,
      type,
      null,
      0,
      0,
      displayOrder,
      quarantinedAt,
      0,
      NOW,
      NOW,
    ],
  );
}

describe("buildPhotoPurgeCleanup — derives + deletes photo files from contactId (PHOTO-05)", () => {
  it("deletes the main photo and every surviving photo-field file, quarantined INCLUDED, ignoring non-photo defs", async () => {
    // A live photo def, a QUARANTINED photo def (its cv- file still on disk), and
    // a non-photo def that must never yield a cv- delete.
    await seedDef("headshot", "Headshot", "photo", 0);
    await seedDef("old_photo", "Old photo", "photo", 1, NOW);
    await seedDef("nickname", "Nickname", "text", 2);

    const contactId = 7;
    await buildPhotoPurgeCleanup(exec)(contactId);

    // Main + BOTH photo defs (live AND quarantined) — three deletes, no more.
    expect(deletePhotoMock).toHaveBeenCalledWith(
      contactPhotoRelPath(contactId),
    );
    expect(deletePhotoMock).toHaveBeenCalledWith(
      customFieldPhotoRelPath(contactId, "headshot"),
    );
    // Proves includeQuarantined:true closes the quarantine-window leak.
    expect(deletePhotoMock).toHaveBeenCalledWith(
      customFieldPhotoRelPath(contactId, "old_photo"),
    );
    expect(deletePhotoMock).toHaveBeenCalledTimes(3);
    // The non-photo def produced no cv- delete.
    expect(deletePhotoMock).not.toHaveBeenCalledWith(
      customFieldPhotoRelPath(contactId, "nickname"),
    );
  });

  it("deletes only the main photo when there are no photo defs", async () => {
    await seedDef("nickname", "Nickname", "text", 0);

    const contactId = 42;
    await buildPhotoPurgeCleanup(exec)(contactId);

    expect(deletePhotoMock).toHaveBeenCalledTimes(1);
    expect(deletePhotoMock).toHaveBeenCalledWith(
      contactPhotoRelPath(contactId),
    );
  });

  it("is internally error-resilient — one failing delete does not abort the rest", async () => {
    await seedDef("headshot", "Headshot", "photo", 0);
    await seedDef("old_photo", "Old photo", "photo", 1);

    // Fail the main-photo delete; the two cv- deletes must still be attempted.
    deletePhotoMock.mockImplementationOnce(() => {
      throw new Error("mock delete failed");
    });

    const contactId = 3;
    await expect(
      buildPhotoPurgeCleanup(exec)(contactId),
    ).resolves.toBeUndefined();

    expect(deletePhotoMock).toHaveBeenCalledTimes(3);
    expect(deletePhotoMock).toHaveBeenCalledWith(
      customFieldPhotoRelPath(contactId, "headshot"),
    );
    expect(deletePhotoMock).toHaveBeenCalledWith(
      customFieldPhotoRelPath(contactId, "old_photo"),
    );
  });
});
