import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  files: new Map<string, string>(),
  discards: [] as string[],
}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: () => true,
}));
vi.mock("@/services/photos/photo-storage", () => ({
  persistMaster: async (source: string, path: string) => {
    h.files.set(path, h.files.get(source) ?? source);
    return path;
  },
  deletePhoto: (path: string) => {
    h.files.delete(path);
  },
  photoFileExists: (path: string) => h.files.has(path),
  listImportStagingPhotos: () =>
    [...h.files.keys()]
      .filter((path) => path.startsWith("import-staging/"))
      .map((relative) => ({ relative, isStageTmpOrphan: false })),
  deleteImportStaging: (path: string) => {
    h.files.delete(path);
  },
  deleteRestorePending: (path: string) => {
    h.files.delete(path);
  },
  listRestorePendingPhotos: () => [],
  resolveRestorePendingUri: (path: string) => path,
}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  acceptImportSessionWithRows,
  setRowContact,
} from "@/db/import-session-dao";
import { runMigrations } from "@/db/migrations/runner";
import {
  enqueueDeleteIntentCore,
  insertJournalEntryCore,
  listJournalEntriesCore,
} from "@/db/restore-photo-journal-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  canonicalGeneration,
  persistOwnedMaster,
} from "@/services/photos/owned-master";
import { getPhotoCacheBust } from "@/stores/photo-cache-bust-store";
import {
  type RetryPhotoFs,
  retryImportedPhoto,
  skipRemainingPhotos,
} from "./import-photo-retry";

const NOW = "2026-09-24 12:00:00";
const staged = "import-staging/import-retry.jpg";
let exec: SqlExecutor;
let contactId: number;
let rowId: number;
let sessionId: number;
let serial = 0;
const uid = () => `retry-${++serial}`;
const canonical = () => `avatars/contact-${contactId}.jpg`;

function fs(resize?: () => Promise<string>): RetryPhotoFs {
  return {
    resolveStagedPhotoPath: (path) => path,
    contactPhotoRelPath: (id) => `avatars/contact-${id}.jpg`,
    resizeToMaster: resize ?? (async () => "resized"),
    persistMaster: async (source, path) => {
      h.files.set(path, h.files.get(source) ?? source);
      return path;
    },
    deleteImportStaging: (path) => {
      h.files.delete(path);
    },
    discardDerivative: (uri) => {
      h.discards.push(uri);
      return true;
    },
    setContactPhoto: async () => {
      throw new Error("retry must publish itself");
    },
    stagingExists: (path) => h.files.has(path),
    deleteCanonical: (path) => {
      h.files.delete(path);
    },
    canonicalExists: (path) => h.files.has(path),
  };
}
async function row() {
  return exec.getFirstAsync<{
    photo_rel_path: string | null;
    contact_id: number | null;
  }>(
    "SELECT photo_rel_path, contact_id FROM import_session_rows WHERE id = ?",
    [rowId],
  );
}
async function photo() {
  return exec.getFirstAsync<{ photo: string | null; uid: string }>(
    "SELECT photo, uid FROM contacts WHERE id = ?",
    [contactId],
  );
}

beforeEach(async () => {
  h.discards.length = 0;
  h.files.clear();
  serial = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
  const contact = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, 'Imported', 0, ?, ?)",
    [uid(), NOW, NOW],
  );
  contactId = contact.lastInsertRowId;
  const accepted = await acceptImportSessionWithRows(exec, {
    session: {
      uid: uid(),
      mode: "single",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: [
      {
        uid: uid(),
        externalContactId: "source",
        sourcePayload: "{}",
        photoRelPath: staged,
      },
    ],
  });
  rowId = accepted.rowIds[0];
  sessionId = accepted.sessionId;
  await setRowContact(exec, rowId, contactId, "imported", NOW);
  h.files.set(staged, "imported-bytes");
  h.files.set("resized", "imported-bytes");
});

