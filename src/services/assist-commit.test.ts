/**
 * assist-commit — the shared Interaction Assist publication + failure contract
 * (38.3 RG-023: architecture/AUD-ARCH-006, react-native/AUD-RN-007, and
 * react-native/AUD-RN-013 folded in by D-08; D-04, D-21).
 *
 * Pure DI: every side effect is an injected spy, so these cases prove the exact
 * production ordering/latching without React Native, widgets or stores.
 */
import { describe, expect, it, vi } from "vitest";
import { FutureOccurredAtError } from "@/db/log-guards";
import {
  ASSIST_FAILURE_COPY,
  classifyAssistFailure,
  publishAssistCommit,
  publishAssistDismissal,
  runAssistAction,
} from "@/services/assist-commit";
import type { InFlightRef } from "@/utils/single-flight";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function commitDeps() {
  return {
    notifyWidget: vi.fn(),
    bumpShell: vi.fn(),
    refreshQueue: vi.fn(async () => {}),
    logFailure: vi.fn(),
  };
}

describe("classifyAssistFailure", () => {
  it("classifies the typed ADR-071 future-date rejection as future-date", () => {
    expect(
      classifyAssistFailure(
        new FutureOccurredAtError("occurredAt is in the future (a > b)"),
      ),
    ).toBe("future-date");
  });

  it("classifies any other error (including a plain Error mentioning 'future') as generic", () => {
    expect(classifyAssistFailure(new Error("db locked"))).toBe("generic");
    expect(
      classifyAssistFailure(new Error("occurredAt is in the future")),
    ).toBe("generic");
    expect(classifyAssistFailure("boom")).toBe("generic");
    expect(classifyAssistFailure(undefined)).toBe("generic");
  });
});

