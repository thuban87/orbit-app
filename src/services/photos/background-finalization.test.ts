import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/photos/background-storage", () => ({
  backgroundDerivativeRelPath: (uid: string) =>
    `profile-backgrounds/${uid}.jpg`,
  resolveBackgroundRestorePendingUri: (relative: string) =>
    `pending:${relative}`,
  persistBackgroundDerivative: vi.fn(),
  deleteBackgroundRestorePending: vi.fn(),
}));

import { finalizeBackgroundRestoreCandidate } from "./background-finalization";

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function executor(initialPath: string) {
  const state = { imagePath: initialPath };
  return {
    state,
    exec: {
      async getFirstAsync() {
        return { imagePath: state.imagePath };
      },
      async runAsync(_sql: string, params?: unknown[]) {
        const [canonical, _uid, expected] = params as string[];
        if (state.imagePath !== expected) return { changes: 0 };
        state.imagePath = canonical;
        return { changes: 1 };
      },
      async execAsync() {},
      async getAllAsync() {
        return [];
      },
    } as never,
  };
}

const uid = "shared";
const canonical = `profile-backgrounds/${uid}.jpg`;
const pendingA = `profile-backgrounds/_restore_pending/${uid}/session-a.jpg`;
const pendingB = `profile-backgrounds/_restore_pending/${uid}/session-b.jpg`;

describe("background finalization ownership lock", () => {
  it("re-checks a discovered sweep candidate after a newer restore finalizes", async () => {
    const { exec, state } = executor(pendingA);
    const persisted: string[] = [];
    const deleted: string[] = [];
    const dependencies = {
      persist: async (source: string) => {
        persisted.push(source);
      },
      deletePending: (relative: string) => deleted.push(relative),
    };

    // Sweep A has discovered marker A, but pauses before entering the shared
    // finalizer. Restore B commits marker B and completes first.
    const discoveredBySweepA = { uid, pendingRelativePath: pendingA };
    state.imagePath = pendingB;
    await expect(
      finalizeBackgroundRestoreCandidate(
        exec,
        { uid, pendingRelativePath: pendingB },
        dependencies,
      ),
    ).resolves.toBe("finalized");
    await expect(
      finalizeBackgroundRestoreCandidate(
        exec,
        discoveredBySweepA,
        dependencies,
      ),
    ).resolves.toBe("stale");

    expect(state.imagePath).toBe(canonical);
    expect(persisted).toEqual([`pending:${pendingB}`]);
    expect(deleted).toEqual([pendingB, pendingA]);
  });

  it("serializes overlapping finalizers until the newer owner restores final bytes", async () => {
    const { exec, state } = executor(pendingA);
    const aStarted = deferred();
    const resumeA = deferred();
    const persisted: string[] = [];
    const deleted: string[] = [];
    const finalizeA = finalizeBackgroundRestoreCandidate(
      exec,
      { uid, pendingRelativePath: pendingA },
      {
        persist: async (source) => {
          persisted.push(source);
          aStarted.release();
          await resumeA.promise;
        },
        deletePending: (relative) => deleted.push(relative),
      },
    );
    await aStarted.promise;

    // A owns the UID lock. B commits while A is in filesystem I/O, then queues
    // on the same finalizer used by both restore and sweep.
    state.imagePath = pendingB;
    const finalizeB = finalizeBackgroundRestoreCandidate(
      exec,
      { uid, pendingRelativePath: pendingB },
      {
        persist: async (source) => persisted.push(source),
        deletePending: (relative) => deleted.push(relative),
      },
    );
    resumeA.release();

    await expect(finalizeA).resolves.toBe("stale");
    await expect(finalizeB).resolves.toBe("finalized");
    expect(state.imagePath).toBe(canonical);
    expect(persisted).toEqual([`pending:${pendingA}`, `pending:${pendingB}`]);
    expect(deleted).toEqual([pendingA, pendingB]);
  });
});
