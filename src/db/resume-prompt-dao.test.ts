import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { acceptImportSessionWithRows } from "@/db/import-session-dao";
import { runMigrations } from "@/db/migrations/runner";
import {
  clearImportResumePrompted,
  clearReconcileResumePrompted,
  markImportResumePrompted,
  markReconcileResumePrompted,
} from "@/db/resume-prompt-dao";
import type { SqlExecutor } from "@/db/types";

/**
 * 38.12 D-105 / D-111: the "asked once" marker on migration 034's
 * `resume_prompted_at`, and the locked public writers (convergence c4 E-3).
 */
const NOW = "2026-10-17 12:00:00";
const LATER = "2026-10-18 09:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const uid = () => `uid-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function importSession(): Promise<number> {
  const accepted = await acceptImportSessionWithRows(exec, {
    session: {
      uid: uid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: [
      {
        uid: uid(),
        externalContactId: "a",
        sourcePayload: JSON.stringify({ name: "A", methods: [] }),
        photoRelPath: null,
      },
    ],
  });
  return accepted.sessionId;
}

async function reconcileSession(): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO reconciliation_sessions (uid, status, total_checked, created_at, modified_at)
     VALUES (?, 'pending', 0, ?, ?)`,
    [uid(), NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function marker(
  table: "import_sessions" | "reconciliation_sessions",
  id: number,
) {
  return exec.getFirstAsync<{
    resume_prompted_at: string | null;
    modified_at: string;
  }>(`SELECT resume_prompted_at, modified_at FROM ${table} WHERE id = ?`, [id]);
}

describe("resume-prompt-dao", () => {
  it("marks an import session once and keeps the first time", async () => {
    const id = await importSession();
    await expect(markImportResumePrompted(exec, id, NOW)).resolves.toBe(true);
    await expect(markImportResumePrompted(exec, id, LATER)).resolves.toBe(
      false,
    );
    // Prompt bookkeeping never touches modified_at.
    await expect(marker("import_sessions", id)).resolves.toEqual({
      resume_prompted_at: NOW,
      modified_at: NOW,
    });
  });

  it("clears an import session's marker so it can be asked again (L-3)", async () => {
    const id = await importSession();
    await markImportResumePrompted(exec, id, NOW);
    await clearImportResumePrompted(exec, id);
    expect((await marker("import_sessions", id))?.resume_prompted_at).toBe(
      null,
    );
    await expect(markImportResumePrompted(exec, id, LATER)).resolves.toBe(true);
    expect((await marker("import_sessions", id))?.resume_prompted_at).toBe(
      LATER,
    );
  });

  it("marks and clears a reconcile session the same way", async () => {
    const id = await reconcileSession();
    await expect(markReconcileResumePrompted(exec, id, NOW)).resolves.toBe(
      true,
    );
    await expect(markReconcileResumePrompted(exec, id, LATER)).resolves.toBe(
      false,
    );
    await expect(marker("reconciliation_sessions", id)).resolves.toEqual({
      resume_prompted_at: NOW,
      modified_at: NOW,
    });
    await clearReconcileResumePrompted(exec, id);
    expect(
      (await marker("reconciliation_sessions", id))?.resume_prompted_at,
    ).toBe(null);
  });

  it("each locked wrapper brackets its UPDATE in BEGIN / COMMIT with no transaction already open (E-3)", async () => {
    const importId = await importSession();
    const reconcileId = await reconcileSession();
    const log: string[] = [];
    const spy: SqlExecutor = {
      ...exec,
      execAsync: async (sql) => {
        log.push(sql);
        return exec.execAsync(sql);
      },
      runAsync: async (sql, params) => {
        log.push(sql.trim().split(/\s+/).slice(0, 2).join(" "));
        return exec.runAsync(sql, params);
      },
    };
    const calls: Array<[string, () => Promise<unknown>]> = [
      ["import_sessions", () => markImportResumePrompted(spy, importId, NOW)],
      ["import_sessions", () => clearImportResumePrompted(spy, importId)],
      [
        "reconciliation_sessions",
        () => markReconcileResumePrompted(spy, reconcileId, NOW),
      ],
      [
        "reconciliation_sessions",
        () => clearReconcileResumePrompted(spy, reconcileId),
      ],
    ];
    for (const [table, call] of calls) {
      log.length = 0;
      await call();
      expect(log).toEqual(["BEGIN", `UPDATE ${table}`, "COMMIT"]);
    }
  });
});