describe("ASSIST_FAILURE_COPY", () => {
  it("has non-empty, content-free copy for every log and dismiss failure", () => {
    const all = [
      ASSIST_FAILURE_COPY.log["future-date"],
      ASSIST_FAILURE_COPY.log.generic,
      ASSIST_FAILURE_COPY.dismiss.generic,
    ];
    for (const copy of all) {
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
    expect(ASSIST_FAILURE_COPY.log["future-date"].title).not.toBe(
      ASSIST_FAILURE_COPY.log.generic.title,
    );
  });
});

describe("publishAssistCommit", () => {
  it("notifies the widget, bumps the shell tick and refreshes the queue once each", async () => {
    const deps = commitDeps();
    await publishAssistCommit(deps);
    expect(deps.notifyWidget).toHaveBeenCalledTimes(1);
    expect(deps.bumpShell).toHaveBeenCalledTimes(1);
    expect(deps.refreshQueue).toHaveBeenCalledTimes(1);
    expect(deps.logFailure).not.toHaveBeenCalled();
  });

  it("still bumps the shell and refreshes the queue when the widget notify throws, and resolves", async () => {
    const deps = commitDeps();
    deps.notifyWidget.mockImplementation(() => {
      throw new Error("widget");
    });
    await expect(publishAssistCommit(deps)).resolves.toBeUndefined();
    expect(deps.bumpShell).toHaveBeenCalledTimes(1);
    expect(deps.refreshQueue).toHaveBeenCalledTimes(1);
    expect(deps.logFailure).toHaveBeenCalledTimes(1);
  });

  it("still refreshes the queue when the shell bump throws, and resolves", async () => {
    const deps = commitDeps();
    deps.bumpShell.mockImplementation(() => {
      throw new Error("subscriber");
    });
    await expect(publishAssistCommit(deps)).resolves.toBeUndefined();
    expect(deps.notifyWidget).toHaveBeenCalledTimes(1);
    expect(deps.refreshQueue).toHaveBeenCalledTimes(1);
    expect(deps.logFailure).toHaveBeenCalledTimes(1);
  });

  it("resolves (never rejects) when the queue refresh rejects, logging it once", async () => {
    const deps = commitDeps();
    deps.refreshQueue.mockRejectedValue(new Error("read failed"));
    await expect(publishAssistCommit(deps)).resolves.toBeUndefined();
    expect(deps.notifyWidget).toHaveBeenCalledTimes(1);
    expect(deps.bumpShell).toHaveBeenCalledTimes(1);
    expect(deps.logFailure).toHaveBeenCalledTimes(1);
  });

  it("logs content-free messages (no ids, names or notes are passed as the message)", async () => {
    const deps = commitDeps();
    deps.notifyWidget.mockImplementation(() => {
      throw new Error("w");
    });
    deps.bumpShell.mockImplementation(() => {
      throw new Error("s");
    });
    deps.refreshQueue.mockRejectedValue(new Error("q"));
    await publishAssistCommit(deps);
    expect(deps.logFailure).toHaveBeenCalledTimes(3);
    for (const [message] of deps.logFailure.mock.calls) {
      expect(typeof message).toBe("string");
      expect(message).not.toMatch(/\d/);
    }
  });
});

describe("publishAssistDismissal", () => {
  it("refreshes the queue only", async () => {
    const refreshQueue = vi.fn(async () => {});
    const logFailure = vi.fn();
    await publishAssistDismissal({ refreshQueue, logFailure });
    expect(refreshQueue).toHaveBeenCalledTimes(1);
    expect(logFailure).not.toHaveBeenCalled();
  });

  it("never rejects when the queue refresh rejects, logging it once", async () => {
    const refreshQueue = vi.fn(async () => {
      throw new Error("read failed");
    });
    const logFailure = vi.fn();
    await expect(
      publishAssistDismissal({ refreshQueue, logFailure }),
    ).resolves.toBeUndefined();
    expect(logFailure).toHaveBeenCalledTimes(1);
  });
});

describe("runAssistAction", () => {
  it("write resolves → publishes once, returns 'done', onError not called", async () => {
    const latch: InFlightRef = { current: false };
    const deps = commitDeps();
    const write = vi.fn(async () => {});
    const onError = vi.fn();
    const result = await runAssistAction({
      latch,
      write,
      publish: () => publishAssistCommit(deps),
      onError,
    });
    expect(result).toBe("done");
    expect(write).toHaveBeenCalledTimes(1);
    expect(deps.notifyWidget).toHaveBeenCalledTimes(1);
    expect(deps.bumpShell).toHaveBeenCalledTimes(1);
    expect(deps.refreshQueue).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(latch.current).toBe(false);
  });

  it("write resolves but the queue refresh rejects → still 'done', onError NOT called, failure logged (D-04)", async () => {
    const latch: InFlightRef = { current: false };
    const deps = commitDeps();
    deps.refreshQueue.mockRejectedValue(new Error("fault"));
    const onError = vi.fn();
    const result = await runAssistAction({
      latch,
      write: async () => {},
      publish: () => publishAssistCommit(deps),
      onError,
    });
    expect(result).toBe("done");
    expect(onError).not.toHaveBeenCalled();
    expect(deps.logFailure).toHaveBeenCalledTimes(1);
    expect(latch.current).toBe(false);
  });

  it("a publish that unexpectedly rejects is still never reported as a write failure", async () => {
    const latch: InFlightRef = { current: false };
    const onError = vi.fn();
    const logFailure = vi.fn();
    const result = await runAssistAction({
      latch,
      write: async () => {},
      publish: async () => {
        throw new Error("contract breach");
      },
      onError,
      logFailure,
    });
    expect(result).toBe("done");
    expect(onError).not.toHaveBeenCalled();
    expect(logFailure).toHaveBeenCalledTimes(1);
    expect(latch.current).toBe(false);
  });

  it("write rejects with FutureOccurredAtError → onError('future-date'), no publish, 'failed'", async () => {
    const latch: InFlightRef = { current: false };
    const publish = vi.fn(async () => {});
    const onError = vi.fn();
    const result = await runAssistAction({
      latch,
      write: async () => {
        throw new FutureOccurredAtError("occurredAt is in the future (a > b)");
      },
      publish,
      onError,
    });
    expect(result).toBe("failed");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      "future-date",
      expect.any(FutureOccurredAtError),
    );
    expect(publish).not.toHaveBeenCalled();
    expect(latch.current).toBe(false);
  });

  it("write rejects with any other error → onError('generic'), no publish", async () => {
    const latch: InFlightRef = { current: false };
    const publish = vi.fn(async () => {});
    const onError = vi.fn();
    const result = await runAssistAction({
      latch,
      write: async () => {
        throw new Error("SQLITE_BUSY");
      },
      publish,
      onError,
    });
    expect(result).toBe("failed");
    expect(onError).toHaveBeenCalledWith("generic", expect.any(Error));
    expect(publish).not.toHaveBeenCalled();
  });

  it("a second call while the first is in flight returns 'busy' without writing; latch released after success", async () => {
    const latch: InFlightRef = { current: false };
    const gate = deferred();
    const write = vi.fn(() => gate.promise);
    const publish = vi.fn(async () => {});
    const onError = vi.fn();

    const first = runAssistAction({ latch, write, publish, onError });
    const second = await runAssistAction({ latch, write, publish, onError });
    expect(second).toBe("busy");
    expect(write).toHaveBeenCalledTimes(1);
    expect(latch.current).toBe(true);

    gate.resolve();
    expect(await first).toBe("done");
    expect(latch.current).toBe(false);
    expect(publish).toHaveBeenCalledTimes(1);

    // Released: a later tap runs again.
    expect(await runAssistAction({ latch, write, publish, onError })).toBe(
      "done",
    );
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("latch is held across the publish and released after a failure too", async () => {
    const latch: InFlightRef = { current: false };
    const publishGate = deferred();
    const write = vi.fn(async () => {});
    const publish = vi.fn(() => publishGate.promise);
    const first = runAssistAction({ latch, write, publish, onError: vi.fn() });
    // Let the write settle so the runner is parked in publish.
    await Promise.resolve();
    await Promise.resolve();
    expect(
      await runAssistAction({ latch, write, publish, onError: vi.fn() }),
    ).toBe("busy");
    publishGate.resolve();
    expect(await first).toBe("done");

    const failing = await runAssistAction({
      latch,
      write: async () => {
        throw new Error("x");
      },
      publish,
      onError: vi.fn(),
    });
    expect(failing).toBe("failed");
    expect(latch.current).toBe(false);
  });
});

describe("runAssistAction — a no-op log is not success (38.3 review B-WR-05, D-04)", () => {
  it("write resolves 'closed' → returns 'closed', runs onClosed + the queue-only refresh, never the commit publisher", async () => {
    const latch: InFlightRef = { current: false };
    const deps = commitDeps();
    const onError = vi.fn();
    const onClosed = vi.fn();
    const publishClosed = vi.fn(async () => {});
    const result = await runAssistAction({
      latch,
      write: async () => "closed" as const,
      publish: () => publishAssistCommit(deps),
      onError,
      onClosed,
      publishClosed,
    });
    expect(result).toBe("closed");
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(publishClosed).toHaveBeenCalledTimes(1);
    expect(deps.notifyWidget).not.toHaveBeenCalled();
    expect(deps.bumpShell).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(latch.current).toBe(false);
  });

  it("write resolves 'already-logged' → 'done' (a double confirm is harmless)", async () => {
    const deps = commitDeps();
    const onClosed = vi.fn();
    const result = await runAssistAction({
      latch: { current: false },
      write: async () => "already-logged" as const,
      publish: () => publishAssistCommit(deps),
      onError: vi.fn(),
      onClosed,
    });
    expect(result).toBe("done");
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("has content-free copy for an already-closed reach-out", () => {
    expect(ASSIST_FAILURE_COPY.closed.title.length).toBeGreaterThan(0);
    expect(ASSIST_FAILURE_COPY.closed.body).toMatch(/nothing was logged/i);
  });
});
