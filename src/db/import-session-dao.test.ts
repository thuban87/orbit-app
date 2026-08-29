import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  acceptImportSessionWithRows,
  deferNeedsReviewCore,
  discardSession,
  finalizeSessionIfTerminal,
  markRowStatus,
  retireRowStagedPhoto,
  resolveAlreadyLinkedCore,
  setRowContactCore,
  setRowMatchOutcomeCore,
  setSessionBatchCategory,
} from "@/db/import-session-dao";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
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

async function seedContact(): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newUid(), "Existing", 0, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function acceptRows(
  externalContactIds: string[],
): Promise<{ sessionId: number; rowIds: number[] }> {
  return acceptImportSessionWithRows(exec, {
    session: {
      uid: newUid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: externalContactIds.map((externalContactId) => ({
      uid: newUid(),
      externalContactId,
      sourcePayload: JSON.stringify({ name: externalContactId, methods: [] }),
      photoRelPath: `import-staging/${externalContactId}.jpg`,
    })),
  });
}

describe("import-session-dao", () => {
  it("writes session + all rows + total_rows atomically; a mid-insert failure persists nothing", async () => {
    await expect(acceptRows(["duplicate", "duplicate"])).rejects.toThrow();
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM import_sessions",
      ),
    ).toEqual({ count: 0 });
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM import_session_rows",
      ),
    ).toEqual({ count: 0 });

    const accepted = await acceptRows(["one", "two"]);
    expect(accepted.rowIds).toHaveLength(2);
    expect(
      await exec.getFirstAsync<{ total_rows: number }>(
        "SELECT total_rows FROM import_sessions WHERE id = ?",
        [accepted.sessionId],
      ),
    ).toEqual({ total_rows: 2 });
  });

  it("preserves imported rows while discard removes contact-less rows and returns staged paths", async () => {
    const contactId = await seedContact();
    const accepted = await acceptRows(["imported", "pending"]);
    await inWriteTransaction(exec, () =>
      setRowContactCore(exec, accepted.rowIds[0], contactId, "imported", NOW),
    );

    await expect(
      discardSession(exec, accepted.sessionId, NOW),
    ).resolves.toEqual(["import-staging/pending.jpg"]);
    expect(
      await exec.getAllAsync<{ external_contact_id: string }>(
        "SELECT external_contact_id FROM import_session_rows ORDER BY id",
      ),
    ).toEqual([{ external_contact_id: "imported" }]);
  });

  it("composes core writers inside one caller-opened transaction", async () => {
    const contactId = await seedContact();
    const accepted = await acceptRows(["one"]);
    await inWriteTransaction(exec, async () => {
      await setRowContactCore(
        exec,
        accepted.rowIds[0],
        contactId,
        "imported",
        NOW,
      );
      await setRowMatchOutcomeCore(exec, accepted.rowIds[0], "new", null, NOW);
    });
    expect(
      await exec.getFirstAsync<{
        row_status: string;
        match_outcome: string;
        contact_id: number;
      }>(
        "SELECT row_status, match_outcome, contact_id FROM import_session_rows WHERE id = ?",
        [accepted.rowIds[0]],
      ),
    ).toEqual({
      row_status: "imported",
      match_outcome: "new",
      contact_id: contactId,
    });
  });

  it("writes composed already-linked and needs-review classifications in one update", async () => {
    const contactId = await seedContact();
    const accepted = await acceptRows(["linked", "review"]);
    await inWriteTransaction(exec, async () => {
      await resolveAlreadyLinkedCore(exec, accepted.rowIds[0], contactId, NOW);
      await deferNeedsReviewCore(
        exec,
        accepted.rowIds[1],
        "probable",
        contactId,
        JSON.stringify([
          { contactId, signals: ["email"], recommendation: "link" },
        ]),
        NOW,
      );
    });
    expect(
      await exec.getAllAsync<{
        row_status: string;
        match_outcome: string;
        matched_contact_id: number;
        candidates_json: string | null;
      }>(
        `SELECT row_status, match_outcome, matched_contact_id, candidates_json
         FROM import_session_rows ORDER BY id`,
      ),
    ).toEqual([
      {
        row_status: "skipped",
        match_outcome: "already_linked",
        matched_contact_id: contactId,
        candidates_json: null,
      },
      {
        row_status: "needs_review",
        match_outcome: "probable",
        matched_contact_id: contactId,
        candidates_json: JSON.stringify([
          { contactId, signals: ["email"], recommendation: "link" },
        ]),
      },
    ]);
  });

  it("completes only sessions with no pending, needs_review, or failed rows", async () => {
    const complete = await acceptRows(["complete"]);
    await markRowStatus(exec, complete.rowIds[0], "skipped", null, NOW);
    await expect(
      finalizeSessionIfTerminal(exec, complete.sessionId, NOW),
    ).resolves.toBe(true);

    const needsReview = await acceptRows(["review"]);
    await markRowStatus(exec, needsReview.rowIds[0], "needs_review", null, NOW);
    await expect(
      finalizeSessionIfTerminal(exec, needsReview.sessionId, NOW),
    ).resolves.toBe(false);

    const failed = await acceptRows(["failed"]);
    await markRowStatus(exec, failed.rowIds[0], "failed", "network", NOW);
    await expect(
      finalizeSessionIfTerminal(exec, failed.sessionId, NOW),
    ).resolves.toBe(false);
    expect(
      await exec.getFirstAsync<{ status: string }>(
        "SELECT status FROM import_sessions WHERE id = ?",
        [failed.sessionId],
      ),
    ).toEqual({ status: "pending" });
  });

  it("durably updates a session batch category, including the Uncategorized null", async () => {
    const accepted = await acceptRows(["category"]);
    const category = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories ORDER BY id LIMIT 1",
    );
    if (!category) throw new Error("migration fixture did not seed a category");

    await setSessionBatchCategory(exec, accepted.sessionId, category.id, NOW);
    expect(
      await exec.getFirstAsync<{ batch_category_id: number | null }>(
        "SELECT batch_category_id FROM import_sessions WHERE id = ?",
        [accepted.sessionId],
      ),
    ).toEqual({ batch_category_id: category.id });
    await setSessionBatchCategory(exec, accepted.sessionId, null, NOW);
    expect(
      await exec.getFirstAsync<{ batch_category_id: number | null }>(
        "SELECT batch_category_id FROM import_sessions WHERE id = ?",
        [accepted.sessionId],
      ),
    ).toEqual({ batch_category_id: null });
  });

  it("retires only a row's staged-photo reference and updates its timestamp", async () => {
    const contactId = await seedContact();
    const accepted = await acceptRows(["retire"]);
    await inWriteTransaction(exec, async () => {
      await setRowContactCore(
        exec,
        accepted.rowIds[0],
        contactId,
        "imported",
        NOW,
      );
      await setRowMatchOutcomeCore(exec, accepted.rowIds[0], "new", null, NOW);
      await exec.runAsync(
        "UPDATE import_session_rows SET photo_failed = 1 WHERE id = ?",
        [accepted.rowIds[0]],
      );
    });

    await retireRowStagedPhoto(
      exec,
      accepted.rowIds[0],
      "2026-08-29 12:01:00",
    );

    expect(
      await exec.getFirstAsync<{
        photo_rel_path: string | null;
        row_status: string;
        contact_id: number | null;
        match_outcome: string | null;
        photo_failed: number;
        modified_at: string;
      }>(
        `SELECT photo_rel_path, row_status, contact_id, match_outcome, photo_failed, modified_at
         FROM import_session_rows WHERE id = ?`,
        [accepted.rowIds[0]],
      ),
    ).toEqual({
      photo_rel_path: null,
      row_status: "imported",
      contact_id: contactId,
      match_outcome: "new",
      photo_failed: 1,
      modified_at: "2026-08-29 12:01:00",
    });
  });

  it("throws when retiring the staged photo of an unknown row", async () => {
    await expect(retireRowStagedPhoto(exec, 9999, NOW)).rejects.toThrow(
      "retireRowStagedPhotoCore: no row matched id=9999",
    );
  });
});
