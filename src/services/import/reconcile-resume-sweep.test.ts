import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", () => ({
  deleteReconcileStaging: vi.fn(),
  listReconcileStagingPhotos: vi.fn(() => []),
}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  createReconcileSession,
  insertReconcileCard,
} from "@/db/reconcile-session-dao";
import { getNewestResumableReconcileSession } from "@/db/reconcile-session-read";
import {
  clearReconcileResumePrompted,
  markReconcileResumePrompted,
} from "@/db/resume-prompt-dao";
import type { SqlExecutor } from "@/db/types";
import {
  holdReconcileStaging,
  markReconcileSessionOpen,
  withReconcileFlowActive,
} from "@/services/import/reconcile-flow-guard";
import {
  type ReconcileStagingFileSystem,
  type ResumableReconcile,
  readResumableReconcile,
  reconcileOrphanReconcileStagedPhotos,
  registerReconcileResumeSweep,
} from "@/services/import/reconcile-resume-sweep";
import { __resetSweepForTest, runLaunchSweep } from "@/services/launch-sweep";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const uid = () => `reconcile-resume-${++uidCount}`;

function stagingFs(
  paths: string[] = [],
): ReconcileStagingFileSystem & { deleted: string[] } {
  const present = new Set(paths);
  const deleted: string[] = [];
  return {
    deleted,
    deleteReconcileStaging(relative) {
      deleted.push(relative);
      present.delete(relative);
    },
    listReconcileStagingPhotos() {
      return [...present].map((relative) => ({
        relative,
        isStageTmpOrphan: false,
      }));
    },
  };
}

