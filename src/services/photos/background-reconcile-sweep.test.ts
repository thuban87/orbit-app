import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  entries: [] as string[],
  pending: [] as Array<{
    relative: string;
    templateUid: string;
  }>,
  bytes: new Map<string, string>(),
  operations: [] as string[],
  fail: new Set<string>(),
  pendingRead: null as
    | null
    | (() => Promise<Array<{ relative: string; templateUid: string }>>),
}));

vi.mock("expo-file-system", () => ({
  Directory: class {},
  File: class {},
  Paths: { document: { uri: "file:///doc" } },
}));
vi.mock("@/services/photos/background-storage", () => ({
  reconcileBackgroundDir: (
    entries: string[],
  ): Array<Record<string, string>> => {
    const present = new Set(entries);
    const actions: Array<Record<string, string>> = [];
    for (const entry of entries) {
      if (entry.endsWith(".jpg.tmp")) {
        actions.push({
          kind: "deleteTmp",
          relative: `profile-backgrounds/${entry}`,
        });
        continue;
      }
      if (!entry.endsWith(".jpg.bak")) continue;
      const canonical = entry.slice(0, -4);
      actions.push(
        present.has(canonical)
          ? { kind: "deleteBak", relative: `profile-backgrounds/${entry}` }
          : {
              kind: "restoreBak",
              from: `profile-backgrounds/${entry}`,
              to: `profile-backgrounds/${canonical}`,
            },
      );
    }
    return actions;
  },
  listBackgroundStorageEntries: () => [...h.entries],
  listBackgroundRestorePendingEntries: async () =>
    h.pendingRead ? h.pendingRead() : [...h.pending],
  backgroundDerivativeRelPath: (uid: string) =>
    `profile-backgrounds/${uid}.jpg`,
  resolveBackgroundRestorePendingUri: (relative: string) =>
    `pending:${relative}`,
  persistBackgroundDerivative: async (source: string, destination: string) => {
    if (h.fail.has(`persist:${source}`))
      throw new Error("injected copy failure");
    h.operations.push(`persist ${source} -> ${destination}`);
    h.bytes.set(destination, h.bytes.get(source)!);
  },
  deleteBackgroundRestorePending: (relative: string) => {
    if (h.fail.has(`deletePending:${relative}`))
      throw new Error("injected delete failure");
    h.operations.push(`deletePending ${relative}`);
    h.pending = h.pending.filter((entry) => entry.relative !== relative);
  },
  deleteBackgroundDerivative: (relative: string) => {
    if (h.fail.has(`deleteCanonical:${relative}`))
      throw new Error("injected delete failure");
    h.operations.push(`deleteCanonical ${relative}`);
    h.bytes.delete(relative);
  },
  applyBackgroundReconcileAction: async (action: {
    kind: string;
    from?: string;
    to?: string;
    relative?: string;
  }) => {
    if (h.fail.has(`action:${action.kind}`))
      throw new Error("injected action failure");
    h.operations.push(action.kind);
    if (action.kind === "restoreBak")
      h.bytes.set(action.to!, h.bytes.get(action.from!)!);
  },
}));

import {
  __resetSweepForTest,
  registerSweepHook,
  runLaunchSweep,
  SWEEP_IDS,
} from "@/services/launch-sweep";
import { finalizeBackgroundRestoreCandidate } from "./background-finalization";
import { planBackgroundReconciliation } from "./background-reconcile-model";
import {
  registerBackgroundReconcileSweep,
  runBackgroundReconciliation,
} from "./background-reconcile-sweep";
import {
  __resetStagingSessionsForTest,
  beginStagingSession,
  endStagingSession,
} from "./staging-sessions";

beforeEach(() => {
  h.entries = [];
  h.pending = [];
  h.bytes = new Map();
  h.operations = [];
  h.pendingRead = null;
  h.fail.clear();
  __resetSweepForTest();
  __resetStagingSessionsForTest();
});

function execFor(imagePaths: Record<string, string>) {
  const rows = new Map(
    Object.entries(imagePaths).map(([uid, imagePath]) => [
      uid,
      { uid, imagePath, modifiedAt: "same-version" },
    ]),
  );
  return {
    getAllAsync: async () => [...rows.values()],
    getFirstAsync: async (_sql: string, params?: unknown[]) => {
      const row = rows.get(String(params?.[0]));
      return row ? { imagePath: row.imagePath } : null;
    },
    runAsync: async (_sql: string, params?: unknown[]) => {
      const [canonical, uid, expected] = params as string[];
      const row = rows.get(uid);
      if (!row || row.imagePath !== expected) return { changes: 0 };
      row.imagePath = canonical;
      h.operations.push(`finalize ${expected} -> ${canonical}`);
      return { changes: 1 };
    },
    execAsync: async () => undefined,
  } as never;
}

