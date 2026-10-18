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
  setRowContact,
  setSessionBatchDefaults,
  UNBOUND_IMPORT,
} from "@/db/import-session-dao";
import {
  getResumableSession,
  getSessionById,
  listSessionRows,
  sessionBatchLifecycle,
  sessionRowCounts,
  sessionSummaryCounts,
  UNNAMED_IMPORT_ROW,
} from "@/db/import-session-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  initialBulkLifecycle,
  sanitiseImportLifecycle,
} from "@/screens/bulk-import-setup-logic";

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

async function seedNamedContact(
  target: SqlExecutor,
  name: string,
): Promise<number> {
  const result = await target.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newUid(), name, 0, NOW, NOW],
  );
  return result.lastInsertRowId;
}

/** Rows whose source payload carries a phone display name (the real shape). */
async function acceptNamedRows(
  target: SqlExecutor,
  displayNames: string[],
): Promise<{ sessionId: number; rowIds: number[] }> {
  return acceptImportSessionWithRows(target, {
    session: {
      uid: newUid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: displayNames.map((displayName, index) => ({
      uid: newUid(),
      externalContactId: `named-${index}`,
      sourcePayload: JSON.stringify({
        displayName,
        methods: [],
        birthday: null,
      }),
      photoRelPath: null,
    })),
  });
}

type Summary = Awaited<ReturnType<typeof sessionSummaryCounts>>;
const BUCKETS = [
  "imported",
  "linked",
  "alreadyInOrbit",
  "skippedByUser",
  "skippedNoName",
  "failed",
  "needsReview",
] as const;

function bucketCounts(summary: Summary): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of BUCKETS) {
    expect(summary[key].people).toHaveLength(summary[key].count);
    counts[key] = summary[key].count;
  }
  counts.birthdayUnreadable = summary.birthdayUnreadable;
  return counts;
}

