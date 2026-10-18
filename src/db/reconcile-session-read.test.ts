import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  createReconcileSession,
  insertReconcileCard,
  markCardStatus,
  markCardStatusCore,
  setCardCompletionDispositionCore,
} from "@/db/reconcile-session-dao";
import {
  getNewestPendingReconcileSessionId,
  getResumableReconcileSession,
  listReconcileCardIdentities,
  reconcileCompletionCounts,
} from "@/db/reconcile-session-read";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const newUid = () => `read-uid-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
});

async function seedContact(
  target: SqlExecutor,
  name = "Linked",
): Promise<number> {
  const result = await target.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newUid(), name, 0, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedSession(
  target: SqlExecutor,
  createdAt = NOW,
): Promise<number> {
  return createReconcileSession(target, {
    uid: newUid(),
    totalChecked: 2,
    now: createdAt,
  });
}

async function seedCard(
  target: SqlExecutor,
  sessionId: number,
  status:
    | "unresolved"
    | "partial"
    | "resolved"
    | "missing_source" = "unresolved",
  disposition: "updated" | "kept-orbit" | null = null,
): Promise<void> {
  await insertReconcileCard(target, {
    uid: newUid(),
    sessionId,
    contactId: await seedContact(target),
    cardStatus: status,
    diffJson: JSON.stringify({ completionDisposition: disposition }),
    unresolvedCount:
      status === "resolved" || status === "missing_source" ? 0 : 1,
    stagedPhotoRelPath:
      status === "unresolved" ? "reconcile-staging/card.jpg" : null,
    now: NOW,
  });
}

describe("reconcile-session-read", () => {
  it("survives a database close and reopen with the same unresolved work", async () => {
    const folder = mkdtempSync(join(tmpdir(), "orbit-reconcile-session-"));
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
      const sessionId = await seedSession(firstExec);
      await seedCard(firstExec, sessionId, "partial");
      first.close();
      first = null;

      reopened = new DatabaseSync(dbPath);
      reopened.exec("PRAGMA foreign_keys = ON");
      const resumed = await getResumableReconcileSession(
        nodeSqliteExecutor(reopened),
        NOW,
      );
      expect(resumed).toMatchObject({
        session: { id: sessionId, totalChecked: 2 },
        cards: [{ cardStatus: "partial", unresolvedCount: 1 }],
        sweptStagedPhotoRelPaths: [],
      });
    } finally {
      first?.close();
      reopened?.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("keeps the newest pending session and sweeps older staged work", async () => {
    const older = await seedSession(exec, "2026-08-30 11:00:00");
    await seedCard(exec, older);
    const newest = await seedSession(exec, NOW);
    await seedCard(exec, newest);

    await expect(
      getResumableReconcileSession(exec, NOW),
    ).resolves.toMatchObject({
      session: { id: newest },
      sweptStagedPhotoRelPaths: ["reconcile-staging/card.jpg"],
    });
    expect(
      await exec.getFirstAsync<{ status: string }>(
        "SELECT status FROM reconciliation_sessions WHERE id = ?",
        [older],
      ),
    ).toEqual({ status: "discarded" });
  });

  it("returns grouped completion buckets", async () => {
    const sessionId = await seedSession(exec);
    await seedCard(exec, sessionId, "resolved", "updated");
    await seedCard(exec, sessionId, "missing_source");
    await expect(reconcileCompletionCounts(exec, sessionId)).resolves.toEqual({
      checked: 2,
      changed: 2,
      updated: 1,
      keptOrbitValues: 0,
      sourceMissing: 1,
      unresolved: 0,
    });
  });

  it("counts a detail-applied card and not a partial one (D-45, D-50)", async () => {
    const sessionId = await seedSession(exec);
    const card = async (status: "unresolved") =>
      insertReconcileCard(exec, {
        uid: newUid(),
        sessionId,
        contactId: await seedContact(exec),
        cardStatus: status,
        diffJson: JSON.stringify({ fields: [], completionDisposition: null }),
        unresolvedCount: 1,
        stagedPhotoRelPath: "reconcile-staging/card.jpg",
        now: NOW,
      });
    const applied = await card("unresolved");
    const partial = await card("unresolved");
    // The detail Apply: a finished card records its disposition with its status.
    await inWriteTransaction(exec, async () => {
      await markCardStatusCore(exec, applied, "resolved", 0, NOW);
      await setCardCompletionDispositionCore(exec, {
        cardId: applied,
        disposition: "kept-orbit",
        now: NOW,
      });
    });
    // A partial card records none.
    await markCardStatus(exec, partial, "partial", 1, NOW);
    await expect(reconcileCompletionCounts(exec, sessionId)).resolves.toEqual({
      checked: 2,
      changed: 2,
      updated: 0,
      keptOrbitValues: 1,
      sourceMissing: 0,
      unresolved: 1,
    });
    const rows = await exec.getAllAsync<{
      id: number;
      staged_photo_rel_path: string | null;
    }>(
      "SELECT id, staged_photo_rel_path FROM reconciliation_session_cards ORDER BY id",
    );
    // A resolved card drops its staged path; the partial card keeps it.
    expect(rows).toEqual([
      { id: applied, staged_photo_rel_path: null },
      { id: partial, staged_photo_rel_path: "reconcile-staging/card.jpg" },
    ]);
    await expect(
      setCardCompletionDispositionCore(exec, {
        cardId: 9999,
        disposition: "updated",
        now: NOW,
      }),
    ).rejects.toThrow("setCardCompletionDispositionCore");
  });

  it("counts are exclusive: a missing-source card is never also a Kept Orbit value (D-141)", async () => {
    const sessionId = await seedSession(exec);
    await seedCard(exec, sessionId, "resolved", "updated");
    await seedCard(exec, sessionId, "resolved", "kept-orbit");
    // The grid's bulk Keep Orbit finishes a missing-source card with a
    // "kept-orbit" disposition; it counts once, under Source missing.
    await seedCard(exec, sessionId, "missing_source", "kept-orbit");
    await seedCard(exec, sessionId, "missing_source");
    await seedCard(exec, sessionId, "partial");
    const counts = await reconcileCompletionCounts(exec, sessionId);
    expect(counts).toMatchObject({
      changed: 5,
      updated: 1,
      keptOrbitValues: 1,
      sourceMissing: 2,
      unresolved: 1,
    });
    expect(
      counts.updated +
        counts.keptOrbitValues +
        counts.sourceMissing +
        counts.unresolved,
    ).toBe(counts.changed);
  });

  it("gets the newest pending id without reading malformed card payloads", async () => {
    const older = await seedSession(exec, "2026-08-30 11:00:00");
    const newest = await seedSession(exec, NOW);
    await exec.runAsync(
      `INSERT INTO reconciliation_session_cards
       (uid, session_id, contact_id, diff_json, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newUid(), newest, await seedContact(exec), "not-json", NOW, NOW],
    );
    await expect(getNewestPendingReconcileSessionId(exec)).resolves.toBe(
      newest,
    );
    expect(older).toBeLessThan(newest);
  });
});

describe("listReconcileCardIdentities", () => {
  it("names review cards by the live contact, never a database id", async () => {
    const ada = await seedContact(exec, "Ada Lovelace");
    const grace = await seedContact(exec, "Grace Hopper");
    await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
      `avatars/contact-${grace}.jpg`,
      grace,
    ]);

    const identities = await listReconcileCardIdentities(exec, [
      ada,
      grace,
      ada,
      999,
    ]);

    expect(identities.get(ada)).toEqual({
      contactId: ada,
      name: "Ada Lovelace",
      photo: null,
    });
    expect(identities.get(grace)?.photo).toBe(`avatars/contact-${grace}.jpg`);
    expect(identities.has(999)).toBe(false);
    expect(await listReconcileCardIdentities(exec, [])).toEqual(new Map());
  });
});