beforeEach(async () => {
  uidCount = 0;
  __resetSweepForTest();
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function seedCard(
  diffJson = JSON.stringify({ fields: [] }),
  path: string | null = "reconcile-staging/live.jpg",
) {
  const contact = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, 0, ?, ?)`,
    [uid(), "Orbit", NOW, NOW],
  );
  const sessionId = await createReconcileSession(exec, {
    uid: uid(),
    totalChecked: 1,
    now: NOW,
  });
  await insertReconcileCard(exec, {
    uid: uid(),
    sessionId,
    contactId: contact.lastInsertRowId,
    cardStatus: "unresolved",
    diffJson,
    unresolvedCount: 1,
    stagedPhotoRelPath: path,
    now: NOW,
  });
  return sessionId;
}

describe("reconcile-resume-sweep", () => {
  it("reports a durable unresolved check through the registered launch hook", async () => {
    const sessionId = await seedCard();
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    registerReconcileResumeSweep(onResumable, {
      getExecutor: () => exec,
      now: () => NOW,
    });

    await runLaunchSweep();

    expect(onResumable).toHaveBeenCalledWith({
      sessionId,
      discardOnly: false,
      cardsLeft: 1,
    });
  });

  it("skips the pass entirely while a scan is reading sources", async () => {
    await seedCard();
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    const fs = stagingFs(["reconcile-staging/not-yet-committed.jpg"]);
    registerReconcileResumeSweep(onResumable, {
      getExecutor: () => exec,
      fs,
      now: () => NOW,
    });

    await withReconcileFlowActive(() => runLaunchSweep());

    expect(onResumable).not.toHaveBeenCalled();
    expect(fs.deleted).toEqual([]);
  });

  it("does not offer to resume the check a reconcile screen is showing", async () => {
    const sessionId = await seedCard();
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    registerReconcileResumeSweep(onResumable, {
      getExecutor: () => exec,
      fs: stagingFs(["reconcile-staging/live.jpg"]),
      now: () => NOW,
    });

    const release = markReconcileSessionOpen(sessionId);
    await runLaunchSweep();
    expect(onResumable).toHaveBeenLastCalledWith(null);

    release();
    await runLaunchSweep();
    expect(onResumable).toHaveBeenLastCalledWith({
      sessionId,
      discardOnly: false,
      cardsLeft: 1,
    });
  });

  it("turns a malformed card into a discard-only descriptor", async () => {
    const sessionId = await seedCard("not-json");
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    registerReconcileResumeSweep(onResumable, {
      getExecutor: () => exec,
      now: () => NOW,
    });

    await expect(runLaunchSweep()).resolves.toBeUndefined();

    expect(onResumable).toHaveBeenCalledWith({
      sessionId,
      discardOnly: true,
      cardsLeft: 1,
    });
  });

  it("keeps live staged photos and removes abandoned reconciliation staging files", async () => {
    await seedCard(
      JSON.stringify({ fields: [] }),
      "reconcile-staging/live.jpg",
    );
    const fs = stagingFs([
      "reconcile-staging/live.jpg",
      "reconcile-staging/orphan.jpg",
    ]);

    await reconcileOrphanReconcileStagedPhotos(exec, fs);

    expect(fs.deleted).toEqual(["reconcile-staging/orphan.jpg"]);
  });

  it("asks once: a prompted check no longer triggers onResumable (D-105)", async () => {
    const sessionId = await seedCard();
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    registerReconcileResumeSweep(onResumable, {
      getExecutor: () => exec,
      now: () => NOW,
    });

    await runLaunchSweep();
    expect(onResumable).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionId }),
    );
    // The prompt mounted visible and wrote the marker.
    await markReconcileResumePrompted(exec, sessionId, NOW);
    await runLaunchSweep();
    expect(onResumable).toHaveBeenLastCalledWith(null);
    await runLaunchSweep();
    expect(onResumable).toHaveBeenLastCalledWith(null);
  });

  it("asks again once a resume clears the marker and the check is left again (L-3)", async () => {
    const sessionId = await seedCard();
    await markReconcileResumePrompted(exec, sessionId, NOW);
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    registerReconcileResumeSweep(onResumable, {
      getExecutor: () => exec,
      now: () => NOW,
    });

    await runLaunchSweep();
    expect(onResumable).toHaveBeenLastCalledWith(null);
    await clearReconcileResumePrompted(exec, sessionId);
    await runLaunchSweep();
    expect(onResumable).toHaveBeenLastCalledWith({
      sessionId,
      discardOnly: false,
      cardsLeft: 1,
    });
  });

  it("a prompted malformed check stays quiet too", async () => {
    const sessionId = await seedCard("not-json");
    await markReconcileResumePrompted(exec, sessionId, NOW);
    const onResumable = vi.fn<(value: ResumableReconcile | null) => void>();
    registerReconcileResumeSweep(onResumable, {
      getExecutor: () => exec,
      now: () => NOW,
    });
    await runLaunchSweep();
    expect(onResumable).toHaveBeenLastCalledWith(null);
  });

  it("does not register or run work merely by importing the module", async () => {
    await expect(runLaunchSweep()).resolves.toBeUndefined();
  });
});

describe("an open detail's staged photos survive the foreground sweep (38.12 review B-WR-02)", () => {
  it("keeps held detail copies, deletes them once released", async () => {
    const held = "reconcile-staging/detail-contact-4-link-7.jpg";
    const orphan = "reconcile-staging/old.jpg";
    const fs = stagingFs([held, orphan]);
    const release = holdReconcileStaging(held);
    await reconcileOrphanReconcileStagedPhotos(exec, fs);
    expect(fs.deleted).toEqual([orphan]);
    release();
    await reconcileOrphanReconcileStagedPhotos(exec, fs);
    expect(fs.deleted).toEqual([orphan, held]);
  });

  it("the detail tracker holds what it stages and lets go on clear", async () => {
    const { createDetailStagingTracker } = await import(
      "@/services/photos/reconcile-detail-staging"
    );
    const { isReconcileStagingHeld } = await import(
      "@/services/import/reconcile-flow-guard"
    );
    const deleted: string[] = [];
    const tracker = createDetailStagingTracker(
      (relative) => deleted.push(relative),
      holdReconcileStaging,
    );
    tracker.track("reconcile-staging/a.jpg");
    tracker.track("reconcile-staging/b.jpg");
    expect(isReconcileStagingHeld("reconcile-staging/a.jpg")).toBe(true);
    tracker.release("reconcile-staging/a.jpg");
    expect(isReconcileStagingHeld("reconcile-staging/a.jpg")).toBe(false);
    tracker.clear();
    expect(isReconcileStagingHeld("reconcile-staging/b.jpg")).toBe(false);
    expect(deleted).toEqual(["reconcile-staging/b.jpg"]);
  });
});

describe("Settings' Check linked contacts entry shares the sweep's description (38.12 D-IN-12)", () => {
  it("a malformed check read for Settings is discard-only, a sound one resumable", async () => {
    const newest = async () => {
      const pending = await getNewestResumableReconcileSession(exec);
      if (!pending) throw new Error("no pending check");
      return pending;
    };
    const bad = await seedCard("not-json");
    expect(await readResumableReconcile(exec, await newest())).toEqual({
      sessionId: bad,
      discardOnly: true,
      cardsLeft: 1,
    });
    const good = await seedCard();
    expect(await readResumableReconcile(exec, await newest())).toEqual({
      sessionId: good,
      discardOnly: false,
      cardsLeft: 1,
    });
  });

  it("the Settings entry builds its value through readResumableReconcile, never a hard-coded discardOnly", () => {
    const source = readFileSync(
      join(__dirname, "../../screens/SettingsContactsScreen.tsx"),
      "utf8",
    );
    expect(source).toContain(
      "setResumableReconcile(await readResumableReconcile(exec, pending));",
    );
    expect(source).not.toMatch(/discardOnly:\s*false/);
  });
});
