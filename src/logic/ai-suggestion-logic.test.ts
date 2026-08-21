/**
 * ai-suggestion-logic — proof of the one-request Compose AI lifecycle (14-05).
 *
 * Node-pure: every effect is injected, so this suite proves off-device that the
 * lifecycle keeps ONE request live, owns the SINGLE AbortController + timeout
 * (H4), gates the first send on acknowledgement (H5), orders egress strictly
 * after a durable ack (C2-H3), drops a stale intent after the ack await (C3-H4),
 * never auto-retries (T-14-07), requires confirmation before replacing a
 * non-empty draft (T-14-14), and exposes ONE immutable ResolvedPrompt reference
 * to both the gate view-state and the provider call (M1 / C3-M1).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedPrompt } from "@/ai/prompt-types";
import {
  AI_REQUEST_TIMEOUT_MS,
  AiSuggestionLifecycle,
  type AiSuggestionDeps,
  type AiSuggestionState,
  type RequestConfig,
} from "@/logic/ai-suggestion-logic";

/** Flush pending microtasks/timers so a fire-and-forget `begin()` reaches its
 * (deferred) `generate` call before assertions run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A deferred promise handle for driving async ordering deterministically. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Build a frozen ResolvedPrompt whose prompt/inspector/payload are one string. */
function makePrompt(text: string): ResolvedPrompt {
  return Object.freeze({
    prompt: text,
    inspectorDisplay: text,
    truncations: Object.freeze([]),
    payload: text,
  }) as ResolvedPrompt;
}

const CONFIG: RequestConfig = {
  provider: "openai",
  model: "gpt-x",
  contactId: 42,
};

interface Harness {
  lifecycle: AiSuggestionLifecycle;
  deps: {
    [K in keyof AiSuggestionDeps]: ReturnType<typeof vi.fn> & AiSuggestionDeps[K];
  };
  states: AiSuggestionState[];
  controllers: AbortController[];
  timers: Array<{ fn: () => void; ms: number }>;
  fireTimer: (i?: number) => void;
  prompt: ResolvedPrompt;
  /** Override the config `currentConfig()` returns (stale-guard tests). */
  setConfig: (c: RequestConfig) => void;
  /** Override the active flag `isActive()` returns. */
  setActive: (a: boolean) => void;
  /** Override the acknowledged flag. */
  setAcked: (a: boolean) => void;
}

