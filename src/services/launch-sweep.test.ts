/**
 * Unit tests for the launch-sweep skeleton (DATA-06).
 *
 * These prove the load-bearing NEGATIVE rules the structural greps cannot:
 *  - importing the module runs no hook (no module-scope side effect),
 *  - the sweep fires on cold-start and ONLY on a real background→active
 *    transition — never on a raw inactive→active (permission dialog /
 *    notification shade) nor on a background/inactive event.
 *
 * AppState is dependency-injected via a hand-rolled fake (mirrors the
 * `AiService.test.ts` global-stub pattern, but injected rather than stubbed on
 * `global`, since launch-sweep.ts owns no react-native import). `flush()` yields
 * a macrotask so the async `runLaunchSweep()` `finally` resets its `running`
 * guard between synchronous `fire()` calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetSweepForTest,
  installSweepTrigger,
  onSweepSettled,
  registerSweepHook,
  runLaunchSweep,
} from "@/services/launch-sweep";

/** Yield a macrotask so a pending runLaunchSweep() settles and resets `running`. */
const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/** A minimal `AppState`-like fake: records the change listener; `fire()` drives it. */
function makeFakeAppState() {
  let listener: ((state: string) => void) | null = null;
  let removed = false;
  return {
    appState: {
      addEventListener(_type: "change", cb: (state: string) => void) {
        listener = cb;
        return {
          remove() {
            removed = true;
          },
        };
      },
    },
    fire(state: string) {
      listener?.(state);
    },
    get subscribed() {
      return listener !== null;
    },
    get removed() {
      return removed;
    },
  };
}

beforeEach(() => {
  __resetSweepForTest();
});

afterEach(() => {
  __resetSweepForTest();
});

describe("runLaunchSweep — hook registry", () => {
  it.each([0, 1])(
    "isolates a failing hook at position %i",
    async (failureIndex) => {
      const calls: number[] = [];
      for (let index = 0; index < 3; index += 1) {
        registerSweepHook(
          async () => {
            calls.push(index);
            if (index === failureIndex) throw new Error("private content");
          },
          { id: `hook-${index}` },
        );
      }
      await expect(runLaunchSweep()).resolves.toBeUndefined();
      expect(calls).toEqual([0, 1, 2]);
    },
  );

  it("skips dependent hooks transitively, then retries them on the next pass", async () => {
    const calls: string[] = [];
    let fail = true;
    registerSweepHook(
      async () => {
        calls.push("recovery");
        if (fail) throw new Error("failure");
      },
      { id: "recovery" },
    );
    registerSweepHook(
      async () => {
        calls.push("dependent");
      },
      { id: "dependent", requires: ["recovery"] },
    );
    registerSweepHook(
      async () => {
        calls.push("transitive");
      },
      { requires: ["dependent"] },
    );
    registerSweepHook(
      async () => {
        calls.push("independent");
      },
      { requires: ["absent"] },
    );
    await runLaunchSweep();
    expect(calls).toEqual(["recovery", "independent"]);
    fail = false;
    await runLaunchSweep();
    expect(calls).toEqual([
      "recovery",
      "independent",
      "recovery",
      "dependent",
      "transitive",
      "independent",
    ]);
  });

  it("drains a queued rerun after a failing in-flight hook", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    registerSweepHook(
      async () => {
        calls += 1;
        if (calls === 1) {
          await gate;
          throw new Error("failure");
        }
      },
      { id: "recovery" },
    );
    const first = runLaunchSweep();
    await runLaunchSweep();
    release();
    await first;
    expect(calls).toBe(2);
  });

  it("runs registered hooks in registration order", async () => {
    const order: string[] = [];
    registerSweepHook(async () => {
      order.push("first");
    });
    registerSweepHook(async () => {
      order.push("second");
    });

    await runLaunchSweep();

    expect(order).toEqual(["first", "second"]);
  });

  it("never runs the hooks CONCURRENTLY: an overlapping call does not double-run within the in-flight pass", async () => {
    // A hook that blocks on a controllable gate lets us prove no concurrent
    // second pass starts while the first is still awaiting.
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    registerSweepHook(async () => {
      calls += 1;
      await gate;
    });

    const first = runLaunchSweep();
    const overlapping = runLaunchSweep(); // arrives while pass 1 is gated
    await flush();
    expect(calls).toBe(1); // pass 2 has NOT started — no concurrency

    release();
    await Promise.all([first, overlapping]);
    // The overlapping launch was DEFERRED, not dropped (WR-03): exactly one
    // follow-up pass runs after the first settles.
    expect(calls).toBe(2);
  });

  it("DEFERS an overlapping launch instead of dropping it (WR-03)", async () => {
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
    });

    // Two overlapping launches: the second must still get its sweep, one pass
    // later — not silently discarded as the old `if (running) return` did.
    const first = runLaunchSweep();
    const second = runLaunchSweep();
    await Promise.all([first, second]);

    expect(calls).toBe(2);
  });

  it("COALESCES a burst of overlapping launches into a single follow-up pass", async () => {
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
    });

    // Three launches arrive while the first pass is in flight; defer-ONE means
    // they collapse into exactly one extra pass (2 total), never three.
    const runs = [runLaunchSweep(), runLaunchSweep(), runLaunchSweep()];
    await Promise.all(runs);

    expect(calls).toBe(2);
  });

  it("has an EMPTY registry by default (Phase 2 registers nothing)", async () => {
    // No hooks registered → running the sweep is a no-op that resolves cleanly.
    await expect(runLaunchSweep()).resolves.toBeUndefined();
  });
});

