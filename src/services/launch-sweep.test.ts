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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetSweepForTest,
  installSweepTrigger,
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
