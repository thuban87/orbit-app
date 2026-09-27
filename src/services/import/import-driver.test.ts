import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readPromptContext } from "@/db/ai-context-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  acceptImportSessionWithRows,
  setSessionBatchDefaults,
  UNBOUND_IMPORT,
} from "@/db/import-session-dao";
import { getResumableSession, listSessionRows } from "@/db/import-session-read";
import { importContactRecord } from "@/db/imported-contact-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { runImportBatch } from "@/services/import/import-driver";

const NOW = "2026-08-29 12:00:00";
let exec: SqlExecutor;
let counter = 0;
const uid = () => `import-driver-${++counter}`;

function payload(
  displayName: string | null,
  methods: Array<{ type: "phone" | "email"; value: string }> = [],
  note: string | null = null,
): string {
  return JSON.stringify({ displayName, methods, birthday: null, note });
}

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

async function createSession(
  rows: Array<{ externalContactId: string; sourcePayload: string }>,
  batchCategoryId: number | null = null,
): Promise<{ sessionId: number; rowIds: number[] }> {
  return acceptImportSessionWithRows(exec, {
    session: {
      uid: uid(),
      mode: "bulk",
      batchCategoryId,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: rows.map((row) => ({ ...row, uid: uid(), photoRelPath: null })),
  });
}

async function createLinkedContact(externalContactId: string): Promise<number> {
  const { contactId } = await importContactRecord(exec, {
    lifecycle: UNBOUND_IMPORT,
    input: {
      uid: uid(),
      name: "Already Orbit",
      intervalDays: null,
      trackingEnabled: false,
      now: NOW,
      categoryId: null,
      methodDrafts: [],
      methodNormalization: { effectivePhoneRegion: "US" },
    },
    externalLinks: [{ provider: "android", externalContactId }],
    birthday: null,
    now: NOW,
  });
  return contactId;
}

describe("runImportBatch", () => {
  it("keeps a bulk-imported note out of AI context under the ON default", async () => {
    await exec.runAsync(
      "UPDATE app_settings SET ai_default_memory_allow = 1 WHERE id = 1",
    );
    const session = await createSession([
      {
        externalContactId: "note",
        sourcePayload: payload("Note Person", [], "Private note"),
      },
    ]);
    await runImportBatch(exec, { sessionId: session.sessionId, now: NOW });
    const row = (await listSessionRows(exec, session.sessionId))[0];
    if (row.contactId === null) throw new Error("bulk import did not commit");
    expect(
      await exec.getFirstAsync<{ allow_ai: number }>(
        "SELECT allow_ai FROM memories WHERE contact_id = ?",
        [row.contactId],
      ),
    ).toEqual({ allow_ai: 0 });
    expect(
      (await readPromptContext(exec, row.contactId, NOW)).sharedMemories,
    ).toEqual([]);
  });
  it("imports safe rows, atomically classifies linked and ambiguous rows, and isolates failures", async () => {
    const linkedContactId = await createLinkedContact("already-linked");
    await importContactRecord(exec, {
      lifecycle: UNBOUND_IMPORT,
      input: {
        uid: uid(),
        name: "Ambiguous Orbit",
        intervalDays: null,
        trackingEnabled: false,
        now: NOW,
        categoryId: null,
        methodDrafts: [{ uid: uid(), type: "phone", value: "312 555 0199" }],
        methodNormalization: { effectivePhoneRegion: "US" },
      },
      externalLinks: [],
      birthday: null,
      now: NOW,
    });
    const session = await createSession([
      {
        externalContactId: "new",
        sourcePayload: payload("New Person", [
          { type: "phone", value: "312 555 0100" },
        ]),
      },
      {
        externalContactId: "already-linked",
        sourcePayload: payload("Linked Person", [], "Do not import this"),
      },
      {
        externalContactId: "ambiguous",
        sourcePayload: payload("Ambiguous Person", [
          { type: "phone", value: "312 555 0199" },
        ]),
      },
      { externalContactId: "broken", sourcePayload: "not-json" },
    ]);
    const progress: Array<[number, number]> = [];

    await expect(
      runImportBatch(exec, {
        sessionId: session.sessionId,
        now: NOW,
        onProgress: (done, total) => progress.push([done, total]),
      }),
    ).resolves.toEqual({
      imported: 1,
      alreadyInOrbit: 1,
      needReview: 1,
      failedOrSkipped: 1,
      nameRequiredSkipped: 0,
      birthdayUnreadable: 0,
    });
    const rows = await listSessionRows(exec, session.sessionId);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalContactId: "new",
          rowStatus: "imported",
          matchOutcome: "new",
          contactId: expect.any(Number),
        }),
        expect.objectContaining({
          externalContactId: "already-linked",
          rowStatus: "skipped",
          matchOutcome: "already_linked",
          matchedContactId: linkedContactId,
        }),
        expect.objectContaining({
          externalContactId: "ambiguous",
          rowStatus: "needs_review",
          matchOutcome: "needs_review",
          candidates: expect.arrayContaining([
            expect.objectContaining({ contactId: expect.any(Number) }),
          ]),
        }),
        expect.objectContaining({
          externalContactId: "broken",
          rowStatus: "failed",
        }),
      ]),
    );
    expect(progress).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ]);
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM memories WHERE contact_id = ? AND type = 'imported'",
        [linkedContactId],
      ),
    ).toEqual({ count: 0 });
  });

  it("skips a blank bulk name, finalizes before a completion screen mounts, and honors durable batch category", async () => {
    const category = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories ORDER BY id LIMIT 1",
    );
    if (!category) throw new Error("expected seeded category");
    const session = await createSession([
      { externalContactId: "blank", sourcePayload: payload("   ") },
      {
        externalContactId: "categorized",
        sourcePayload: payload("Categorized"),
      },
    ]);
    await setSessionBatchDefaults(
      exec,
      session.sessionId,
      { categoryId: category.id, lifecycle: UNBOUND_IMPORT },
      NOW,
    );

    await runImportBatch(exec, { sessionId: session.sessionId, now: NOW });
    expect(await listSessionRows(exec, session.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalContactId: "blank",
          rowStatus: "skipped",
          failureReason: "name-required",
          contactId: null,
        }),
        expect.objectContaining({
          externalContactId: "categorized",
          rowStatus: "imported",
        }),
      ]),
    );
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM contacts WHERE trim(name) = ''",
      ),
    ).toEqual({ count: 0 });
    expect(
      await exec.getFirstAsync<{ category_id: number | null }>(
        "SELECT category_id FROM contacts WHERE name = 'Categorized'",
      ),
    ).toEqual({ category_id: category.id });
    await expect(getResumableSession(exec, NOW)).resolves.toBeNull();
  });

  it("retries failed rows without double-importing a row that already has a contact", async () => {
    const session = await createSession([
      {
        externalContactId: "retryable",
        sourcePayload: payload("Retryable"),
      },
      {
        externalContactId: "already-created",
        sourcePayload: payload("Existing"),
      },
    ]);
    const firstRows = await listSessionRows(exec, session.sessionId);
    await importContactRecord(exec, {
      lifecycle: UNBOUND_IMPORT,
      input: {
        uid: uid(),
        name: "Existing",
        intervalDays: null,
        trackingEnabled: false,
        now: NOW,
        categoryId: null,
        methodDrafts: [],
        methodNormalization: { effectivePhoneRegion: "US" },
      },
      externalLinks: [
        { provider: "android", externalContactId: "already-created" },
      ],
      birthday: null,
      now: NOW,
      resolveRow: { rowId: firstRows[1].id, matchOutcome: "new" },
    });
    await exec.runAsync(
      "UPDATE import_session_rows SET row_status = 'failed' WHERE id IN (?, ?)",
      [firstRows[0].id, firstRows[1].id],
    );

    await runImportBatch(exec, {
      sessionId: session.sessionId,
      now: NOW,
      eligibleStatuses: ["pending", "failed"],
    });
    expect(await listSessionRows(exec, session.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalContactId: "retryable",
          rowStatus: "imported",
        }),
        expect.objectContaining({
          externalContactId: "already-created",
          contactId: expect.any(Number),
        }),
      ]),
    );
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM contacts",
      ),
    ).toEqual({ count: 2 });
  });
});

