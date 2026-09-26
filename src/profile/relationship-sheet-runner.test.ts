import { describe, expect, it, vi } from "vitest";
import {
  type RelationshipSheetAction,
  type RelationshipSheetState,
  relationshipSheetReducer,
} from "./relationship-sheet-model";
import {
  createRelationshipSheetRunner,
  type RelationshipSelector,
} from "./relationship-sheet-runner";

// 38.3 RG-025 (architecture/AUD-ARCH-009, D-24): a Retry settles only the
// selector whose submit failed, through the same settlement path as a normal
// submit, so neither selector is left `pending` and the sheet stays usable.

function idle<T>(value: T): RelationshipSheetState<T> {
  return { committed: value, draft: value, pending: false, error: null };
}

function harness() {
  const states: {
    frequency: RelationshipSheetState<number | null>;
    snooze: RelationshipSheetState<string | null>;
  } = { frequency: idle<number | null>(30), snooze: idle<string | null>(null) };
  const dispatched: Array<[RelationshipSelector, string]> = [];
  const onClose = vi.fn();
  const runner = createRelationshipSheetRunner({
    dispatch(owner, action) {
      dispatched.push([owner, action.type]);
      if (owner === "frequency") {
        states.frequency = relationshipSheetReducer(
          states.frequency,
          action as RelationshipSheetAction<number | null>,
        );
      } else {
        states.snooze = relationshipSheetReducer(
          states.snooze,
          action as RelationshipSheetAction<string | null>,
        );
      }
    },
    isPending: (owner) => states[owner].pending,
    onClose,
  });
  // Mirrors ProfileRelationshipSheets.close(): refuse while pending, dismiss
  // both selectors, drop the retry target.
  const close = () => {
    if (states.frequency.pending || states.snooze.pending) return false;
    states.frequency = relationshipSheetReducer(states.frequency, {
      type: "dismiss",
    });
    states.snooze = relationshipSheetReducer(states.snooze, {
      type: "dismiss",
    });
    runner.clear();
    return true;
  };
  return { states, dispatched, onClose, runner, close };
}

const fail = () => Promise.reject(new Error("write failed"));
const ok = () => Promise.resolve();

describe("createRelationshipSheetRunner", () => {
  it("settles a successful frequency submit and closes once", async () => {
    const h = harness();
    await h.runner.submit("frequency", 7, ok);
    expect(h.states.frequency).toEqual(idle(7));
    expect(h.dispatched).toEqual([
      ["frequency", "submit"],
      ["frequency", "success"],
    ]);
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.runner.canRetry()).toBe(false);
  });

  it("frequency failure → Retry success settles frequency only and closes once", async () => {
    const h = harness();
    let attempts = 0;
    const operation = vi.fn(() => {
      attempts += 1;
      return attempts === 1 ? fail() : ok();
    });
    await h.runner.submit("frequency", 14, operation);
    expect(h.states.frequency.pending).toBe(false);
    expect(h.states.frequency.error).not.toBeNull();
    expect(h.states.snooze).toEqual(idle(null));
    expect(h.runner.canRetry()).toBe(true);
    expect(h.onClose).not.toHaveBeenCalled();
    h.dispatched.length = 0;

    await h.runner.retry();

    expect(operation).toHaveBeenCalledTimes(2);
    expect(h.dispatched).toEqual([
      ["frequency", "retry"],
      ["frequency", "success"],
    ]);
    expect(h.states.frequency).toEqual({
      committed: 14,
      draft: 14,
      pending: false,
      error: null,
    });
    expect(h.states.snooze).toEqual(idle(null));
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.runner.canRetry()).toBe(false);
  });

  it("a repeated Retry failure stays recoverable", async () => {
    const h = harness();
    let attempts = 0;
    const operation = () => {
      attempts += 1;
      return attempts < 3 ? fail() : ok();
    };
    await h.runner.submit("frequency", 90, operation);
    await h.runner.retry();
    expect(h.states.frequency.pending).toBe(false);
    expect(h.states.frequency.error).not.toBeNull();
    expect(h.states.snooze).toEqual(idle(null));
    expect(h.runner.canRetry()).toBe(true);
    expect(h.onClose).not.toHaveBeenCalled();

    await h.runner.retry();
    expect(attempts).toBe(3);
    expect(h.states.frequency).toEqual(idle(90));
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it("snooze failure → Retry settles snooze only", async () => {
    const h = harness();
    let attempts = 0;
    await h.runner.submit("snooze", "1w", () => {
      attempts += 1;
      return attempts === 1 ? fail() : ok();
    });
    expect(h.states.snooze.error).not.toBeNull();
    expect(h.states.frequency).toEqual(idle(30));
    h.dispatched.length = 0;

    await h.runner.retry();
    expect(h.dispatched).toEqual([
      ["snooze", "retry"],
      ["snooze", "success"],
    ]);
    expect(h.states.snooze).toEqual(idle("1w"));
    expect(h.states.frequency).toEqual(idle(30));
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it("after a successful Retry, close and reopen see neither selector pending", async () => {
    for (const owner of ["frequency", "snooze"] as const) {
      const h = harness();
      let attempts = 0;
      const operation = () => {
        attempts += 1;
        return attempts === 1 ? fail() : ok();
      };
      if (owner === "frequency") {
        await h.runner.submit("frequency", 7, operation);
      } else {
        await h.runner.submit("snooze", "3d", operation);
      }
      await h.runner.retry();
      expect(h.close()).toBe(true);
      expect(h.states.frequency.pending).toBe(false);
      expect(h.states.snooze.pending).toBe(false);
      expect(h.states.frequency.error).toBeNull();
      expect(h.states.snooze.error).toBeNull();
      expect(h.runner.canRetry()).toBe(false);
      // Reopened: both selectors accept a new submit.
      await h.runner.submit("frequency", 14, ok);
      await h.runner.submit("snooze", "1m", ok);
      expect(h.states.frequency).toEqual(idle(14));
      expect(h.states.snooze).toEqual(idle("1m"));
    }
  });

  it("ignores a new submit or Retry for a selector that is still pending", async () => {
    const h = harness();
    let release: () => void = () => {};
    const slow = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const second = vi.fn(ok);
    const first = h.runner.submit("frequency", 7, slow);
    expect(h.states.frequency.pending).toBe(true);
    await h.runner.submit("frequency", 14, second);
    await h.runner.retry();
    expect(second).not.toHaveBeenCalled();
    expect(slow).toHaveBeenCalledTimes(1);
    // Close refuses while pending (unchanged protection).
    expect(h.close()).toBe(false);
    release();
    await first;
    expect(h.states.frequency).toEqual(idle(7));
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps legitimate repeated Snooze events (no value dedupe)", async () => {
    const h = harness();
    const snooze = vi.fn(ok);
    await h.runner.submit("snooze", "1w", snooze);
    await h.runner.submit("snooze", "1w", snooze);
    expect(snooze).toHaveBeenCalledTimes(2);
    expect(h.onClose).toHaveBeenCalledTimes(2);
  });

  it("clear drops the retry target", async () => {
    const h = harness();
    const operation = vi.fn(fail);
    await h.runner.submit("frequency", 7, operation);
    expect(h.runner.canRetry()).toBe(true);
    h.runner.clear();
    expect(h.runner.canRetry()).toBe(false);
    await h.runner.retry();
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