function pending(uid: string, bytes: string, session = "session") {
  const relative = `profile-backgrounds/_restore_pending/${uid}/${session}.jpg`;
  h.pending.push({
    relative,
    templateUid: uid,
  });
  h.bytes.set(`pending:${relative}`, bytes);
  return relative;
}

describe("background launch reconciliation plan", () => {
  it("keeps a canonical file committed after the pass-start row snapshot", async () => {
    h.entries = ["new.jpg"];
    h.bytes.set("profile-backgrounds/new.jpg", "new bytes");
    let reads = 0;
    const exec = {
      getAllAsync: async () => {
        reads += 1;
        return reads === 1
          ? []
          : [{ uid: "new", imagePath: "profile-backgrounds/new.jpg" }];
      },
      getFirstAsync: async () => null,
      runAsync: async () => ({ changes: 0 }),
      execAsync: async () => undefined,
    } as never;
    await runBackgroundReconciliation(exec);
    expect(h.bytes.get("profile-backgrounds/new.jpg")).toBe("new bytes");
    expect(h.operations).not.toContain(
      "deleteCanonical profile-backgrounds/new.jpg",
    );
  });

  it("skips pending bytes owned by an active restore staging session", async () => {
    h.entries = [];
    h.pending = [];
    const relative = pending("active", "staged bytes", "session-active");
    beginStagingSession("session-active");
    try {
      await runBackgroundReconciliation(execFor({}));
      expect(h.pending.some((entry) => entry.relative === relative)).toBe(true);
      expect(h.operations).not.toContain(`deletePending ${relative}`);
    } finally {
      endStagingSession("session-active");
    }
  });

  it("keeps pending bytes from a session that starts and ends after the pass began", async () => {
    const relative = pending("transient", "staged bytes", "transient-session");
    h.pendingRead = async () => {
      beginStagingSession("transient-session");
      endStagingSession("transient-session");
      return [...h.pending];
    };
    await runBackgroundReconciliation(execFor({}));
    expect(h.pending.some((entry) => entry.relative === relative)).toBe(true);
    expect(h.operations).not.toContain(`deletePending ${relative}`);
  });
  it("keeps a path while any template row can still reach it through global, Category, or contact assignment", () => {
    const path = "profile-backgrounds/shared.jpg";
    const plan = planBackgroundReconciliation({
      entries: ["shared.jpg"],
      referencedPaths: new Set([path]),
    });
    expect(plan.actions).toEqual([]);
  });

  it("removes only zero-referrer canonical orphans and records missing restore-era bytes", () => {
    const plan = planBackgroundReconciliation({
      entries: ["orphan.jpg", "live.jpg.bak"],
      referencedPaths: new Set([
        "profile-backgrounds/live.jpg",
        "profile-backgrounds/missing.jpg",
      ]),
    });
    expect(plan.actions).toEqual([
      { kind: "deleteCanonical", relative: "profile-backgrounds/orphan.jpg" },
      {
        kind: "restoreBak",
        from: "profile-backgrounds/live.jpg.bak",
        to: "profile-backgrounds/live.jpg",
      },
    ]);
    expect(plan.missingReferences).toEqual(["profile-backgrounds/missing.jpg"]);
  });

  it("deletes an unreferenced interrupted backup instead of resurrecting it", () => {
    expect(
      planBackgroundReconciliation({
        entries: ["unreferenced.jpg.bak"],
        referencedPaths: new Set(),
      }).actions,
    ).toEqual([
      {
        kind: "deleteBak",
        relative: "profile-backgrounds/unreferenced.jpg.bak",
      },
    ]);
  });
});