describe("no module-scope side effect", () => {
  it("importing the module runs no hook and touches no AppState", async () => {
    // If import had fired the sweep, a hook registered now would already have
    // been skipped; instead it must run exactly once when we invoke the sweep.
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
    });

    expect(calls).toBe(0); // nothing ran on import
    await runLaunchSweep();
    expect(calls).toBe(1);
  });
});

describe("installSweepTrigger — AppState gating", () => {
  it("handles failures from both cold-start and foreground triggers", async () => {
    const fake = makeFakeAppState();
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
      throw new Error("failure");
    });
    installSweepTrigger(fake.appState);
    await flush();
    fake.fire("background");
    fake.fire("active");
    await flush();
    expect(calls).toBe(2);
  });
  it("fires the sweep once on cold start and returns the subscription remover", async () => {
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
    });
    const fake = makeFakeAppState();

    const subscription = installSweepTrigger(fake.appState);
    await flush();

    expect(calls).toBe(1); // cold-start foreground
    expect(fake.subscribed).toBe(true);
    expect(typeof subscription.remove).toBe("function");

    subscription.remove();
    expect(fake.removed).toBe(true);
  });

  it("re-fires on a real background→active transition", async () => {
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
    });
    const fake = makeFakeAppState();

    installSweepTrigger(fake.appState);
    await flush();
    expect(calls).toBe(1); // cold start

    fake.fire("background");
    await flush();
    expect(calls).toBe(1); // a background event alone does NOT fire

    fake.fire("active");
    await flush();
    expect(calls).toBe(2); // background→active DOES fire
  });

  it("does NOT re-fire on a raw inactive→active (permission dialog / shade)", async () => {
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
    });
    const fake = makeFakeAppState();

    installSweepTrigger(fake.appState);
    await flush();
    expect(calls).toBe(1); // cold start

    fake.fire("inactive");
    await flush();
    expect(calls).toBe(1); // inactive alone does not fire

    fake.fire("active");
    await flush();
    expect(calls).toBe(1); // prev was 'inactive', not 'background' → no re-fire
  });

  it("does NOT fire on background or inactive events", async () => {
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
    });
    const fake = makeFakeAppState();

    installSweepTrigger(fake.appState);
    await flush();
    expect(calls).toBe(1); // cold start only

    fake.fire("background");
    fake.fire("inactive");
    await flush();
    expect(calls).toBe(1); // neither transition target is a background→active
  });
});

