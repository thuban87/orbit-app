import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  entries: [] as string[],
  pending: [] as Array<{ uid: string; relative: string }>,
  journals: [] as Array<{
    relativePath: string;
    templateUid: string;
    templateModifiedAt: string;
    canonicalRelativePath: string;
    createdAt: string;
  }>,
  bytes: new Map<string, string>(),
  operations: [] as string[],
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
  listBackgroundRestorePendingEntries: () => [...h.pending],
  backgroundDerivativeRelPath: (uid: string) =>
    `profile-backgrounds/${uid}.jpg`,
  resolveBackgroundRestorePendingUri: (relative: string) =>
    `pending:${relative}`,
  persistBackgroundDerivative: async (source: string, destination: string) => {
    h.operations.push(`persist ${source} -> ${destination}`);
    h.bytes.set(destination, h.bytes.get(source)!);
  },
  deleteBackgroundRestorePending: (relative: string) => {
    h.operations.push(`deletePending ${relative}`);
    h.pending = h.pending.filter((entry) => entry.relative !== relative);
  },
  deleteBackgroundDerivative: (relative: string) => {
    h.operations.push(`deleteCanonical ${relative}`);
    h.bytes.delete(relative);
  },
  applyBackgroundReconcileAction: async (action: {
    kind: string;
    from?: string;
    to?: string;
    relative?: string;
  }) => {
    h.operations.push(action.kind);
    if (action.kind === "restoreBak")
      h.bytes.set(action.to!, h.bytes.get(action.from!)!);
  },
}));
vi.mock("@/db/restore-background-journal-dao", () => ({
  listBackgroundJournalEntries: async () => [...h.journals],
  deleteBackgroundJournalEntry: async (_exec: unknown, relative: string) => {
    h.operations.push(`deleteJournal ${relative}`);
    h.journals = h.journals.filter((entry) => entry.relativePath !== relative);
  },
}));

import { planBackgroundReconciliation } from "./background-reconcile-model";
import { runBackgroundReconciliation } from "./background-reconcile-sweep";

function execFor(uids: string[]) {
  return {
    getAllAsync: async (sql: string) =>
      uids.map((uid) => ({
        uid,
        imagePath: `profile-backgrounds/${uid}.jpg`,
        ...(sql.includes("modified_at") ? { modifiedAt: "v1" } : {}),
      })),
  } as never;
}

function pending(uid: string, bytes: string) {
  const relative = `profile-backgrounds/_restore_pending/${uid}/session.jpg`;
  h.pending = [{ uid, relative }];
  h.bytes.set(`pending:${relative}`, bytes);
  return relative;
}

function commitPending(uid: string, relative: string) {
  h.journals = [
    {
      relativePath: relative,
      templateUid: uid,
      templateModifiedAt: "v1",
      canonicalRelativePath: `profile-backgrounds/${uid}.jpg`,
      createdAt: "now",
    },
  ];
}

describe("background launch reconciliation plan", () => {
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

beforeEach(() => {
  h.journals = [];
});

describe("background restore-pending crash recovery", () => {
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
      commitPending("same", relative);
      await runBackgroundReconciliation(execFor(["same"]));
      expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("NEW");
      expect(h.pending).toEqual([]);
      expect(h.operations).toContain(
        `persist pending:${relative} -> profile-backgrounds/same.jpg`,
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
      h.journals = [];
      pending("rolled-back", "NEW");
      await runBackgroundReconciliation(execFor(unrelated ? ["other"] : []));
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
      commitPending("same", relative);
      await runBackgroundReconciliation(execFor(["same"]));
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
    h.journals = [];
    pending("same", "NEW");
    await runBackgroundReconciliation(execFor(["same"]));
    expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("OLD");
    expect(h.pending).toEqual([]);
  });

  it("idempotently cleans retained evidence after a completed persist", async () => {
    h.entries = ["same.jpg"];
    h.pending = [];
    h.bytes = new Map([["profile-backgrounds/same.jpg", "NEW"]]);
    h.operations = [];
    const relative = pending("same", "NEW");
    commitPending("same", relative);
    await runBackgroundReconciliation(execFor(["same"]));
    expect(h.bytes.get("profile-backgrounds/same.jpg")).toBe("NEW");
    expect(h.pending).toEqual([]);
  });
});
