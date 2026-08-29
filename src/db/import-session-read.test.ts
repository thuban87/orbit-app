import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { buildExportManifest } from "@/backup/export-manifest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  acceptImportSessionWithRows,
  deferNeedsReview,
  markRowStatus,
  resolveAlreadyLinked,
  setSessionBatchCategory,
} from "@/db/import-session-dao";
import {
  getResumableSession,
  getSessionById,
  listSessionRows,
  sessionRowCounts,
  sessionSummaryCounts,
} from "@/db/import-session-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-29 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const newUid = () => `uid-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
});

async function acceptRows(
  target: SqlExecutor,
  externalContactIds: string[],
  createdAt = NOW,
): Promise<{ sessionId: number; rowIds: number[] }> {
  return acceptImportSessionWithRows(target, {
    session: {
      uid: newUid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: createdAt,
    },
    rows: externalContactIds.map((externalContactId) => ({
      uid: newUid(),
      externalContactId,
      sourcePayload: JSON.stringify({
        name: externalContactId,
        methods: [
          { type: "email", value: `${externalContactId}@example.test` },
        ],
        birthday: "2000-01-01",
      }),
      photoRelPath: `import-staging/${externalContactId}.jpg`,
    })),
  });
}

async function seedContact(target: SqlExecutor): Promise<number> {
  const result = await target.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newUid(), "Existing", 0, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("import-session-read", () => {
  it("keeps a session snapshot durable through a database re-open", async () => {
    const folder = mkdtempSync(join(tmpdir(), "orbit-import-session-"));
    const dbPath = join(folder, "orbit.db");
    let first: DatabaseSync | null = null;
    let reopened: DatabaseSync | null = null;
    try {
      first = new DatabaseSync(dbPath);
      first.exec("PRAGMA foreign_keys = ON");
      const firstExec = nodeSqliteExecutor(first);
      await runMigrations(firstExec, MIGRATIONS, TARGET_VERSION, {
        now: NOW,
        newUid,
      });
      const accepted = await acceptRows(firstExec, ["durable"]);
      const contactId = await seedContact(firstExec);
      const candidates = [
        { contactId, signals: ["email"], recommendation: "link" },
      ];
      await deferNeedsReview(
        firstExec,
        accepted.rowIds[0],
        "probable",
        contactId,
        JSON.stringify(candidates),
        NOW,
      );
      const category = await firstExec.getFirstAsync<{ id: number }>(
        "SELECT id FROM categories ORDER BY id LIMIT 1",
      );
      if (!category)
        throw new Error("migration fixture did not seed a category");
      await setSessionBatchCategory(
        firstExec,
        accepted.sessionId,
        category.id,
        NOW,
      );
      first.close();
      first = null;

      reopened = new DatabaseSync(dbPath);
      reopened.exec("PRAGMA foreign_keys = ON");
      const reopenedExec = nodeSqliteExecutor(reopened);
      const resumable = await getResumableSession(reopenedExec, NOW);
      expect(resumable).toMatchObject({
        session: {
          id: accepted.sessionId,
          phoneRegion: "US",
          batchCategoryId: category.id,
          totalRows: 1,
        },
        sweptPhotoRelPaths: [],
      });
      expect(
        await getSessionById(reopenedExec, accepted.sessionId),
      ).toMatchObject({
        batchCategoryId: category.id,
        phoneRegion: "US",
      });
      expect(await listSessionRows(reopenedExec, accepted.sessionId)).toEqual([
        expect.objectContaining({
          sourcePayload: JSON.stringify({
            name: "durable",
            methods: [{ type: "email", value: "durable@example.test" }],
            birthday: "2000-01-01",
          }),
          photoRelPath: "import-staging/durable.jpg",
          candidates,
        }),
      ]);
    } finally {
      first?.close();
      reopened?.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("separates deterministic already-linked rows from a user Skip in summary counts", async () => {
    const contactId = await seedContact(exec);
    const accepted = await acceptRows(exec, [
      "imported",
      "already-linked",
      "user-skipped",
      "needs-review",
      "failed",
    ]);
    await markRowStatus(exec, accepted.rowIds[0], "imported", null, NOW);
    await resolveAlreadyLinked(exec, accepted.rowIds[1], contactId, NOW);
    await markRowStatus(exec, accepted.rowIds[2], "skipped", null, NOW);
    await markRowStatus(exec, accepted.rowIds[3], "needs_review", null, NOW);
    await markRowStatus(exec, accepted.rowIds[4], "failed", "network", NOW);

    await expect(
      sessionSummaryCounts(exec, accepted.sessionId),
    ).resolves.toEqual({
      imported: 1,
      alreadyInOrbit: 1,
      needReview: 1,
      failedOrSkipped: 2,
    });
    await expect(sessionRowCounts(exec, accepted.sessionId)).resolves.toEqual({
      pending: 0,
      imported: 1,
      linked: 0,
      needs_review: 1,
      failed: 1,
      skipped: 2,
    });
  });

  it("treats malformed durable candidate JSON as an empty advisory list", async () => {
    const accepted = await acceptRows(exec, ["malformed"]);
    await exec.runAsync(
      "UPDATE import_session_rows SET candidates_json = ? WHERE id = ?",
      ["not-json", accepted.rowIds[0]],
    );
    await expect(listSessionRows(exec, accepted.sessionId)).resolves.toEqual([
      expect.objectContaining({ candidates: [] }),
    ]);
  });

  it("keeps only the newest pending session and returns stale staged-photo paths", async () => {
    const older = await acceptRows(exec, ["older"], "2026-08-29 11:00:00");
    const newer = await acceptRows(exec, ["newer"], "2026-08-29 12:00:00");

    await expect(getResumableSession(exec, NOW)).resolves.toEqual({
      session: expect.objectContaining({ id: newer.sessionId }),
      sweptPhotoRelPaths: ["import-staging/older.jpg"],
    });
    await expect(getSessionById(exec, older.sessionId)).resolves.toMatchObject({
      status: "discarded",
    });
  });

  it("keeps runtime import sessions out of the portable export manifest", async () => {
    await acceptRows(exec, ["local-only"]);
    const manifest = await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: async () => "",
    });

    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("import_sessions");
    expect(serialized).not.toContain("import_session_rows");
    expect(serialized).not.toContain("importSessions");
    expect(serialized).not.toContain("importSessionRows");
    expect(serialized).not.toContain("row_status");
    expect(serialized).not.toContain("match_outcome");
  });
});