/** A hand-controlled promise: resolve/reject it from the test body. */
function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
} {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("onSweepSettled — owning-run publication (38.3 D-14)", () => {
  it("(a) publishes once per owning run, only after the last hook resolves", async () => {
    const first = deferred();
    const last = deferred();
    const settled = vi.fn();
    registerSweepHook(() => first.promise);
    registerSweepHook(() => last.promise);
    onSweepSettled(settled);

    const run = runLaunchSweep();
    await flush();
    expect(settled).not.toHaveBeenCalled();
    first.resolve();
    await flush();
    expect(settled).not.toHaveBeenCalled(); // second hook still pending
    last.resolve();
    await run;
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("(b) a re-entrant call publishes nothing of its own; one publication after the follow-up pass", async () => {
    const gates = [deferred(), deferred()];
    let pass = 0;
    registerSweepHook(() => {
      const gate = gates[pass];
      pass += 1;
      return gate.promise;
    });
    const settled = vi.fn();
    onSweepSettled(settled);

    const owning = runLaunchSweep();
    await flush();
    await runLaunchSweep(); // re-entrant: early-returns while pass 1 is gated
    expect(settled).not.toHaveBeenCalled();

    gates[0].resolve();
    await flush();
    expect(pass).toBe(2); // follow-up pass has started…
    expect(settled).not.toHaveBeenCalled(); // …and has not settled yet

    gates[1].resolve();
    await owning;
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("(c) a burst of three overlapping calls publishes once, after the single follow-up pass", async () => {
    const gates = [deferred(), deferred()];
    let pass = 0;
    registerSweepHook(() => {
      const gate = gates[pass];
      pass += 1;
      return gate.promise;
    });
    const settled = vi.fn();
    onSweepSettled(settled);

    const runs = [runLaunchSweep(), runLaunchSweep(), runLaunchSweep()];
    await flush();
    gates[0].resolve();
    await flush();
    expect(settled).not.toHaveBeenCalled();
    gates[1].resolve();
    await Promise.all(runs);
    expect(pass).toBe(2);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("(d) a throwing hook never suppresses the publication", async () => {
    registerSweepHook(
      async () => {
        throw new Error("private content");
      },
      { id: "boom" },
    );
    const settled = vi.fn();
    onSweepSettled(settled);
    await runLaunchSweep();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("(e) a throwing listener is isolated: a sibling still fires and the runner is not wedged", async () => {
    let calls = 0;
    registerSweepHook(async () => {
      calls += 1;
    });
    const throwing = vi.fn(() => {
      throw new Error("listener failure");
    });
    const sibling = vi.fn();
    onSweepSettled(throwing);
    onSweepSettled(sibling);

    await expect(runLaunchSweep()).resolves.toBeUndefined();
    expect(throwing).toHaveBeenCalledTimes(1);
    expect(sibling).toHaveBeenCalledTimes(1);

    // `running` was released in finally: a subsequent run still works.
    await runLaunchSweep();
    expect(calls).toBe(2);
    expect(sibling).toHaveBeenCalledTimes(2);
  });

  it("(f) unsubscribe stops delivery", async () => {
    const settled = vi.fn();
    const remove = onSweepSettled(settled);
    await runLaunchSweep();
    expect(settled).toHaveBeenCalledTimes(1);
    remove();
    await runLaunchSweep();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("publishes after the cold-start trigger's owning run", async () => {
    const settled = vi.fn();
    onSweepSettled(settled);
    const fake = makeFakeAppState();
    installSweepTrigger(fake.appState);
    await flush();
    expect(settled).toHaveBeenCalledTimes(1);
    fake.fire("background");
    fake.fire("active");
    await flush();
    expect(settled).toHaveBeenCalledTimes(2);
  });

  it("__resetSweepForTest clears listeners", async () => {
    const settled = vi.fn();
    onSweepSettled(settled);
    __resetSweepForTest();
    await runLaunchSweep();
    expect(settled).not.toHaveBeenCalled();
  });
});