function namesByBucket(summary: Summary): Record<string, string[]> {
  const names: Record<string, string[]> = {};
  for (const key of BUCKETS) {
    if (summary[key].count > 0)
      names[key] = summary[key].people.map((person) => person.name);
  }
  return names;
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
      await setSessionBatchDefaults(
        firstExec,
        accepted.sessionId,
        { categoryId: category.id, lifecycle: UNBOUND_IMPORT },
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

    const summary = await sessionSummaryCounts(exec, accepted.sessionId);
    expect(bucketCounts(summary)).toEqual({
      imported: 1,
      linked: 0,
      alreadyInOrbit: 1,
      skippedByUser: 1,
      skippedNoName: 0,
      failed: 1,
      needsReview: 1,
      birthdayUnreadable: 0,
    });
    // The already-linked row is named by the Orbit contact it matched.
    expect(summary.alreadyInOrbit.people).toEqual([
      { rowId: accepted.rowIds[1], name: "Existing", contactId },
    ]);
    await expect(sessionRowCounts(exec, accepted.sessionId)).resolves.toEqual({
      pending: 0,
      imported: 1,
      linked: 0,
      needs_review: 1,
      failed: 1,
      skipped: 2,
    });
  });

  it("reports name-required skips in their own bucket, never as a user skip or a failure (B-3)", async () => {
    const accepted = await acceptRows(exec, ["name-required", "user-skipped"]);
    await markRowStatus(
      exec,
      accepted.rowIds[0],
      "skipped",
      "name-required",
      NOW,
    );
    await markRowStatus(exec, accepted.rowIds[1], "skipped", null, NOW);

    const summary = await sessionSummaryCounts(exec, accepted.sessionId);
    expect(bucketCounts(summary)).toMatchObject({
      skippedNoName: 1,
      skippedByUser: 1,
      failed: 0,
    });
  });

  it("counts only imported rows with a present but unreadable source birthday", async () => {
    const accepted = await acceptRows(exec, [
      "unreadable-birthday",
      "valid-birthday",
      "no-birthday",
      "malformed-payload",
    ]);
    const payloads = [
      JSON.stringify({ birthday: "03/04/1990" }),
      JSON.stringify({ birthday: "1990-04-03" }),
      JSON.stringify({ birthday: null }),
      "not-json",
    ];
    for (const [index, sourcePayload] of payloads.entries()) {
      await exec.runAsync(
        "UPDATE import_session_rows SET row_status = 'imported', source_payload = ? WHERE id = ?",
        [sourcePayload, accepted.rowIds[index]],
      );
    }

    const summary = await sessionSummaryCounts(exec, accepted.sessionId);
    expect(bucketCounts(summary)).toMatchObject({
      imported: 4,
      failed: 0,
      skippedByUser: 0,
      birthdayUnreadable: 1,
    });
  });

  it("counts an already-linked row once, under Already in Orbit — never as a user skip (B-2)", async () => {
    const contactId = await seedContact(exec);
    const accepted = await acceptRows(exec, ["already-linked"]);
    await resolveAlreadyLinked(exec, accepted.rowIds[0], contactId, NOW);

    const summary = await sessionSummaryCounts(exec, accepted.sessionId);
    expect(summary.alreadyInOrbit.count).toBe(1);
    expect(summary.skippedByUser.count).toBe(0);
    expect(summary.failed.count).toBe(0);
  });

  it("lists a row that failed and then succeeded on Retry only under Imported (F-1)", async () => {
    const contactId = await seedNamedContact(exec, "Rescued Person");
    const accepted = await acceptNamedRows(exec, ["Rescued Person"]);
    await markRowStatus(exec, accepted.rowIds[0], "failed", "network", NOW);
    await setRowContact(exec, accepted.rowIds[0], contactId, "imported", NOW);
    // The old reason is history: it stays on the row after the rescue.
    expect((await listSessionRows(exec, accepted.sessionId))[0]).toMatchObject({
      rowStatus: "imported",
      failureReason: "network",
    });

    const summary = await sessionSummaryCounts(exec, accepted.sessionId);
    expect(summary.imported.count).toBe(1);
    expect(summary.failed.count).toBe(0);
    expect(namesByBucket(summary)).toEqual({ imported: ["Rescued Person"] });
  });

  it("puts every non-pending row in exactly one bucket, and every name once (F-1)", async () => {
    const names = [
      "Imported Ivy",
      "Linked Lee",
      "Review Rae",
      "Failed Fay",
      "Already Al",
      "Nameless Ned",
      "Skipped Sue",
      "Retried Ray",
      "Pending Pat",
    ];
    const accepted = await acceptNamedRows(exec, names);
    const [imported, linked, review, failed, already, noName, skip, retried] =
      accepted.rowIds;
    const importedId = await seedNamedContact(exec, "Imported Ivy");
    const linkedId = await seedNamedContact(exec, "Linked Lee");
    const retriedId = await seedNamedContact(exec, "Retried Ray");
    const alreadyId = await seedNamedContact(exec, "Already Al");
    await setRowContact(exec, imported, importedId, "imported", NOW);
    await setRowContact(exec, linked, linkedId, "linked", NOW);
    await markRowStatus(exec, review, "needs_review", null, NOW);
    await markRowStatus(exec, failed, "failed", "network", NOW);
    await resolveAlreadyLinked(exec, already, alreadyId, NOW);
    await markRowStatus(exec, noName, "skipped", "name-required", NOW);
    await markRowStatus(exec, skip, "skipped", null, NOW);
    await markRowStatus(exec, retried, "failed", "network", NOW);
    await setRowContact(exec, retried, retriedId, "imported", NOW);

    const summary = await sessionSummaryCounts(exec, accepted.sessionId);
    const counts = bucketCounts(summary);
    const { birthdayUnreadable: _ignored, ...buckets } = counts;
    const raw = await sessionRowCounts(exec, accepted.sessionId);
    const total = Object.values(buckets).reduce((sum, n) => sum + n, 0);
    expect(total + raw.pending).toBe(names.length);
    expect(total).toBe(names.length - 1);
    expect(namesByBucket(summary)).toEqual({
      imported: ["Imported Ivy", "Retried Ray"],
      linked: ["Linked Lee"],
      needsReview: ["Review Rae"],
      failed: ["Failed Fay"],
      alreadyInOrbit: ["Already Al"],
      skippedNoName: ["Nameless Ned"],
      skippedByUser: ["Skipped Sue"],
    });
    const listed = Object.values(namesByBucket(summary)).flat();
    expect(new Set(listed).size).toBe(listed.length);
    // Imported and linked people carry the contact a tap opens.
    expect(summary.imported.people.map((p) => p.contactId)).toEqual([
      importedId,
      retriedId,
    ]);
    expect(summary.linked.people[0].contactId).toBe(linkedId);
    expect(summary.failed.people[0].contactId).toBeNull();
  });

  it("names an unnamed row with the shared fallback label", async () => {
    const accepted = await acceptRows(exec, ["no-display-name"]);
    await markRowStatus(exec, accepted.rowIds[0], "skipped", null, NOW);
    const summary = await sessionSummaryCounts(exec, accepted.sessionId);
    expect(summary.skippedByUser.people[0].name).toBe(UNNAMED_IMPORT_ROW);
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

  it("surfaces complete photo work and preserves it through stale and explicit discard", async () => {
    const old = await acceptRows(exec, ["committed"], "2026-08-29 10:00:00");
    const contactId = await seedContact(exec);
    await setRowContact(exec, old.rowIds[0], contactId, "imported", NOW);
    await exec.runAsync(
      "UPDATE import_sessions SET status = 'complete' WHERE id = ?",
      [old.sessionId],
    );
    expect(await getResumableSession(exec, NOW)).toMatchObject({
      session: { id: old.sessionId, status: "complete" },
    });
    const newest = await acceptRows(exec, ["newer"], NOW);
    expect(await getResumableSession(exec, NOW)).toMatchObject({
      session: { id: newest.sessionId },
    });
    await exec.runAsync(
      "UPDATE import_sessions SET status = 'discarded' WHERE id = ?",
      [newest.sessionId],
    );
    expect(await getResumableSession(exec, NOW)).toMatchObject({
      session: { id: old.sessionId, status: "complete" },
    });
  });

  it("stale-session auto-discard keeps imported photo work reachable", async () => {
    const old = await acceptRows(exec, ["committed"], "2026-08-29 10:00:00");
    const contactId = await seedContact(exec);
    await setRowContact(exec, old.rowIds[0], contactId, "imported", NOW);
    const newer = await acceptRows(exec, ["newer"], NOW);
    expect((await getResumableSession(exec, NOW))?.session.id).toBe(
      newer.sessionId,
    );
    expect(await getSessionById(exec, old.sessionId)).toMatchObject({
      status: "discarded",
    });
    expect((await listSessionRows(exec, old.sessionId))[0]).toMatchObject({
      photoRelPath: "import-staging/committed.jpg",
    });
    await exec.runAsync(
      "UPDATE import_sessions SET status = 'discarded' WHERE id = ?",
      [newer.sessionId],
    );
    expect((await getResumableSession(exec, NOW))?.session.id).toBe(
      old.sessionId,
    );
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

/** 38.4 D-57: the session carries its batch lifecycle; resume reads it back. */
describe("import-session-read batch lifecycle (D-57)", () => {
  it("reads a default session as Unbound with no cadence", async () => {
    const accepted = await acceptRows(exec, ["default"]);
    const session = await getSessionById(exec, accepted.sessionId);
    if (!session) throw new Error("missing session");
    expect(session).toMatchObject({
      batchTrackingEnabled: false,
      batchIntervalDays: null,
    });
    expect(sessionBatchLifecycle(session)).toEqual(UNBOUND_IMPORT);
  });

  it("reads a Bound session's cadence through both reads", async () => {
    const accepted = await acceptRows(exec, ["bound"]);
    await setSessionBatchDefaults(
      exec,
      accepted.sessionId,
      {
        categoryId: null,
        lifecycle: { trackingEnabled: true, intervalDays: 21 },
      },
      NOW,
    );
    const session = await getSessionById(exec, accepted.sessionId);
    if (!session) throw new Error("missing session");
    expect(session).toMatchObject({
      batchTrackingEnabled: true,
      batchIntervalDays: 21,
    });
    expect(sessionBatchLifecycle(session)).toEqual({
      trackingEnabled: true,
      intervalDays: 21,
    });
    const resumable = await getResumableSession(exec, NOW);
    expect(resumable?.session).toMatchObject({
      id: accepted.sessionId,
      batchTrackingEnabled: true,
      batchIntervalDays: 21,
    });
  });
});

/**
 * 38.12 D-58 (T-38.12-46): resume (`sessionBatchLifecycle`) and bulk setup's
 * restore (`initialBulkLifecycle`) read the same stored session through the one
 * shared `sanitiseImportLifecycle`, so they agree on every stored value.
 */
describe("import-session-read shares the lifecycle sanitiser with setup (D-58)", () => {
  it.each([
    [1, 21, { trackingEnabled: true, intervalDays: 21 }],
    [0, null, UNBOUND_IMPORT],
    [0, 30, UNBOUND_IMPORT],
  ] as const)(
    "stored tracking %s / cadence %s reads identically for resume and setup",
    async (tracking, days, expected) => {
      const accepted = await acceptRows(exec, [`parity-${tracking}-${days}`]);
      await exec.runAsync(
        "UPDATE import_sessions SET batch_tracking_enabled = ?, batch_interval_days = ? WHERE id = ?",
        [tracking, days, accepted.sessionId],
      );
      const session = await getSessionById(exec, accepted.sessionId);
      if (!session) throw new Error("missing session");
      expect(sessionBatchLifecycle(session)).toEqual(expected);
      expect(initialBulkLifecycle(session)).toEqual(expected);
      expect(
        sanitiseImportLifecycle({
          trackingEnabled: session.batchTrackingEnabled,
          intervalDays: session.batchIntervalDays,
        }),
      ).toEqual(expected);
    },
  );
});