describe("background restore-pending crash recovery", () => {
  it("holds a dependent only in the failed recovery pass", async () => {
    h.entries = ["orphan.jpg"];
    h.pending = [];
    h.operations = [];
    h.fail.add("deleteCanonical:profile-backgrounds/orphan.jpg");
    const calls: string[] = [];
    registerBackgroundReconcileSweep(() => execFor({}));
    registerSweepHook(
      async () => {
        calls.push("backup");
      },
      {
        requires: [SWEEP_IDS.backgroundReconcile],
      },
    );
    await runLaunchSweep();
    expect(calls).toEqual([]);
    h.fail.clear();
    await runLaunchSweep();
    expect(calls).toEqual(["backup"]);
  });

  it("isolates a failed canonical delete and retries it on a later pass", async () => {
    h.entries = ["orphan.jpg", "other.jpg"];
    h.pending = [];
    h.operations = [];
    h.fail.add("deleteCanonical:profile-backgrounds/orphan.jpg");
    expect(await runBackgroundReconciliation(execFor({}))).toEqual({
      failed: 1,
    });
    expect(h.operations).toContain(
      "deleteCanonical profile-backgrounds/other.jpg",
    );
    h.fail.clear();
    expect(await runBackgroundReconciliation(execFor({}))).toEqual({
      failed: 0,
    });
    expect(h.operations).toContain(
      "deleteCanonical profile-backgrounds/orphan.jpg",
    );
  });

  it("isolates failed sidecar actions and processes remaining actions", async () => {
    h.entries = ["bad.jpg.tmp", "good.jpg.bak"];
    h.pending = [];
    h.operations = [];
    h.fail.add("action:deleteTmp");
    expect(
      await runBackgroundReconciliation(
        execFor({ good: "profile-backgrounds/good.jpg" }),
      ),
    ).toEqual({ failed: 1 });
    expect(h.operations).toContain("restoreBak");
    h.fail.clear();
    expect(
      await runBackgroundReconciliation(
        execFor({ good: "profile-backgrounds/good.jpg" }),
      ),
    ).toEqual({ failed: 0 });
  });

  it.each(["copy", "cleanup"])(
    "continues after a failed pending %s",
    async (kind) => {
      h.entries = [];
      h.pending = [];
      h.operations = [];
      const bad = pending("bad", "BAD");
      const good = pending("good", "GOOD");
      h.fail.add(
        kind === "copy" ? `persist:pending:${bad}` : `deletePending:${bad}`,
      );
      const exec = execFor({ bad, good });
      expect(await runBackgroundReconciliation(exec)).toEqual({ failed: 1 });
      expect(h.operations).toContain(
        `finalize ${good} -> profile-backgrounds/good.jpg`,
      );
      h.fail.clear();
      expect(await runBackgroundReconciliation(exec)).toEqual({ failed: 0 });
      expect(h.pending).toEqual([]);
    },
  );

  it("re-checks sweep A after restore B finalizes while A is paused after discovery", async () => {
    h.entries = ["same.jpg"];
    h.pending = [];
    h.bytes = new Map([["profile-backgrounds/same.jpg", "OLD"]]);
    h.operations = [];
    const markerA = pending("same", "A", "session-a");
    const markerB = pending("same", "B", "session-b");
    const rows = new Map([
      ["same", { uid: "same", imagePath: markerA, modifiedAt: "same" }],
    ]);
    const exec = {
      getAllAsync: async () => [...rows.values()],
      getFirstAsync: async (_sql: string, params?: unknown[]) => {
        const row = rows.get(String(params?.[0]));
        return row ? { imagePath: row.imagePath } : null;
      },
      runAsync: async (_sql: string, params?: unknown[]) => {
        const [canonical, uid, expected] = params as string[];
        const row = rows.get(uid);
        if (!row || row.imagePath !== expected) return { changes: 0 };
        row.imagePath = canonical;
        return { changes: 1 };
      },
      execAsync: async () => undefined,
    } as never;
    let announceDiscovery!: () => void;
    let resumeSweep!: () => void;
    const discovered = new Promise<void>((resolve) => {
      announceDiscovery = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      resumeSweep = resolve;
    });
    h.pendingRead = async () => {
      const discoveredA = h.pending.filter(
        (entry) => entry.relative === markerA,
      );
      announceDiscovery();
      await resume;
      return discoveredA;
    };

    const sweepA = runBackgroundReconciliation(exec);
    await discovered;
    const row = rows.get("same");
    if (!row) throw new Error("test row missing");
    row.imagePath = markerB;
    await finalizeBackgroundRestoreCandidate(exec, {
      uid: "same",
      pendingRelativePath: markerB,
    });
    resumeSweep();
    await sweepA;

    expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("B");
    expect(h.operations).toContain(
      `persist pending:${markerB} -> profile-backgrounds/same.jpg`,
    );
    expect(h.operations).not.toContain(
      `persist pending:${markerA} -> profile-backgrounds/same.jpg`,
    );
    expect(rows.get("same")?.imagePath).toBe("profile-backgrounds/same.jpg");
  });

  it.each([
    ["insert after commit", false],
    ["same-uid replacement after commit", true],
  ] as const)(
    "re-drives incoming bytes for %s even when canonical exists=%s",
    async (_label, existing) => {
      h.entries = existing ? ["same.jpg"] : [];
      h.pending = [];
      h.bytes = new Map(
        existing ? [["profile-backgrounds/same.jpg", "OLD"]] : [],
      );
      h.operations = [];
      const relative = pending("same", "NEW");
      await runBackgroundReconciliation(execFor({ same: relative }));
      expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("NEW");
      expect(h.pending).toEqual([]);
      expect(h.operations).toContain(
        `persist pending:${relative} -> profile-backgrounds/same.jpg`,
      );
      expect(h.operations).toContain(
        `finalize ${relative} -> profile-backgrounds/same.jpg`,
      );
    },
  );

  it.each([
    ["rolled-back insert", undefined],
    ["unrelated canonical remains byte-identical", "KEEP"],
  ] as const)(
    "prunes staged bytes with no committed row: %s",
    async (_label, unrelated) => {
      h.entries = unrelated ? ["other.jpg"] : [];
      h.pending = [];
      h.bytes = new Map(
        unrelated ? [["profile-backgrounds/other.jpg", unrelated]] : [],
      );
      h.operations = [];
      pending("rolled-back", "NEW");
      await runBackgroundReconciliation(
        execFor(unrelated ? { other: "profile-backgrounds/other.jpg" } : {}),
      );
      expect(h.pending).toEqual([]);
      expect(h.bytes.get("profile-backgrounds/other.jpg")).toBe(unrelated);
      expect(h.bytes.has("profile-backgrounds/rolled-back.jpg")).toBe(false);
    },
  );

  it.each([
    ["fresh insert", false],
    ["same-uid replacement", true],
  ] as const)(
    "runs staged re-drive after a mid-swap %s",
    async (_label, replacement) => {
      h.entries = replacement
        ? ["same.jpg.tmp", "same.jpg.bak"]
        : ["same.jpg.tmp"];
      h.pending = [];
      h.bytes = new Map([["profile-backgrounds/same.jpg.tmp", "NEW"]]);
      if (replacement) h.bytes.set("profile-backgrounds/same.jpg.bak", "OLD");
      h.operations = [];
      const relative = pending("same", "NEW");
      await runBackgroundReconciliation(execFor({ same: relative }));
      expect(
        h.operations.indexOf(replacement ? "restoreBak" : "deleteTmp"),
      ).toBeLessThan(
        h.operations.findIndex((item) => item.startsWith("persist ")),
      );
      expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("NEW");
    },
  );

  it("deletes staged same-uid rollback bytes without overwriting the committed image", async () => {
    h.entries = ["same.jpg"];
    h.pending = [];
    h.bytes = new Map([["profile-backgrounds/same.jpg", "OLD"]]);
    h.operations = [];
    pending("same", "NEW");
    await runBackgroundReconciliation(
      execFor({ same: "profile-backgrounds/same.jpg" }),
    );
    expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("OLD");
    expect(h.pending).toEqual([]);
  });

  it("prunes competing same-metadata sessions and re-drives only the exact committed marker", async () => {
    h.entries = ["same.jpg"];
    h.pending = [];
    h.bytes = new Map([["profile-backgrounds/same.jpg", "OLD"]]);
    h.operations = [];
    const stale = pending("same", "STALE", "older-session");
    const current = pending("same", "CURRENT", "newer-session");
    await runBackgroundReconciliation(execFor({ same: current }));
    expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("CURRENT");
    expect(h.operations).not.toContain(
      `persist pending:${stale} -> profile-backgrounds/same.jpg`,
    );
    expect(h.operations).toContain(
      `persist pending:${current} -> profile-backgrounds/same.jpg`,
    );
    expect(h.pending).toEqual([]);
  });

  it("idempotently re-persists bytes after a crash before row-path finalization", async () => {
    h.entries = ["same.jpg"];
    h.pending = [];
    h.bytes = new Map([["profile-backgrounds/same.jpg", "NEW"]]);
    h.operations = [];
    const relative = pending("same", "NEW");
    await runBackgroundReconciliation(execFor({ same: relative }));
    expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("NEW");
    expect(h.pending).toEqual([]);
  });
});
