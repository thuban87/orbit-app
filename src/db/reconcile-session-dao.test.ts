import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  createReconcileSession,
  createReconcileSessionCore,
  discardSession,
  finalizeSessionIfTerminal,
  insertReconcileCard,
  insertReconcileCardCore,
  markCardStatus,
  markCardStatusCore,
  type ReconcileCardStatus,
} from "@/db/reconcile-session-dao";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const newUid = () => `reconcile-uid-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
});

async function seedContact(name = "Linked person"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newUid(), name, 0, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedCard(
  sessionId: number,
  contactId: number,
  status: ReconcileCardStatus = "unresolved",
  stagedPhotoRelPath: string | null = null,
): Promise<number> {
  return insertReconcileCard(exec, {
    uid: newUid(),
    sessionId,
    contactId,
    cardStatus: status,
    diffJson: JSON.stringify({ fields: [] }),
    unresolvedCount: status === "resolved" || status === "missing_source" ? 0 : 1,
    stagedPhotoRelPath,
    now: NOW,
  });
}

describe("reconcile-session-dao", () => {
  it("creates a durable session and cards through the composable cores", async () => {
    const contactId = await seedContact();
    let sessionId = 0;
    let cardId = 0;
    await inWriteTransaction(exec, async () => {
      sessionId = await createReconcileSessionCore(exec, {
        uid: newUid(),
        totalChecked: 1,
        now: NOW,
      });
      cardId = await insertReconcileCardCore(exec, {
        uid: newUid(),
        sessionId,
        contactId,
        cardStatus: "unresolved",
        diffJson: JSON.stringify({ fields: ["name"] }),
        unresolvedCount: 1,
        stagedPhotoRelPath: "reconcile-staging/a.jpg",
        now: NOW,
      });
    });

    expect(cardId).toBeGreaterThan(0);
    expect(
      await exec.getFirstAsync<{
        total_checked: number;
        card_status: string;
        unresolved_count: number;
        staged_photo_rel_path: string | null;
      }>(
        `SELECT s.total_checked, c.card_status, c.unresolved_count, c.staged_photo_rel_path
         FROM reconciliation_sessions s
         JOIN reconciliation_session_cards c ON c.session_id = s.id
         WHERE c.id = ?`,
        [cardId],
      ),
    ).toEqual({
      total_checked: 1,
      card_status: "unresolved",
      unresolved_count: 1,
      staged_photo_rel_path: "reconcile-staging/a.jpg",
    });
  });

  it("marks a card's status and unresolved count with exact-row protection", async () => {
    const sessionId = await createReconcileSession(exec, {
      uid: newUid(),
      totalChecked: 1,
      now: NOW,
    });
    const cardId = await seedCard(sessionId, await seedContact());
    await markCardStatus(exec, cardId, "partial", 2, "2026-08-30 12:01:00");
    expect(
      await exec.getFirstAsync<{ card_status: string; unresolved_count: number }>(
        "SELECT card_status, unresolved_count FROM reconciliation_session_cards WHERE id = ?",
        [cardId],
      ),
    ).toEqual({ card_status: "partial", unresolved_count: 2 });
    await expect(markCardStatusCore(exec, 999, "resolved", 0, NOW)).rejects.toThrow(
      "markCardStatusCore: no row matched id=999",
    );
  });

  it("finalizes only when every card is terminal", async () => {
    const sessionId = await createReconcileSession(exec, {
      uid: newUid(),
      totalChecked: 2,
      now: NOW,
    });
    const first = await seedCard(sessionId, await seedContact("First"));
    await seedCard(sessionId, await seedContact("Second"), "missing_source");
    await expect(finalizeSessionIfTerminal(exec, sessionId, NOW)).resolves.toBe(false);
    await markCardStatus(exec, first, "resolved", 0, NOW);
    await expect(finalizeSessionIfTerminal(exec, sessionId, NOW)).resolves.toBe(true);
    expect(
      await exec.getFirstAsync<{ status: string }>(
        "SELECT status FROM reconciliation_sessions WHERE id = ?",
        [sessionId],
      ),
    ).toEqual({ status: "complete" });
  });

  it("discards unresolved cards only and returns their staged paths", async () => {
    const sessionId = await createReconcileSession(exec, {
      uid: newUid(),
      totalChecked: 2,
      now: NOW,
    });
    await seedCard(
      sessionId,
      await seedContact("Unresolved"),
      "unresolved",
      "reconcile-staging/unresolved.jpg",
    );
    await seedCard(
      sessionId,
      await seedContact("Resolved"),
      "resolved",
      "reconcile-staging/resolved.jpg",
    );

    await expect(discardSession(exec, sessionId, NOW)).resolves.toEqual([
      "reconcile-staging/unresolved.jpg",
    ]);
    expect(
      await exec.getAllAsync<{ card_status: string }>(
        "SELECT card_status FROM reconciliation_session_cards WHERE session_id = ?",
        [sessionId],
      ),
    ).toEqual([{ card_status: "resolved" }]);
  });
});