/**
 * 38.4 D-57 (owner, OA-E2): every contact the driver creates gets the batch
 * lifecycle from the durable session — including after a resume, which calls
 * `runImportBatch` again with no in-pass lifecycle.
 */
describe("runImportBatch batch lifecycle (D-57)", () => {
  async function lifecycles() {
    return exec.getAllAsync<{
      name: string;
      tracking_enabled: number;
      interval_days: number | null;
      category_id: number | null;
    }>(
      "SELECT name, tracking_enabled, interval_days, category_id FROM contacts ORDER BY name",
    );
  }

  it("imports every new row Bound at the session cadence, with the chosen category", async () => {
    const category = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories ORDER BY id LIMIT 1",
    );
    if (!category) throw new Error("expected seeded category");
    const session = await createSession([
      { externalContactId: "a", sourcePayload: payload("Alpha") },
      { externalContactId: "b", sourcePayload: payload("Beta") },
    ]);
    await setSessionBatchDefaults(
      exec,
      session.sessionId,
      {
        categoryId: category.id,
        lifecycle: { trackingEnabled: true, intervalDays: 14 },
      },
      NOW,
    );

    const effects = vi.fn(async () => {});
    await runImportBatch(exec, {
      sessionId: session.sessionId,
      now: NOW,
      effects,
    });

    expect(effects).toHaveBeenCalledTimes(1);
    expect(effects).toHaveBeenCalledWith(exec);
    expect(await lifecycles()).toEqual([
      {
        name: "Alpha",
        tracking_enabled: 1,
        interval_days: 14,
        category_id: category.id,
      },
      {
        name: "Beta",
        tracking_enabled: 1,
        interval_days: 14,
        category_id: category.id,
      },
    ]);
  });

  it("keeps a default session Unbound with no cadence", async () => {
    const session = await createSession([
      { externalContactId: "u", sourcePayload: payload("Unbound Person") },
    ]);
    const effects = vi.fn(async () => {});
    await runImportBatch(exec, {
      sessionId: session.sessionId,
      now: NOW,
      effects,
    });
    expect(effects).not.toHaveBeenCalled();
    expect(await lifecycles()).toEqual([
      {
        name: "Unbound Person",
        tracking_enabled: 0,
        interval_days: null,
        category_id: null,
      },
    ]);
    expect(UNBOUND_IMPORT).toEqual({
      trackingEnabled: false,
      intervalDays: null,
    });
  });

  it("a resumed pass reads the Bound lifecycle from the session", async () => {
    const session = await createSession([
      { externalContactId: "first", sourcePayload: payload("First") },
      { externalContactId: "second", sourcePayload: payload("Second") },
    ]);
    await setSessionBatchDefaults(
      exec,
      session.sessionId,
      {
        categoryId: null,
        lifecycle: { trackingEnabled: true, intervalDays: 14 },
      },
      NOW,
    );
    const [firstRow] = await listSessionRows(exec, session.sessionId);
    await exec.runAsync(
      "UPDATE import_session_rows SET row_status = 'failed' WHERE id = ?",
      [firstRow.id],
    );
    // First pass: only the failed row — the pending row is left for resume.
    await runImportBatch(exec, {
      sessionId: session.sessionId,
      now: NOW,
      eligibleStatuses: ["failed"],
      effects: async () => {},
    });
    expect(
      (await listSessionRows(exec, session.sessionId)).map(
        (row) => row.rowStatus,
      ),
    ).toEqual(["imported", "pending"]);

    // Resume, exactly as ImportProgress calls it (plus a test-only effects spy).
    await runImportBatch(exec, {
      sessionId: session.sessionId,
      now: NOW,
      effects: async () => {},
    });

    expect(await lifecycles()).toEqual([
      {
        name: "First",
        tracking_enabled: 1,
        interval_days: 14,
        category_id: null,
      },
      {
        name: "Second",
        tracking_enabled: 1,
        interval_days: 14,
        category_id: null,
      },
    ]);
  });

  it("runs the effects after finalize, only when the Bound pass created a contact", async () => {
    const session = await createSession([
      { externalContactId: "e1", sourcePayload: payload("Effect One") },
    ]);
    await setSessionBatchDefaults(
      exec,
      session.sessionId,
      {
        categoryId: null,
        lifecycle: { trackingEnabled: true, intervalDays: 7 },
      },
      NOW,
    );
    const statusAtEffect: unknown[] = [];
    const effects = vi.fn(async (target: SqlExecutor) => {
      statusAtEffect.push(
        await target.getFirstAsync(
          "SELECT status FROM import_sessions WHERE id = ?",
          [session.sessionId],
        ),
      );
    });
    await runImportBatch(exec, {
      sessionId: session.sessionId,
      now: NOW,
      effects,
    });
    expect(effects).toHaveBeenCalledTimes(1);
    expect(statusAtEffect).toEqual([{ status: "complete" }]);

    // A second pass on the same (now complete) Bound session creates nothing.
    const again = vi.fn(async () => {});
    await runImportBatch(exec, {
      sessionId: session.sessionId,
      now: NOW,
      effects: again,
    });
    expect(again).not.toHaveBeenCalled();
  });

  it("a throwing effect changes neither the returned counts nor the rows", async () => {
    const session = await createSession([
      { externalContactId: "t1", sourcePayload: payload("Quinn Harlow") },
      { externalContactId: "t2", sourcePayload: payload("Riley Voss") },
    ]);
    await setSessionBatchDefaults(
      exec,
      session.sessionId,
      {
        categoryId: null,
        lifecycle: { trackingEnabled: true, intervalDays: 7 },
      },
      NOW,
    );
    const counts = await runImportBatch(exec, {
      sessionId: session.sessionId,
      now: NOW,
      effects: async () => {
        throw new Error("effects down");
      },
    });
    expect(counts.imported).toBe(2);
    expect(
      (await listSessionRows(exec, session.sessionId)).map(
        (row) => row.rowStatus,
      ),
    ).toEqual(["imported", "imported"]);
  });
});
