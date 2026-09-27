import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import {
  importCompleteRetryState,
  runImportCompleteAction,
} from "./import-complete-logic";

describe("importCompleteRetryState (RG-035, D-26)", () => {
  it("offers Retry for pending rows left by a fatal stop", () => {
    const state = importCompleteRetryState({
      failed: 0,
      pending: 3,
      photoRows: 0,
    });
    expect(state.visible).toBe(true);
    expect(state.message).toBe("Some contacts haven't been imported yet.");
  });

  it("keeps the failed-rows message", () => {
    expect(
      importCompleteRetryState({ failed: 2, pending: 0, photoRows: 0 }),
    ).toEqual({
      visible: true,
      message: "Some contacts couldn't be imported.",
    });
  });

  it("keeps the unfinished-photos message", () => {
    expect(
      importCompleteRetryState({ failed: 0, pending: 0, photoRows: 2 }),
    ).toEqual({
      visible: true,
      message: "Some contact photos still need to be added.",
    });
  });

  it("is hidden when nothing is left to retry", () => {
    expect(
      importCompleteRetryState({ failed: 0, pending: 0, photoRows: 0 }),
    ).toEqual({ visible: false, message: null });
  });

  it("prefers failed, then pending, then photos", () => {
    expect(
      importCompleteRetryState({ failed: 1, pending: 1, photoRows: 1 }).message,
    ).toBe("Some contacts couldn't be imported.");
    expect(
      importCompleteRetryState({ failed: 0, pending: 1, photoRows: 1 }).message,
    ).toBe("Some contacts haven't been imported yet.");
  });
});

describe("runImportCompleteAction (38.3 review B-WR-03 / B-WR-04, D-04)", () => {
  it("a failed write is reported as a write failure and still re-reads the summary read-only", async () => {
    const order: string[] = [];
    const onWriteFailed = vi.fn(() => order.push("write-failed"));
    const outcome = await runImportCompleteAction(
      { current: false },
      {
        write: () => Promise.reject(new Error("batch")),
        refresh: async () => {
          order.push("refresh");
        },
        onWriteFailed,
      },
    );
    expect(outcome).toBe("write-failed");
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
    // The summary is re-read so counts show what DID commit before the failure.
    expect(order).toEqual(["write-failed", "refresh"]);
  });

  it("a committed write refreshes once and never reports a write failure", async () => {
    const refresh = vi.fn(async () => {});
    const onWriteFailed = vi.fn();
    const outcome = await runImportCompleteAction(
      { current: false },
      { write: async () => {}, refresh, onWriteFailed },
    );
    expect(outcome).toBe("committed");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onWriteFailed).not.toHaveBeenCalled();
  });

  it("drops a same-tick second call so the write runs once", async () => {
    const latch = { current: false };
    let release = () => {};
    const write = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const steps = { write, refresh: async () => {}, onWriteFailed: vi.fn() };
    const first = runImportCompleteAction(latch, steps);
    const second = runImportCompleteAction(latch, steps);
    expect(await second).toBe("dropped");
    release();
    expect(await first).toBe("committed");
    expect(write).toHaveBeenCalledTimes(1);
  });
});

/**
 * 38.3 UAT O-3 (38.4 D-10): Import Complete re-reads its summary on EVERY focus
 * (returning from Duplicate Review after a link must show the current
 * Need-review count), through the same gated latest-request authority, and the
 * focus path never re-runs an import, retry, skip or any row mutation — it runs
 * only `load` (the summary read plus the pre-existing idempotent terminal
 * finalizer). Source contract over ImportCompleteScreen.tsx.
 */
describe("ImportCompleteScreen focus re-read contract (38.3 UAT O-3, D-10)", () => {
  const source = readFileSync("src/screens/ImportCompleteScreen.tsx", "utf8");
  const file = ts.createSourceFile(
    "ImportCompleteScreen.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function calls(name: string): ts.CallExpression[] {
    const found: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === name
      ) {
        found.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    return found;
  }

  function identifiersIn(node: ts.Node): string[] {
    const names: string[] = [];
    const visit = (child: ts.Node): void => {
      if (ts.isIdentifier(child)) names.push(child.text);
      ts.forEachChild(child, visit);
    };
    visit(node);
    return names;
  }

  it("imports useFocusEffect from @react-navigation/native", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\buseFocusEffect\b[^}]*\}\s*from\s*"@react-navigation\/native"/,
    );
  });

  it("loads through useFocusEffect(useCallback(...)) whose cleanup invalidates the authority", () => {
    const focusEffects = calls("useFocusEffect");
    expect(focusEffects).toHaveLength(1);
    const [callback] = focusEffects[0].arguments;
    expect(
      callback !== undefined &&
        ts.isCallExpression(callback) &&
        ts.isIdentifier(callback.expression) &&
        callback.expression.text === "useCallback",
    ).toBe(true);
    const text = callback.getText(file);
    expect(text).toContain("load()");
    expect(text).toMatch(/return\s*\(\)\s*=>\s*authority\.invalidate\(\)/);
  });

  it("the focus callback references only load/authority — never an import, retry, skip or action", () => {
    const [callback] = calls("useFocusEffect")[0].arguments;
    const names = identifiersIn(callback);
    for (const forbidden of [
      "runImportCompleteAction",
      "runAction",
      "retry",
      "skipPhotos",
      "runImportBatch",
      "retryImportedPhoto",
      "skipRemainingPhotos",
      "finalizeSessionIfTerminal",
    ]) {
      expect(names).not.toContain(forbidden);
    }
    expect(names).toContain("load");
  });

  it("no mount-only useEffect still owns the summary read", () => {
    for (const effect of calls("useEffect")) {
      expect(identifiersIn(effect)).not.toContain("load");
    }
  });
});