describe("photo-only import retry", () => {
  it("publishes after a committed contact without creating another contact", async () => {
    expect(await retryImportedPhoto(exec, fs(), rowId, NOW)).toBe(true);
    expect(await photo()).toMatchObject({ photo: canonical() });
    expect(await row()).toMatchObject({ photo_rel_path: null });
    expect(h.files.get(canonical())).toBe("imported-bytes");
    expect(h.discards).toEqual(["resized"]);
    expect(
      (
        await exec.getFirstAsync<{ n: number }>(
          "SELECT COUNT(*) AS n FROM contacts",
        )
      )?.n,
    ).toBe(1);
  });

  it("retires missing staging and a contact with a newer photo without writing", async () => {
    h.files.delete(staged);
    expect(await retryImportedPhoto(exec, fs(), rowId, NOW)).toBe(false);
    expect(await row()).toMatchObject({ photo_rel_path: null });
    await exec.runAsync(
      "UPDATE import_session_rows SET photo_rel_path = ? WHERE id = ?",
      [staged, rowId],
    );
    h.files.set(staged, "imported-bytes");
    await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
      canonical(),
      contactId,
    ]);
    h.files.set(canonical(), "newer");
    expect(await retryImportedPhoto(exec, fs(), rowId, NOW)).toBe(false);
    expect(h.files.get(canonical())).toBe("newer");
    expect(await row()).toMatchObject({ photo_rel_path: null });
  });

  it("refuses a crop that publishes during resize, preserving its bytes", async () => {
    const mock = fs(async () => {
      h.files.set("crop", "crop-bytes");
      await persistOwnedMaster(exec, "crop", canonical());
      await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
        canonical(),
        contactId,
      ]);
      return "resized";
    });
    expect(await retryImportedPhoto(exec, mock, rowId, NOW)).toBe(false);
    expect(h.files.get(canonical())).toBe("crop-bytes");
    expect(await row()).toMatchObject({ photo_rel_path: null });
  });

  it("refuses a crop persisted during resize even before its reference publishes", async () => {
    expect(
      await retryImportedPhoto(
        exec,
        fs(async () => {
          h.files.set("crop", "crop-bytes");
          await persistOwnedMaster(exec, "crop", canonical());
          return "resized";
        }),
        rowId,
        NOW,
      ),
    ).toBe(false);
    expect(h.files.get(canonical())).toBe("crop-bytes");
    expect((await photo())?.photo).toBeNull();
  });

  it("refuses an integer-id reuse during resize", async () => {
    expect(
      await retryImportedPhoto(
        exec,
        fs(async () => {
          await exec.runAsync("DELETE FROM contacts WHERE id = ?", [contactId]);
          await exec.runAsync(
            "INSERT INTO contacts (id, uid, name, tracking_enabled, created_at, modified_at) VALUES (?, ?, 'Replacement', 0, ?, ?)",
            [contactId, uid(), NOW, NOW],
          );
          return "resized";
        }),
        rowId,
        NOW,
      ),
    ).toBe(false);
    expect(h.files.has(canonical())).toBe(false);
    expect((await photo())?.photo).toBeNull();
  });

  it("settles a pending delete without treating settlement as a newer writer", async () => {
    h.files.set(canonical(), "old");
    await inWriteTransaction(exec, () =>
      enqueueDeleteIntentCore(exec, canonical()),
    );
    expect(await retryImportedPhoto(exec, fs(), rowId, NOW)).toBe(true);
    expect(h.files.get(canonical())).toBe("imported-bytes");
    expect(await row()).toMatchObject({ photo_rel_path: null });
  });

  it("still publishes when settle retires a stale journal row (settle never touches the generation)", async () => {
    // The contact has no photo, so this old finalize is unreferenced: settle
    // retires it without persisting. The retry's authorization must survive.
    const stale = "avatars/_restore_pending/contact-stale-s1.jpg";
    h.files.set(stale, "stale");
    const contactUid = (await photo())!.uid;
    await inWriteTransaction(exec, () =>
      insertJournalEntryCore(exec, {
        relativePath: stale,
        action: "finalize",
        targetKind: "contact",
        contactUid,
        valueUid: null,
        fieldDefUid: null,
        canonicalRelativePath: canonical(),
        createdAt: NOW,
      }),
    );
    const gen = canonicalGeneration(canonical());
    const rev = getPhotoCacheBust(canonical()) ?? 0;
    expect(await retryImportedPhoto(exec, fs(), rowId, NOW)).toBe(true);
    expect(h.files.get(canonical())).toBe("imported-bytes");
    expect((await photo())?.photo).toBe(canonical());
    expect(await listJournalEntriesCore(exec)).toEqual([]);
    expect(canonicalGeneration(canonical())).toBe(gen + 1);
    expect(getPhotoCacheBust(canonical())).toBe(rev + 1);
  });

  it("cleans up bytes when purge wins after authorization but before publication", async () => {
    const mocked = fs();
    mocked.persistMaster = async (source, path) => {
      h.files.set(path, h.files.get(source) ?? source);
      await exec.runAsync("DELETE FROM contacts WHERE id = ?", [contactId]);
      return path;
    };
    expect(await retryImportedPhoto(exec, mocked, rowId, NOW)).toBe(false);
    expect(h.files.has(canonical())).toBe(false);
    expect((await row())?.photo_rel_path ?? null).toBeNull();
  });

  describe("photo fingerprint record (D-132)", () => {
    const FINGERPRINT = "f".repeat(64);
    let linkId: number;

    beforeEach(async () => {
      await exec.runAsync(
        "UPDATE import_session_rows SET source_payload = ? WHERE id = ?",
        [JSON.stringify({ photoFingerprint: FINGERPRINT }), rowId],
      );
      const link = await exec.runAsync(
        "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'source', ?, ?)",
        [uid(), contactId, NOW, NOW],
      );
      linkId = link.lastInsertRowId;
    });

    async function reviewedPhoto(): Promise<string | null | undefined> {
      return (
        await exec.getFirstAsync<{ reviewed_value: string | null }>(
          "SELECT reviewed_value FROM reconcile_source_snapshot WHERE external_contact_link_id = ? AND field_family = 'photo'",
          [linkId],
        )
      )?.reviewed_value;
    }

    it("records the fingerprint after the publish commits", async () => {
      expect(await retryImportedPhoto(exec, fs(), rowId, NOW)).toBe(true);
      expect((await photo())?.photo).toBe(canonical());
      expect(await reviewedPhoto()).toBe(FINGERPRINT);
    });

    it("records nothing when the publish is refused (contact changed)", async () => {
      const mocked = fs();
      mocked.persistMaster = async (source, path) => {
        h.files.set(path, h.files.get(source) ?? source);
        await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
          "avatars/elsewhere.jpg",
          contactId,
        ]);
        return path;
      };
      expect(await retryImportedPhoto(exec, mocked, rowId, NOW)).toBe(false);
      expect(await reviewedPhoto()).toBeUndefined();
    });

    it("records nothing when the import row changed before publication", async () => {
      const mocked = fs();
      mocked.persistMaster = async (source, path) => {
        h.files.set(path, h.files.get(source) ?? source);
        await exec.runAsync(
          "UPDATE import_session_rows SET row_status = 'skipped' WHERE id = ?",
          [rowId],
        );
        return path;
      };
      expect(await retryImportedPhoto(exec, mocked, rowId, NOW)).toBe(false);
      expect(await reviewedPhoto()).toBeUndefined();
    });

    it("a throwing record does not fail the retry", async () => {
      await exec.execAsync(`
        CREATE TRIGGER snapshot_insert_fails BEFORE INSERT ON reconcile_source_snapshot
        BEGIN SELECT RAISE(ABORT, 'record refused'); END;
      `);
      expect(await retryImportedPhoto(exec, fs(), rowId, NOW)).toBe(true);
      expect((await photo())?.photo).toBe(canonical());
      expect(await row()).toMatchObject({ photo_rel_path: null });
      expect(h.files.has(staged)).toBe(false);
      expect(await reviewedPhoto()).toBeUndefined();
    });
  });

  it("explicit skip discards only photo work", async () => {
    expect(await skipRemainingPhotos(exec, fs(), sessionId, NOW)).toBe(1);
    expect(await row()).toMatchObject({
      photo_rel_path: null,
      contact_id: contactId,
    });
    expect(h.files.has(staged)).toBe(false);
    expect((await photo())?.photo).toBeNull();
  });
});
