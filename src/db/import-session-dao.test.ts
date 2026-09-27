import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import * as importSessionDao from "@/db/import-session-dao";
import {
  acceptImportSessionWithRows,
  assertImportLifecycle,
  createImportSession,
  deferNeedsReviewCore,
  discardSession,
  finalizeSessionIfTerminal,
  markRowStatus,
  resolveAlreadyLinkedCore,
  retireRowStagedPhoto,
  setRowContactCore,
  setRowMatchOutcomeCore,
  setSessionBatchDefaults,
  UNBOUND_IMPORT,
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

  // 38.4 review Lane A IN-03: D-57 writes the batch category and lifecycle in
  // ONE update (setSessionBatchDefaults). A category-only writer bypassed that
  // rule and had no production caller, so it is gone.
  it("exports no category-only batch writer", () => {
    expect(importSessionDao).not.toHaveProperty("setSessionBatchCategory");
    expect(importSessionDao).toHaveProperty("setSessionBatchDefaults");
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

    await retireRowStagedPhoto(exec, accepted.rowIds[0], "2026-08-29 12:01:00");

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

/**
 * 38.4 D-57 (owner, OA-E2): the batch lifecycle (Bound with a positive cadence,
 * or Unbound with none) lives on the durable session, written with the batch
 * category in ONE update before any contact is created.
 */
describe("import session batch lifecycle (D-57)", () => {
  async function sessionColumns(sessionId: number) {
    return exec.getFirstAsync<{
      batch_category_id: number | null;
      batch_tracking_enabled: number;
      batch_interval_days: number | null;
      modified_at: string;
    }>(
      `SELECT batch_category_id, batch_tracking_enabled, batch_interval_days, modified_at
       FROM import_sessions WHERE id = ?`,
      [sessionId],
    );
  }

  it("UNBOUND_IMPORT is the Unbound, no-cadence lifecycle", () => {
    expect(UNBOUND_IMPORT).toEqual({
      trackingEnabled: false,
      intervalDays: null,
    });
  });

  it("assertImportLifecycle accepts Bound with a positive integer cadence and Unbound without one", () => {
    expect(() => assertImportLifecycle(UNBOUND_IMPORT)).not.toThrow();
    expect(() =>
      assertImportLifecycle({ trackingEnabled: true, intervalDays: 14 }),
    ).not.toThrow();
  });

  it.each([
    { trackingEnabled: true, intervalDays: null },
    { trackingEnabled: true, intervalDays: 0 },
    { trackingEnabled: true, intervalDays: -7 },
    { trackingEnabled: true, intervalDays: 1.5 },
    { trackingEnabled: false, intervalDays: 30 },
  ])("assertImportLifecycle rejects %j", (lifecycle) => {
    expect(() =>
      assertImportLifecycle(lifecycle as unknown as typeof UNBOUND_IMPORT),
    ).toThrow();
  });

  it("setSessionBatchDefaults writes category and lifecycle in one update", async () => {
    const accepted = await acceptRows(["bound"]);
    const category = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories ORDER BY id LIMIT 1",
    );
    if (!category) throw new Error("migration fixture did not seed a category");
    const updates: string[] = [];
    const spy: SqlExecutor = {
      ...exec,
      runAsync: (sql, params) => {
        if (/UPDATE\s+import_sessions/i.test(sql)) updates.push(sql);
        return exec.runAsync(sql, params);
      },
    };

    await setSessionBatchDefaults(
      spy,
      accepted.sessionId,
      {
        categoryId: category.id,
        lifecycle: { trackingEnabled: true, intervalDays: 14 },
      },
      "2026-09-27 09:00:00",
    );

    expect(updates).toHaveLength(1);
    expect(await sessionColumns(accepted.sessionId)).toEqual({
      batch_category_id: category.id,
      batch_tracking_enabled: 1,
      batch_interval_days: 14,
      modified_at: "2026-09-27 09:00:00",
    });

    await setSessionBatchDefaults(
      exec,
      accepted.sessionId,
      { categoryId: null, lifecycle: UNBOUND_IMPORT },
      "2026-09-27 10:00:00",
    );
    expect(await sessionColumns(accepted.sessionId)).toEqual({
      batch_category_id: null,
      batch_tracking_enabled: 0,
      batch_interval_days: null,
      modified_at: "2026-09-27 10:00:00",
    });
  });

  it("setSessionBatchDefaults validates before writing: an invalid lifecycle writes nothing", async () => {
    const accepted = await acceptRows(["invalid"]);
    const before = await sessionColumns(accepted.sessionId);
    await expect(
      setSessionBatchDefaults(
        exec,
        accepted.sessionId,
        {
          categoryId: null,
          lifecycle: {
            trackingEnabled: true,
            intervalDays: null,
          } as unknown as typeof UNBOUND_IMPORT,
        },
        "2026-09-27 11:00:00",
      ),
    ).rejects.toThrow();
    expect(await sessionColumns(accepted.sessionId)).toEqual(before);
  });

  it("setSessionBatchDefaults throws for an unknown session", async () => {
    await expect(
      setSessionBatchDefaults(
        exec,
        9999,
        { categoryId: null, lifecycle: UNBOUND_IMPORT },
        NOW,
      ),
    ).rejects.toThrow(/no row matched id=9999/);
  });

  it("session creation takes an optional cadence validated with the tracking flag", async () => {
    const bound = await createImportSession(exec, {
      uid: newUid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: true,
      batchIntervalDays: 30,
      phoneRegion: "US",
      now: NOW,
    });
    expect(await sessionColumns(bound)).toMatchObject({
      batch_tracking_enabled: 1,
      batch_interval_days: 30,
    });
    const defaulted = await createImportSession(exec, {
      uid: newUid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    });
    expect(await sessionColumns(defaulted)).toMatchObject({
      batch_tracking_enabled: 0,
      batch_interval_days: null,
    });
    const sessionsBefore = await exec.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM import_sessions",
    );
    await expect(
      acceptImportSessionWithRows(exec, {
        session: {
          uid: newUid(),
          mode: "bulk",
          batchCategoryId: null,
          batchTrackingEnabled: true,
          phoneRegion: "US",
          now: NOW,
        },
        rows: [],
      }),
    ).rejects.toThrow();
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM import_sessions",
      ),
    ).toEqual(sessionsBefore);
  });
});
