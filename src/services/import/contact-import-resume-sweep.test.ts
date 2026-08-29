import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", () => ({
  deleteImportStaging: vi.fn(),
  listImportStagingPhotos: vi.fn(() => []),
}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  acceptImportSessionWithRows,
  discardSession,
  setRowContact,
} from "@/db/import-session-dao";
import { getSessionById } from "@/db/import-session-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  cleanupDiscardedStagedPhotos,
  type ImportStagingFileSystem,
  type ResumableImport,
  reconcileOrphanStagedPhotos,
  registerImportResumeSweep,
} from "@/services/import/contact-import-resume-sweep";
import { __resetSweepForTest, runLaunchSweep } from "@/services/launch-sweep";

const NOW = "2026-08-29 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const uid = () => `uid-${++uidCount}`;

function stagingFs(
  paths: string[] = [],
): ImportStagingFileSystem & { deleted: string[] } {
  const present = new Set(paths);
  const deleted: string[] = [];
  return {
    deleted,
    deleteImportStaging(relative) {
      deleted.push(relative);
      present.delete(relative);
    },
    listImportStagingPhotos() {
      return [...present].map((relative) => ({
        relative,
        isStageTmpOrphan: false,
      }));
    },
  };
}

beforeEach(async () => {
  uidCount = 0;
  __resetSweepForTest();
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function acceptRows(
  names: string[],
  options: {
    createdAt?: string;
    mode?: "single" | "bulk";
    corrupt?: boolean;
  } = {},
): Promise<{ sessionId: number; rowIds: number[] }> {
  const { createdAt = NOW, mode = "bulk", corrupt = false } = options;
  return acceptImportSessionWithRows(exec, {
    session: {
      uid: uid(),
      mode,
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: createdAt,
    },
    rows: names.map((name) => ({
      uid: uid(),
      externalContactId: name,
      sourcePayload: corrupt
        ? "not-json"
        : JSON.stringify({ name, methods: [] }),
      photoRelPath: `import-staging/import-${name}.jpg`,
    })),
  });
}

async function seedContact(): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), "Committed", 0, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("contact-import-resume-sweep", () => {
  it("reports a durable unresolved session through the registered launch hook", async () => {
    const accepted = await acceptRows(["resume"], { mode: "single" });
    const onResumable = vi.fn<(value: ResumableImport | null) => void>();
    registerImportResumeSweep(onResumable, {
      getExecutor: () => exec,
      now: () => NOW,
    });

    await runLaunchSweep();

    expect(onResumable).toHaveBeenCalledWith({
      sessionId: accepted.sessionId,
      mode: "single",
      counts: {
        pending: 1,
        imported: 0,
        linked: 0,
        needs_review: 0,
        failed: 0,
        skipped: 0,
      },
      discardOnly: false,
    });
  });

  it("sweeps older pending sessions and deletes their returned staged files in the same launch", async () => {
    await acceptRows(["older"], { createdAt: "2026-08-29 11:00:00" });
    const newer = await acceptRows(["newer"]);
    const fs = stagingFs([
      "import-staging/import-older.jpg",
      "import-staging/import-newer.jpg",
    ]);
    const onResumable = vi.fn<(value: ResumableImport | null) => void>();
    registerImportResumeSweep(onResumable, {
      getExecutor: () => exec,
      fs,
      now: () => NOW,
    });

    await runLaunchSweep();

    expect(fs.deleted).toEqual(["import-staging/import-older.jpg"]);
    expect(onResumable).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: newer.sessionId }),
    );
  });

  it("discard preserves rows with a contact_id, removes only contact_id-null rows, and the sweep deletes only returned staged photos", async () => {
    const accepted = await acceptRows(["committed", "unresolved"]);
    const contactId = await seedContact();
    await setRowContact(exec, accepted.rowIds[0], contactId, "imported", NOW);

    const paths = await discardSession(exec, accepted.sessionId, NOW);
    const fs = stagingFs([
      "import-staging/import-committed.jpg",
      "import-staging/import-unresolved.jpg",
    ]);
    cleanupDiscardedStagedPhotos(fs, paths);

    expect(paths).toEqual(["import-staging/import-unresolved.jpg"]);
    expect(fs.deleted).toEqual(paths);
    expect(
      await exec.getAllAsync<{ external_contact_id: string }>(
        "SELECT external_contact_id FROM import_session_rows ORDER BY id",
      ),
    ).toEqual([{ external_contact_id: "committed" }]);
  });

  it("keeps a live-session failed/pending staging photo but deletes a truly orphaned staged file", async () => {
    const accepted = await acceptRows(["pending", "failed"]);
    await exec.runAsync(
      "UPDATE import_session_rows SET row_status = 'failed' WHERE id = ?",
      [accepted.rowIds[1]],
    );
    const fs = stagingFs([
      "import-staging/import-pending.jpg",
      "import-staging/import-failed.jpg",
      "import-staging/import-orphan.jpg",
    ]);

    await reconcileOrphanStagedPhotos(exec, fs);

    expect(fs.deleted).toEqual(["import-staging/import-orphan.jpg"]);
  });

  it("deletes completed and skipped staging while retaining needs-review retry input", async () => {
    const accepted = await acceptRows([
      "imported",
      "linked",
      "skipped",
      "needs-review",
    ]);
    await exec.runAsync(
      `UPDATE import_session_rows
       SET row_status = CASE id
         WHEN ? THEN 'imported'
         WHEN ? THEN 'linked'
         WHEN ? THEN 'skipped'
         WHEN ? THEN 'needs_review'
       END`,
      accepted.rowIds,
    );
    const fs = stagingFs([
      "import-staging/import-imported.jpg",
      "import-staging/import-linked.jpg",
      "import-staging/import-skipped.jpg",
      "import-staging/import-needs-review.jpg",
    ]);

    await reconcileOrphanStagedPhotos(exec, fs);

    expect(fs.deleted).toEqual([
      "import-staging/import-imported.jpg",
      "import-staging/import-linked.jpg",
      "import-staging/import-skipped.jpg",
    ]);
  });

  it("treats an unparseable durable snapshot as discard-only without throwing", async () => {
    const accepted = await acceptRows(["broken"], { corrupt: true });
    const onResumable = vi.fn<(value: ResumableImport | null) => void>();
    registerImportResumeSweep(onResumable, {
      getExecutor: () => exec,
      now: () => NOW,
    });

    await expect(runLaunchSweep()).resolves.toBeUndefined();
    expect(onResumable).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: accepted.sessionId,
        discardOnly: true,
      }),
    );
  });

  it("reports no resumable session after discard", async () => {
    const accepted = await acceptRows(["discarded"]);
    await discardSession(exec, accepted.sessionId, NOW);
    const onResumable = vi.fn<(value: ResumableImport | null) => void>();
    registerImportResumeSweep(onResumable, {
      getExecutor: () => exec,
      now: () => NOW,
    });

    await runLaunchSweep();

    expect(onResumable).toHaveBeenCalledWith(null);
    expect(await getSessionById(exec, accepted.sessionId)).toMatchObject({
      status: "discarded",
    });
  });
});
