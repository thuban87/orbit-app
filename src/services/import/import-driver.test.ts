import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  acceptImportSessionWithRows,
  setSessionBatchCategory,
} from "@/db/import-session-dao";
import { importContactRecord } from "@/db/imported-contact-dao";
import { listSessionRows } from "@/db/import-session-read";
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
): string {
  return JSON.stringify({ displayName, methods, birthday: null });
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
  it("imports safe rows, atomically classifies linked and ambiguous rows, and isolates failures", async () => {
    const linkedContactId = await createLinkedContact("already-linked");
    await importContactRecord(exec, {
      input: {
        uid: uid(), name: "Ambiguous Orbit", intervalDays: null, trackingEnabled: false,
        now: NOW, categoryId: null,
        methodDrafts: [{ uid: uid(), type: "phone", value: "312 555 0199" }],
        methodNormalization: { effectivePhoneRegion: "US" },
      }, externalLinks: [], birthday: null, now: NOW,
    });
    const session = await createSession([
      { externalContactId: "new", sourcePayload: payload("New Person", [{ type: "phone", value: "312 555 0100" }]) },
      { externalContactId: "already-linked", sourcePayload: payload("Linked Person") },
      { externalContactId: "ambiguous", sourcePayload: payload("Ambiguous Person", [{ type: "phone", value: "312 555 0199" }]) },
      { externalContactId: "broken", sourcePayload: "not-json" },
    ]);
    const progress: Array<[number, number]> = [];

    await expect(runImportBatch(exec, { sessionId: session.sessionId, now: NOW, onProgress: (done, total) => progress.push([done, total]) })).resolves.toEqual({
      imported: 1, alreadyInOrbit: 1, needReview: 1, failedOrSkipped: 1,
    });
    const rows = await listSessionRows(exec, session.sessionId);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalContactId: "new", rowStatus: "imported", matchOutcome: "new", contactId: expect.any(Number) }),
      expect.objectContaining({ externalContactId: "already-linked", rowStatus: "skipped", matchOutcome: "already_linked", matchedContactId: linkedContactId }),
      expect.objectContaining({ externalContactId: "ambiguous", rowStatus: "needs_review", matchOutcome: "probable", candidates: [expect.objectContaining({ contactId: expect.any(Number) })] }),
      expect.objectContaining({ externalContactId: "broken", rowStatus: "failed" }),
    ]));
    expect(progress).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
  });

  it("fails a blank name without creating a contact and honors durable batch category", async () => {
    const category = await exec.getFirstAsync<{ id: number }>("SELECT id FROM categories ORDER BY id LIMIT 1");
    if (!category) throw new Error("expected seeded category");
    const session = await createSession([
      { externalContactId: "blank", sourcePayload: payload("   ") },
      { externalContactId: "categorized", sourcePayload: payload("Categorized") },
    ]);
    await setSessionBatchCategory(exec, session.sessionId, category.id, NOW);

    await runImportBatch(exec, { sessionId: session.sessionId, now: NOW });
    expect(await listSessionRows(exec, session.sessionId)).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalContactId: "blank", rowStatus: "failed", failureReason: "name-required", contactId: null }),
      expect.objectContaining({ externalContactId: "categorized", rowStatus: "imported" }),
    ]));
    expect(await exec.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM contacts WHERE trim(name) = ''")).toEqual({ count: 0 });
    expect(await exec.getFirstAsync<{ category_id: number | null }>("SELECT category_id FROM contacts WHERE name = 'Categorized'")).toEqual({ category_id: category.id });
  });
});
