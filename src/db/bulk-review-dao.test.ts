import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  ignoreBulkReviewFlag,
  resolveBulkReviewFlag,
} from "@/db/bulk-review-dao";
import { listBulkReviewFlags } from "@/db/bulk-review-read";
import { readDataRevision } from "@/db/data-revision-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  acceptImportSessionWithRows,
  setRowContactCore,
} from "@/db/import-session-dao";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const newUid = () => `bulk-dao-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
});

async function seedContact(
  name = "Person",
  birthday: string | null = null,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, birthday, created_at, modified_at)
     VALUES (?, ?, 0, ?, ?, ?)`,
    [newUid(), name, birthday, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedFlag(
  contactId: number,
  birthday = "unreadable",
): Promise<number> {
  const accepted = await acceptImportSessionWithRows(exec, {
    session: {
      uid: newUid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: [
      {
        uid: newUid(),
        externalContactId: newUid(),
        sourcePayload: JSON.stringify({
          name: "Imported",
          birthday,
          methods: [],
        }),
        photoRelPath: null,
      },
    ],
  });
  await inWriteTransaction(exec, () =>
    setRowContactCore(exec, accepted.rowIds[0], contactId, "imported", NOW),
  );
  return accepted.rowIds[0];
}

describe("bulk-review-dao", () => {
  it("fixes a birthday and writes its fixed resolution atomically, bumping data revision once", async () => {
    const contactId = await seedContact();
    const rowId = await seedFlag(contactId);
    const before = await readDataRevision(exec);

    await resolveBulkReviewFlag(exec, {
      importSessionRowId: rowId,
      contactId,
      birthday: "2000-03-14",
      now: NOW,
    });

    expect(
      await exec.getFirstAsync<{ birthday: string | null }>(
        "SELECT birthday FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ birthday: "2000-03-14" });
    expect(
      await exec.getFirstAsync<{ resolution: string }>(
        "SELECT resolution FROM bulk_review_resolutions WHERE import_session_row_id = ?",
        [rowId],
      ),
    ).toEqual({ resolution: "fixed" });
    expect(await readDataRevision(exec)).toBe(before + 1);
    await expect(listBulkReviewFlags(exec)).resolves.toEqual([]);
  });

  it("ignores only the flag and leaves contact data and revision unchanged", async () => {
    const contactId = await seedContact("Keep", "03-14");
    const rowId = await seedFlag(contactId);
    const before = await readDataRevision(exec);

    await ignoreBulkReviewFlag(exec, { importSessionRowId: rowId, now: NOW });

    expect(
      await exec.getFirstAsync<{ birthday: string | null }>(
        "SELECT birthday FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ birthday: "03-14" });
    expect(
      await exec.getFirstAsync<{ resolution: string }>(
        "SELECT resolution FROM bulk_review_resolutions WHERE import_session_row_id = ?",
        [rowId],
      ),
    ).toEqual({ resolution: "ignored" });
    expect(await readDataRevision(exec)).toBe(before);
  });

  it("enforces one birthday resolution per import row and remains resolved after reopening the database", async () => {
    const priorExec = exec;
    const directory = mkdtempSync(join(tmpdir(), "orbit-bulk-review-"));
    const dbPath = join(directory, "orbit.db");
    let firstDb: DatabaseSync | null = null;
    let reopenedDb: DatabaseSync | null = null;
    try {
      firstDb = new DatabaseSync(dbPath);
      firstDb.exec("PRAGMA foreign_keys = ON;");
      exec = nodeSqliteExecutor(firstDb);
      await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
        now: NOW,
        newUid,
      });
      const contactId = await seedContact();
      const rowId = await seedFlag(contactId);
      await ignoreBulkReviewFlag(exec, { importSessionRowId: rowId, now: NOW });

      await expect(
        ignoreBulkReviewFlag(exec, { importSessionRowId: rowId, now: NOW }),
      ).rejects.toThrow();

      firstDb.close();
      firstDb = null;
      reopenedDb = new DatabaseSync(dbPath);
      reopenedDb.exec("PRAGMA foreign_keys = ON;");
      await expect(
        listBulkReviewFlags(nodeSqliteExecutor(reopenedDb)),
      ).resolves.toEqual([]);
    } finally {
      firstDb?.close();
      reopenedDb?.close();
      exec = priorExec;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
