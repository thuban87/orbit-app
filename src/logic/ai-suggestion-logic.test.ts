/**
 * ai-suggestion-logic — proof of the ADR-079 three-suggestion Compose AI
 * lifecycle (Phase 35-04, reshaped from Plan 14-05).
 *
 * Node-pure: every effect is injected, so this suite proves off-device that the
 * lifecycle keeps ONE request live, owns the SINGLE AbortController + timeout
 * (H4), decides Draft-vs-Rewrite via the injected `isEditorEmpty` predicate and
 * carries the Rewrite source-draft through `resolvePrompt`, resolves to a
 * non-destructive three-suggestion review surface (the editor is untouched until
 * an explicit `chooseSuggestion`), aborts its sole controller on a non-stale
 * generation failure so a fan-out rejection cancels the in-flight siblings
 * (HIGH-2), never auto-retries (T-14-07), and drops a stale/superseded
 * completion. There is NO ack gate (D-09/ADR-079) and NO single-suggestion
 * confirm-replace shape.
 */
import { describe, expect, it, vi } from "vitest";
import type { ResolvedPrompt } from "@/ai/prompt-types";
import { generateVariants } from "@/logic/ai-generate-variants";
import {
  AI_REQUEST_TIMEOUT_MS,
  type AiSuggestionDeps,
  AiSuggestionLifecycle,
  type AiSuggestionState,
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

/** The three drafts a successful fan-out resolves to, in deterministic order. */
const THREE = ["ALPHA", "BRAVO", "CHARLIE"] as const;

interface Harness {
  lifecycle: AiSuggestionLifecycle;
  deps: {
    [K in keyof AiSuggestionDeps]: ReturnType<typeof vi.fn> &
      AiSuggestionDeps[K];
  };
  states: AiSuggestionState[];
  controllers: AbortController[];
  timers: Array<{ fn: () => void; ms: number }>;
  fireTimer: (i?: number) => void;
  prompt: ResolvedPrompt;
  /** Override the active flag `isActive()` returns. */
  setActive: (a: boolean) => void;
  /** Override the editor-empty predicate + body. */
  setEditor: (empty: boolean, body?: string) => void;
}

function makeHarness(
  overrides: Partial<AiSuggestionDeps> = {},
  opts: {
    prompt?: ResolvedPrompt;
    editorEmpty?: boolean;
    editorBody?: string;
    generate?: AiSuggestionDeps["generate"];
  } = {},
): Harness {
  const prompt = opts.prompt ?? makePrompt("PROMPT-BODY");
  const states: AiSuggestionState[] = [];
  const controllers: AbortController[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  let active = true;
  let editorEmpty = opts.editorEmpty ?? true;
  let editorBody = opts.editorBody ?? "";

  const deps = {
    resolvePrompt: vi.fn(async (_sourceDraft?: string) => prompt),
    generate:
      opts.generate ?? vi.fn(async () => [...THREE] as readonly string[]),
    applyDraft: vi.fn(),
    isEditorEmpty: vi.fn(() => editorEmpty),
    getEditorBody: vi.fn(() => editorBody),
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
    setActive: (a) => {
      active = a;
    },
    setEditor: (empty, body = "") => {
      editorEmpty = empty;
      editorBody = body;
    },
  };
}

describe("AiSuggestionLifecycle — three-suggestion success (ADR-079)", () => {
  it("exposes exactly three unlabeled suggestions and does NOT mutate the draft", async () => {
    const h = makeHarness({}, { editorEmpty: true });
    await h.lifecycle.begin();

    expect(h.lifecycle.getState()).toEqual({
      status: "review",
      suggestions: ["ALPHA", "BRAVO", "CHARLIE"],
    });
    // Generation is non-destructive: nothing is applied until chooseSuggestion.
    expect(h.deps.applyDraft).not.toHaveBeenCalled();
  });

  it("chooseSuggestion(index) applies EXACTLY one suggestion, then idles", async () => {
    const h = makeHarness({}, { editorEmpty: true });
    await h.lifecycle.begin();

    h.lifecycle.chooseSuggestion(1);
    expect(h.deps.applyDraft).toHaveBeenCalledTimes(1);
    expect(h.deps.applyDraft).toHaveBeenCalledWith("BRAVO");
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("an out-of-range chooseSuggestion index is a no-op", async () => {
    const h = makeHarness({}, { editorEmpty: true });
    await h.lifecycle.begin();

    h.lifecycle.chooseSuggestion(9);
    expect(h.deps.applyDraft).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({
      status: "review",
      suggestions: ["ALPHA", "BRAVO", "CHARLIE"],
    });
  });

  it("has NO needs-acknowledgement state — begin() goes straight to egress", async () => {
    const h = makeHarness({}, { editorEmpty: true });
    await h.lifecycle.begin();

    // The gate is gone: a single generate fires with no ack await.
    expect(h.deps.generate).toHaveBeenCalledTimes(1);
    const seen = h.states.map((s) => s.status);
    expect(seen).not.toContain("needs-acknowledgement");
    expect(seen).toEqual(["resolving", "loading", "review"]);
  });
});

describe("AiSuggestionLifecycle — Draft vs Rewrite source-draft carry (HIGH-3)", () => {
  it("Draft (empty editor) calls resolvePrompt with NO sourceDraft (undefined)", async () => {
    const h = makeHarness({}, { editorEmpty: true, editorBody: "" });
    await h.lifecycle.begin();

    expect(h.deps.resolvePrompt).toHaveBeenCalledTimes(1);
    expect(h.deps.resolvePrompt).toHaveBeenCalledWith(undefined);
  });

  it("Rewrite (non-empty editor) calls resolvePrompt WITH the current editor body", async () => {
    const h = makeHarness(
      {},
      { editorEmpty: false, editorBody: "my own half-written note" },
    );
    await h.lifecycle.begin();

    expect(h.deps.resolvePrompt).toHaveBeenCalledTimes(1);
    expect(h.deps.resolvePrompt).toHaveBeenCalledWith(
      "my own half-written note",
    );
  });
});

describe("AiSuggestionLifecycle — single controller ownership (H4)", () => {
  it("hands the sole controller's signal to generate", async () => {
    const gen = deferred<readonly string[]>();
    const h = makeHarness({}, { generate: vi.fn(() => gen.promise) });
    void h.lifecycle.begin();
    await flush();

    expect(h.controllers).toHaveLength(1);
    expect(h.deps.generate.mock.calls[0][1]).toBe(h.controllers[0].signal);
    gen.resolve([...THREE]);
  });

  it("Cancel aborts the SAME controller handed to generate and preserves the draft", async () => {
    const gen = deferred<readonly string[]>();
    const h = makeHarness({}, { generate: vi.fn(() => gen.promise) });
    void h.lifecycle.begin();
    await flush();
    const signal = h.deps.generate.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);

    h.lifecycle.cancel();
    expect(signal.aborted).toBe(true);
    expect(h.deps.applyDraft).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("unmount aborts the SAME controller handed to generate", async () => {
    const gen = deferred<readonly string[]>();
    const h = makeHarness({}, { generate: vi.fn(() => gen.promise) });
    void h.lifecycle.begin();
    await flush();
    const signal = h.deps.generate.mock.calls[0][1] as AbortSignal;

    h.lifecycle.dispose();
    expect(signal.aborted).toBe(true);
  });

  it("a config change aborts the SAME controller handed to generate", async () => {
    const gen = deferred<readonly string[]>();
    const h = makeHarness({}, { generate: vi.fn(() => gen.promise) });
    void h.lifecycle.begin();
    await flush();
    const signal = h.deps.generate.mock.calls[0][1] as AbortSignal;

    h.lifecycle.onConfigChange();
    expect(signal.aborted).toBe(true);
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("a second begin aborts the first request's controller (one request at a time)", async () => {
    const gen1 = deferred<readonly string[]>();
    const gen2 = deferred<readonly string[]>();
    const generate = vi
      .fn()
      .mockReturnValueOnce(gen1.promise)
      .mockReturnValueOnce(gen2.promise);
    const h = makeHarness({}, { generate });
    void h.lifecycle.begin();
    await flush();
    const firstSignal = h.controllers[0].signal;

    void h.lifecycle.begin();
    await flush();
    expect(firstSignal.aborted).toBe(true);
    expect(h.controllers).toHaveLength(2);
    gen1.resolve(["stale"]);
    gen2.resolve([...THREE]);
  });
});

describe("AiSuggestionLifecycle — non-stale failure aborts the controller (HIGH-2)", () => {
  it("aborts its AbortController when generate rejects on a non-stale request", async () => {
    // A recording generate captures the signal it was handed and then rejects.
    let capturedSignal: AbortSignal | null = null;
    const generate = vi.fn(async (_p: ResolvedPrompt, signal: AbortSignal) => {
      capturedSignal = signal;
      throw { code: "network" };
    });
    const h = makeHarness({}, { editorEmpty: true, generate });
    await h.lifecycle.begin();

    // HIGH-2: on a non-stale rejection the lifecycle aborts its controller so the
    // still-in-flight sibling provider calls (sharing this signal) are cancelled.
    expect(capturedSignal).not.toBeNull();
    expect((capturedSignal as unknown as AbortSignal).aborted).toBe(true);
    // The manual draft is preserved and a code-only error is surfaced.
    expect(h.deps.applyDraft).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({
      status: "error",
      code: "network",
    });
  });
});

describe("AiSuggestionLifecycle — fan-out sibling cancellation end-to-end (HIGH-2)", () => {
  it("cancels the in-flight siblings when one fan-out call rejects", async () => {
    // Wire `generate` to the REAL generateVariants fan-out. The 2nd call rejects;
    // the 1st and 3rd never settle (still in flight). The lifecycle must abort its
    // controller on the propagated rejection, so the siblings' shared signal — the
    // exact one each generateOne captured — becomes aborted (no orphaned egress).
    const capturedSignals: AbortSignal[] = [];
    const recordingGenerateOne = vi.fn(
      (_p: ResolvedPrompt, signal: AbortSignal, index: number) => {
        capturedSignals[index] = signal;
        if (index === 1) return Promise.reject({ code: "network" });
        return new Promise<string>(() => {
          /* still in flight */
        });
      },
    );
    const h = makeHarness(
      {},
      {
        editorEmpty: true,
        generate: vi.fn((prompt, signal) =>
          generateVariants(recordingGenerateOne, prompt, signal, 3),
        ),
      },
    );

    await h.lifecycle.begin();

    expect(recordingGenerateOne).toHaveBeenCalledTimes(3);
    // Sibling calls 0 and 2 observe the abort the lifecycle performed (HIGH-2).
    expect(capturedSignals[0].aborted).toBe(true);
    expect(capturedSignals[2].aborted).toBe(true);
    expect(h.deps.applyDraft).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({
      status: "error",
      code: "network",
    });
  });
});

describe("AiSuggestionLifecycle — timeout owned by the lifecycle (H4)", () => {
  it("arms the 20s timeout with the lifecycle's own timer", async () => {
    const gen = deferred<readonly string[]>();
    const h = makeHarness({}, { generate: vi.fn(() => gen.promise) });
    void h.lifecycle.begin();
    await flush();

    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(AI_REQUEST_TIMEOUT_MS);
    gen.resolve([...THREE]);
  });

  it("a fired timeout aborts the controller, surfaces timeout, preserves the draft", async () => {
    const gen = deferred<readonly string[]>();
    const h = makeHarness({}, { generate: vi.fn(() => gen.promise) });
    void h.lifecycle.begin();
    await flush();
    const signal = h.controllers[0].signal;

    h.fireTimer();
    expect(signal.aborted).toBe(true);
    expect(h.lifecycle.getState()).toEqual({
      status: "error",
      code: "timeout",
    });

    // A late completion after the timeout cannot mutate anything.
    gen.resolve([...THREE]);
    await flush();
    expect(h.deps.applyDraft).not.toHaveBeenCalled();
  });
});

describe("AiSuggestionLifecycle — stale completion + explicit retry", () => {
  it("a cancelled request's later completion cannot mutate the draft", async () => {
    const gen = deferred<readonly string[]>();
    const h = makeHarness({}, { generate: vi.fn(() => gen.promise) });
    void h.lifecycle.begin();
    await flush();
    h.lifecycle.cancel();
    gen.resolve([...THREE]);
    await flush();

    expect(h.deps.applyDraft).not.toHaveBeenCalled();
    expect(h.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("retry() replaces the three suggestions and retains NO history", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(["A1", "A2", "A3"])
      .mockResolvedValueOnce(["B1", "B2", "B3"]);
    const h = makeHarness({}, { editorEmpty: true, generate });
    await h.lifecycle.begin();
    expect(h.lifecycle.getState()).toEqual({
      status: "review",
      suggestions: ["A1", "A2", "A3"],
    });

    await h.lifecycle.retry();
    // The whole set is replaced; there is no accumulated history.
    expect(generate).toHaveBeenCalledTimes(2);
    expect(h.lifecycle.getState()).toEqual({
      status: "review",
      suggestions: ["B1", "B2", "B3"],
    });
  });

  it("never auto-retries after an error; retry() starts a fresh request", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce({ code: "network" })
      .mockResolvedValueOnce([...THREE]);
    const h = makeHarness({}, { editorEmpty: true, generate });
    await h.lifecycle.begin();

    expect(h.lifecycle.getState()).toEqual({
      status: "error",
      code: "network",
    });
    expect(generate).toHaveBeenCalledTimes(1); // no automatic retry

    await h.lifecycle.retry();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(h.lifecycle.getState()).toEqual({
      status: "review",
      suggestions: ["ALPHA", "BRAVO", "CHARLIE"],
    });
  });
});

describe("AiSuggestionLifecycle — one immutable prompt reaches generate (M1)", () => {
  it("hands the SAME ResolvedPrompt reference the resolver produced to generate", async () => {
    const prompt = makePrompt("IDENTITY BODY");
    const h = makeHarness({}, { prompt, editorEmpty: true });
    await h.lifecycle.begin();

    expect(h.deps.resolvePrompt).toHaveBeenCalledTimes(1);
    expect(h.deps.generate.mock.calls[0][0]).toBe(prompt);
    expect(h.deps.generate.mock.calls[0][0].payload).toBe(prompt.payload);
  });
});

describe("AiSuggestionLifecycle — dispose never strands (regression)", () => {
  it("dispose() during 'resolving' resets the visible state to idle", async () => {
    let release: (p: ResolvedPrompt) => void = () => {};
    const pending = new Promise<ResolvedPrompt>((res) => {
      release = res;
    });
    const h = makeHarness({ resolvePrompt: vi.fn(() => pending) });

    const begun = h.lifecycle.begin();
    expect(h.states.at(-1)?.status).toBe("resolving");

    h.lifecycle.dispose();
    expect(h.states.at(-1)?.status).toBe("idle");

    // The now-stale deferred resolution must not resurrect the flow.
    release(h.prompt);
    await begun;
    expect(h.states.at(-1)?.status).toBe("idle");
    expect(h.deps.generate).not.toHaveBeenCalled();
  });
});