function makeHarness(
  overrides: Partial<AiSuggestionDeps> = {},
  opts: {
    prompt?: ResolvedPrompt;
    acked?: boolean;
    draftEmpty?: boolean;
    generate?: AiSuggestionDeps["generate"];
    acknowledgeProvider?: AiSuggestionDeps["acknowledgeProvider"];
  } = {},
): Harness {
  const prompt = opts.prompt ?? makePrompt("PROMPT-BODY");
  const states: AiSuggestionState[] = [];
  const controllers: AbortController[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  let config = CONFIG;
  let active = true;
  let acked = opts.acked ?? false;

  const deps = {
    resolvePrompt: vi.fn(async () => prompt),
    isProviderAcknowledged: vi.fn(() => acked),
    acknowledgeProvider:
      opts.acknowledgeProvider ?? vi.fn(async () => undefined),
    generate: opts.generate ?? vi.fn(async () => "SUGGESTED DRAFT"),
    applyDraft: vi.fn(),
    isDraftEmpty: vi.fn(() => opts.draftEmpty ?? true),
    createController: vi.fn(() => {
      const c = new AbortController();
      controllers.push(c);
      return c;
    }),
    setTimer: vi.fn((fn: () => void, ms: number) => {
      const handle = { fn, ms };
      timers.push(handle);
      return handle;
    }),
    clearTimer: vi.fn(),
    isActive: vi.fn(() => active),
    currentConfig: vi.fn(() => config),
    sanitizeError: vi.fn((err: unknown) =>
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "unknown",
    ),
    onChange: vi.fn((s: AiSuggestionState) => {
      states.push(s);
    }),
    ...overrides,
  } as Harness["deps"];

  const lifecycle = new AiSuggestionLifecycle(deps);
  return {
    lifecycle,
    deps,
    states,
    controllers,
    timers,
    prompt,
    fireTimer: (i = 0) => timers[i]?.fn(),
    setConfig: (c) => {
      config = c;
    },
    setActive: (a) => {
      active = a;
    },
    setAcked: (a) => {
      acked = a;
    },
  };
}

describe("AiSuggestionLifecycle — ack gate (H5)", () => {
  it("blocks the first send until acknowledgement — no generate before ack", async () => {
    const h = makeHarness({}, { acked: false });
    await h.lifecycle.begin();

    expect(h.lifecycle.getState()).toEqual({
      status: "needs-acknowledgement",
      provider: "openai",
      prompt: h.prompt,
    });
    expect(h.deps.generate).not.toHaveBeenCalled();
    expect(h.deps.createController).not.toHaveBeenCalled();
  });

  it("a declined provider makes NO network call and returns to idle", async () => {
    const h = makeHarness({}, { acked: false });
    await h.lifecycle.begin();
    h.lifecycle.decline();

    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
    expect(h.deps.acknowledgeProvider).not.toHaveBeenCalled();
    expect(h.deps.generate).not.toHaveBeenCalled();
  });

  it("acknowledge persists the ack THEN dispatches with the same prompt (C2-H3)", async () => {
    const h = makeHarness({}, { acked: false });
    await h.lifecycle.begin();
    await h.lifecycle.acknowledge();

    expect(h.deps.acknowledgeProvider).toHaveBeenCalledTimes(1);
    expect(h.deps.generate).toHaveBeenCalledTimes(1);
    // Same immutable prompt reference reached the provider (M1 / C3-M1).
    expect(h.deps.generate.mock.calls[0][0]).toBe(h.prompt);
    expect(h.deps.generate.mock.calls[0][0].payload).toBe(h.prompt.payload);
  });

  it("an already-acknowledged provider skips the gate entirely", async () => {
    const h = makeHarness({}, { acked: true });
    await h.lifecycle.begin();

    expect(h.deps.acknowledgeProvider).not.toHaveBeenCalled();
    expect(h.deps.generate).toHaveBeenCalledTimes(1);
  });
});

describe("AiSuggestionLifecycle — durable-ack ordering (C2-H3)", () => {
  it("creates NO controller and calls NO generate until the ack write resolves", async () => {
    const ack = deferred<void>();
    const h = makeHarness(
      {},
      { acked: false, acknowledgeProvider: vi.fn(() => ack.promise) },
    );
    await h.lifecycle.begin();
    const ackP = h.lifecycle.acknowledge();

    // Ack in flight — nothing may egress yet.
    expect(h.deps.createController).not.toHaveBeenCalled();
    expect(h.deps.generate).not.toHaveBeenCalled();

    ack.resolve();
    await ackP;
    expect(h.deps.createController).toHaveBeenCalledTimes(1);
    expect(h.deps.generate).toHaveBeenCalledTimes(1);
  });

  it("a REJECTED ack write results in ZERO generate calls", async () => {
    const h = makeHarness(
      {},
      {
        acked: false,
        acknowledgeProvider: vi.fn(async () => {
          throw { code: "network" };
        }),
      },
    );
    await h.lifecycle.begin();
    await h.lifecycle.acknowledge();

    expect(h.deps.generate).not.toHaveBeenCalled();
    expect(h.deps.createController).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({ status: "error", code: "network" });
  });
});

describe("AiSuggestionLifecycle — stale guard after the ack await (C3-H4)", () => {
  it("drops the request if Cancel happens during the pending ack", async () => {
    const ack = deferred<void>();
    const h = makeHarness(
      {},
      { acked: false, acknowledgeProvider: vi.fn(() => ack.promise) },
    );
    await h.lifecycle.begin();
    const ackP = h.lifecycle.acknowledge();
    h.lifecycle.cancel(); // during the pending ack
    ack.resolve();
    await ackP;

    expect(h.deps.createController).not.toHaveBeenCalled();
    expect(h.deps.generate).not.toHaveBeenCalled();
  });

  it("drops the request if unmount/navigation happens during the pending ack", async () => {
    const ack = deferred<void>();
    const h = makeHarness(
      {},
      { acked: false, acknowledgeProvider: vi.fn(() => ack.promise) },
    );
    await h.lifecycle.begin();
    const ackP = h.lifecycle.acknowledge();
    h.lifecycle.dispose(); // navigated away / unmounted
    ack.resolve();
    await ackP;

    expect(h.deps.createController).not.toHaveBeenCalled();
    expect(h.deps.generate).not.toHaveBeenCalled();
  });

  it("drops the request if the config changes during the pending ack", async () => {
    const ack = deferred<void>();
    const h = makeHarness(
      {},
      { acked: false, acknowledgeProvider: vi.fn(() => ack.promise) },
    );
    await h.lifecycle.begin();
    const ackP = h.lifecycle.acknowledge();
    // Model changed under the pending ack, but nothing bumped the token.
    h.setConfig({ provider: "openai", model: "gpt-y", contactId: 42 });
    ack.resolve();
    await ackP;

    expect(h.deps.createController).not.toHaveBeenCalled();
    expect(h.deps.generate).not.toHaveBeenCalled();
  });

  it("drops the request if the screen is inactive after the ack resolves", async () => {
    const ack = deferred<void>();
    const h = makeHarness(
      {},
      { acked: false, acknowledgeProvider: vi.fn(() => ack.promise) },
    );
    await h.lifecycle.begin();
    const ackP = h.lifecycle.acknowledge();
    h.setActive(false);
    ack.resolve();
    await ackP;

    expect(h.deps.generate).not.toHaveBeenCalled();
  });

  it("an UNCHANGED intent proceeds to egress after the ack resolves", async () => {
    const ack = deferred<void>();
    const h = makeHarness(
      {},
      { acked: false, acknowledgeProvider: vi.fn(() => ack.promise) },
    );
    await h.lifecycle.begin();
    const ackP = h.lifecycle.acknowledge();
    ack.resolve();
    await ackP;

    expect(h.deps.createController).toHaveBeenCalledTimes(1);
    expect(h.deps.generate).toHaveBeenCalledTimes(1);
  });
});

describe("AiSuggestionLifecycle — single controller ownership (H4)", () => {
  it("hands the sole controller's signal to generate", async () => {
    const gen = deferred<string>();
    const h = makeHarness(
      {},
      { acked: true, generate: vi.fn(() => gen.promise) },
    );
    void h.lifecycle.begin();
    await flush();

    expect(h.controllers).toHaveLength(1);
    expect(h.deps.generate.mock.calls[0][1]).toBe(h.controllers[0].signal);
    gen.resolve("draft");
  });

  it("Cancel aborts the SAME controller that was handed to generate", async () => {
    const gen = deferred<string>();
    const h = makeHarness(
      {},
      { acked: true, generate: vi.fn(() => gen.promise) },
    );
    void h.lifecycle.begin();
    await flush();
    const signal = h.deps.generate.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);

    h.lifecycle.cancel();
    expect(signal.aborted).toBe(true);
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("unmount aborts the SAME controller handed to generate", async () => {
    const gen = deferred<string>();
    const h = makeHarness(
      {},
      { acked: true, generate: vi.fn(() => gen.promise) },
    );
    void h.lifecycle.begin();
    await flush();
    const signal = h.deps.generate.mock.calls[0][1] as AbortSignal;

    h.lifecycle.dispose();
    expect(signal.aborted).toBe(true);
  });

  it("a config change aborts the SAME controller handed to generate", async () => {
    const gen = deferred<string>();
    const h = makeHarness(
      {},
      { acked: true, generate: vi.fn(() => gen.promise) },
    );
    void h.lifecycle.begin();
    await flush();
    const signal = h.deps.generate.mock.calls[0][1] as AbortSignal;

    h.lifecycle.onConfigChange();
    expect(signal.aborted).toBe(true);
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("a second begin aborts the first request's controller (one request at a time)", async () => {
    const gen1 = deferred<string>();
    const gen2 = deferred<string>();
    const generate = vi
      .fn()
      .mockReturnValueOnce(gen1.promise)
      .mockReturnValueOnce(gen2.promise);
    const h = makeHarness({}, { acked: true, generate });
    void h.lifecycle.begin();
    await flush();
    const firstSignal = h.controllers[0].signal;

    void h.lifecycle.begin();
    await flush();
    expect(firstSignal.aborted).toBe(true);
    expect(h.controllers).toHaveLength(2);
    gen1.resolve("stale");
    gen2.resolve("fresh");
  });
});

describe("AiSuggestionLifecycle — timeout owned by the lifecycle (H4)", () => {
  it("arms the 20s timeout with the lifecycle's own timer", async () => {
    const gen = deferred<string>();
    const h = makeHarness(
      {},
      { acked: true, generate: vi.fn(() => gen.promise) },
    );
    void h.lifecycle.begin();
    await flush();

    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(AI_REQUEST_TIMEOUT_MS);
    gen.resolve("draft");
  });

  it("a fired timeout aborts the controller and surfaces a sanitized timeout", async () => {
    const gen = deferred<string>();
    const h = makeHarness(
      {},
      { acked: true, generate: vi.fn(() => gen.promise) },
    );
    void h.lifecycle.begin();
    await flush();
    const signal = h.controllers[0].signal;

    h.fireTimer();
    expect(signal.aborted).toBe(true);
    expect(h.lifecycle.getState()).toEqual({ status: "error", code: "timeout" });

    // A late completion after the timeout cannot mutate anything.
    gen.resolve("late draft");
    await flush();
    expect(h.deps.applyDraft).not.toHaveBeenCalled();
  });
});

describe("AiSuggestionLifecycle — draft replacement (T-14-14)", () => {
  it("applies a validated draft directly when the editor is empty", async () => {
    const h = makeHarness({}, { acked: true, draftEmpty: true });
    await h.lifecycle.begin();

    expect(h.deps.applyDraft).toHaveBeenCalledWith("SUGGESTED DRAFT");
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("requires confirmation before replacing a NON-empty draft", async () => {
    const h = makeHarness({}, { acked: true, draftEmpty: false });
    await h.lifecycle.begin();

    expect(h.deps.applyDraft).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({
      status: "confirm-replace",
      suggestion: "SUGGESTED DRAFT",
    });

    h.lifecycle.confirmReplace();
    expect(h.deps.applyDraft).toHaveBeenCalledWith("SUGGESTED DRAFT");
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("cancelReplace keeps the existing draft untouched", async () => {
    const h = makeHarness({}, { acked: true, draftEmpty: false });
    await h.lifecycle.begin();
    h.lifecycle.cancelReplace();

    expect(h.deps.applyDraft).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });
});

describe("AiSuggestionLifecycle — stale completion + explicit retry", () => {
  it("a cancelled request's later completion cannot mutate the draft", async () => {
    const gen = deferred<string>();
    const h = makeHarness(
      {},
      { acked: true, draftEmpty: true, generate: vi.fn(() => gen.promise) },
    );
    void h.lifecycle.begin();
    await flush();
    h.lifecycle.cancel();
    gen.resolve("STALE DRAFT");
    await flush();

    expect(h.deps.applyDraft).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("never auto-retries after an error; retry() starts a fresh request", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce({ code: "network" })
      .mockResolvedValueOnce("RETRY DRAFT");
    const h = makeHarness({}, { acked: true, draftEmpty: true, generate });
    await h.lifecycle.begin();

    expect(h.lifecycle.getState()).toEqual({ status: "error", code: "network" });
    expect(generate).toHaveBeenCalledTimes(1); // no automatic retry

    await h.lifecycle.retry();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(h.deps.applyDraft).toHaveBeenCalledWith("RETRY DRAFT");
  });
});

describe("AiSuggestionLifecycle — one immutable prompt across consumers (M1)", () => {
  it("exposes the SAME ResolvedPrompt reference to the gate view-state and generate", async () => {
    const prompt = makePrompt("IDENTITY BODY");
    const h = makeHarness({}, { prompt, acked: false });
    await h.lifecycle.begin();

    // The needs-acknowledgement state carries the exact object the inspector +
    // acknowledgement views render.
    const gated = h.lifecycle.getState();
    expect(gated.status).toBe("needs-acknowledgement");
    if (gated.status === "needs-acknowledgement") {
      expect(gated.prompt).toBe(prompt);
    }
    expect(h.deps.resolvePrompt).toHaveBeenCalledTimes(1);

    await h.lifecycle.acknowledge();
    // The provider received the very same object (strict reference identity).
    expect(h.deps.generate.mock.calls[0][0]).toBe(prompt);
  });
});
