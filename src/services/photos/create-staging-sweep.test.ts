/**
 * Create-staging orphan sweep (38.11 D-77, RESEARCH A3): nothing in the
 * database references `create-staging/`, so every file there that no live Add
 * Contact form owns is an orphan (a discarded form, an app kill) and is
 * deleted; a live form's held photo is kept.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn() },
}));

import { __resetSweepForTest, runLaunchSweep } from "@/services/launch-sweep";
import {
  type CreateStagingFs,
  registerCreateStagingSweep,
  sweepOrphanCreateStaging,
} from "@/services/photos/create-staging-sweep";
import {
  __resetStagingSessionsForTest,
  beginStagingSession,
  endStagingSession,
} from "@/services/photos/staging-sessions";

function stagingFs(paths: string[]): CreateStagingFs & { deleted: string[] } {
  const present = new Set(paths);
  const deleted: string[] = [];
  return {
    deleted,
    listCreateStagingPhotos() {
      return [...present].map((relative) => ({
        relative,
        isStageTmpOrphan: relative.endsWith(".stage-tmp"),
      }));
    },
    deleteCreateStaging(relative) {
      deleted.push(relative);
      present.delete(relative);
    },
  };
}

beforeEach(() => {
  __resetStagingSessionsForTest();
  __resetSweepForTest();
});

describe("sweepOrphanCreateStaging (38.11 D-77)", () => {
  it("keeps an active form's held file and deletes every orphan", async () => {
    beginStagingSession("live");
    const fs = stagingFs([
      "create-staging/create-live-p1.jpg",
      "create-staging/create-live-p2.jpg.stage-tmp",
      "create-staging/create-gone-p1.jpg",
      "create-staging/create-gone-p2.jpg.stage-tmp",
    ]);
    await sweepOrphanCreateStaging(fs);
    expect(fs.deleted.sort()).toEqual([
      "create-staging/create-gone-p1.jpg",
      "create-staging/create-gone-p2.jpg.stage-tmp",
    ]);
  });

  it("after the form ends (discard, leave or kill) its file is swept", async () => {
    beginStagingSession("form");
    endStagingSession("form");
    const fs = stagingFs(["create-staging/create-form-p1.jpg"]);
    await sweepOrphanCreateStaging(fs);
    expect(fs.deleted).toEqual(["create-staging/create-form-p1.jpg"]);
  });

  it("an empty or missing folder is a no-op", async () => {
    const fs = stagingFs([]);
    await expect(sweepOrphanCreateStaging(fs)).resolves.toBeUndefined();
    expect(fs.deleted).toEqual([]);
  });

  it("a listing failure is logged, never thrown into the launch sweep", async () => {
    const fs: CreateStagingFs = {
      listCreateStagingPhotos() {
        throw new Error("unsafe create staging photo path");
      },
      deleteCreateStaging: vi.fn(),
    };
    await expect(sweepOrphanCreateStaging(fs)).resolves.toBeUndefined();
    expect(fs.deleteCreateStaging).not.toHaveBeenCalled();
  });

  it("registers on the launch sweep and runs only when the sweep runs", async () => {
    const fs = stagingFs(["create-staging/create-old-p1.jpg"]);
    registerCreateStagingSweep({ fs });
    expect(fs.deleted).toEqual([]);
    await runLaunchSweep();
    expect(fs.deleted).toEqual(["create-staging/create-old-p1.jpg"]);
  });
});
