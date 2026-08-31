import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", () => ({
  deleteReconcileStaging: vi.fn(),
  listReconcileStagingPhotos: vi.fn(() => []),
}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { insertReconcileCard, createReconcileSession } from "@/db/reconcile-session-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  type ReconcileStagingFileSystem,
  type ResumableReconcile,
  reconcileOrphanReconcileStagedPhotos,
  registerReconcileResumeSweep,
} from "@/services/import/reconcile-resume-sweep";
import { __resetSweepForTest, runLaunchSweep } from "@/services/launch-sweep";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const uid = () => `reconcile-resume-${++uidCount}`;

function stagingFs(paths: string[] = []): ReconcileStagingFileSystem & { deleted: string[] } {
  const present = new Set(paths);
  const deleted: string[] = [];
  return {
    deleted,
    deleteReconcileStaging(relative) { deleted.push(relative); present.delete(relative); },
    listReconcileStagingPhotos() {
      return [...present].map((relative) => ({ relative, isStageTmpOrphan: false }));
    },
  };
}

beforeEach(async () => {
  uidCount = 0;
  __resetSweepForTest();
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uid });
});

async function seedCard(diffJson = JSON.stringify({ fields: [] }), path: string | null = "reconcile-staging/live.jpg") {
  const contact = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, 0, ?, ?)`,
    [uid(), "Orbit", NOW, NOW],
  );
  const sessionId = await createReconcileSession(exec, { uid: uid(), totalChecked: 1, now: NOW });
  await insertReconcileCard(exec, {
    uid: uid(), sessionId, contactId: contact.lastInsertRowId, cardStatus: "unresolved",
    diffJson, unresolvedCount: 1, stagedPhotoRelPath: path, now: NOW,
  });
  return sessionId;
}

describe("reconcile-resume-sweep", () => {
  it("reports a durable unresolved check through the registered launch hook", async () => {
    const sessionId = await seedCard();
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    registerReconcileResumeSweep(onResumable, { getExecutor: () => exec, now: () => NOW });

    await runLaunchSweep();

    expect(onResumable).toHaveBeenCalledWith({ sessionId, discardOnly: false });
  });

  it("turns a malformed card into a discard-only descriptor via the tolerant id read", async () => {
    const sessionId = await seedCard("not-json");
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    registerReconcileResumeSweep(onResumable, { getExecutor: () => exec, now: () => NOW });

    await expect(runLaunchSweep()).resolves.toBeUndefined();

    expect(onResumable).toHaveBeenCalledWith({ sessionId, discardOnly: true });
  });

  it("keeps live staged photos and removes abandoned reconciliation staging files", async () => {
    await seedCard(JSON.stringify({ fields: [] }), "reconcile-staging/live.jpg");
    const fs = stagingFs(["reconcile-staging/live.jpg", "reconcile-staging/orphan.jpg"]);

    await reconcileOrphanReconcileStagedPhotos(exec, fs);

    expect(fs.deleted).toEqual(["reconcile-staging/orphan.jpg"]);
  });

  it("does not register or run work merely by importing the module", async () => {
    await expect(runLaunchSweep()).resolves.toBeUndefined();
  });
});
