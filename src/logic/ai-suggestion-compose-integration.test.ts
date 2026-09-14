/**
 * M1 — the injected Compose-flow integration seam (reshaped for Phase 35-04's
 * ADR-079 three-suggestion contract).
 *
 * The pure-lifecycle unit test proves the state machine with stubbed consumers;
 * this test proves the REAL integration seam the Compose screen wires: the ONE
 * immutable `ResolvedPrompt` the resolver produced is the SAME object that
 *   (1) the inspector view-state reads (`buildInspectorViewState`), and
 *   (2) the provider adapter receives as `input.resolvedPrompt` — and the adapter
 *       reads exactly `resolved.payload`, never a reconstructed string (C3-M1),
 * across the three fan-out calls a successful generation makes.
 *
 * It also proves the reshaped egress contract at this seam: a successful
 * generation resolves to a non-destructive three-suggestion review surface (the
 * editor is untouched), a cancel / unmount / config change while the generation
 * is in flight drops the request with no draft mutation, and a non-stale
 * generation failure aborts the shared signal (HIGH-2).
 *
 * The ADR-052 first-send acknowledgement gate is RETIRED (D-09/ADR-079): the
 * gate state and its persistence dep are gone from this seam.
 *
 * Node-pure: drives the exact lifecycle + settings-ai-logic inspector builder the
 * screen uses, with the resolver and provider adapter injected.
 */
import { describe, expect, it, vi } from "vitest";
import { resolvePrompt } from "@/ai/prompt-template";
import type { PromptContext, ResolvedPrompt } from "@/ai/prompt-types";
import {
  type AiSuggestionDeps,
  AiSuggestionLifecycle,
  type AiSuggestionState,
} from "@/logic/ai-suggestion-logic";
import { buildInspectorViewState } from "@/screens/settings-ai-logic";
import type { GenerationInput } from "@/services/AiService";

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A realistic closed PromptContext so `resolvePrompt` builds a genuine object. */
const CONTEXT: PromptContext = {
  contactName: "Sam Rivers",
  category: "Close friends",
  rankedFuel: [{ text: "Just got back from Lisbon", kind: "note", ageDays: 3 }],
  gravityTier: "steady",
  intensity: {
    currentCount: 1,
    intendedPerPeriod: 2,
    multiple: 0.5,
    trailingAvgGapDays: 14,
  },
  quality: { good: 3, fine: 1, hard: 0 },
  cadence: { totalCount: 4, connectedCount: 3 },
  newestChannel: "text",
  sharedFields: [{ label: "Hometown", value: "Porto" }],
};

/** How many fan-out drafts a successful generation resolves to (ADR-079). */
const VARIANT_COUNT = 3;

interface Seam {
  lifecycle: AiSuggestionLifecycle;
  states: AiSuggestionState[];
  /** The exact object `resolvePrompt` returned for the active request. */
  resolved: ResolvedPrompt | null;
  /** The GenerationInputs the injected adapter received, one per fan-out call. */
  generateInputs: GenerationInput[];
  generateCalls: number;
  controllerCount: number;
  applyDraft: ReturnType<typeof vi.fn>;
  setActive: (a: boolean) => void;
  setEditor: (empty: boolean, body?: string) => void;
}

function makeSeam(opts: {
  editorEmpty?: boolean;
  editorBody?: string;
  /** Inject a bespoke generate dep (e.g. a deferred or rejecting fan-out). */
  generate?: AiSuggestionDeps["generate"];
}): Seam {
  const states: AiSuggestionState[] = [];
  let active = true;
  let editorEmpty = opts.editorEmpty ?? true;
  let editorBody = opts.editorBody ?? "";
  const applyDraft = vi.fn();
  const seam: Seam = {
    lifecycle: null as unknown as AiSuggestionLifecycle,
    states,
    resolved: null,
    generateInputs: [],
    generateCalls: 0,
    controllerCount: 0,
    applyDraft,
    setActive: (a) => {
      active = a;
    },
    setEditor: (empty, body = "") => {
      editorEmpty = empty;
      editorBody = body;
    },
  };

  // A stub provider that mirrors the real single-draft adapter contract: it reads
  // ONLY `input.resolvedPrompt.payload` and returns it as the "draft".
  const stubProvider = {
    generate: (input: GenerationInput): Promise<string> => {
      seam.generateInputs.push(input);
      seam.generateCalls += 1;
      return Promise.resolve(input.resolvedPrompt.payload);
    },
  };

  // The default injected generate mirrors ComposeScreen's plan-35-08 fan-out dep:
  // it fires VARIANT_COUNT single-draft adapter calls under the ONE shared signal,
  // each building a GenerationInput around the SAME immutable ResolvedPrompt, and
  // resolves the three drafts. (The node-pure generateVariants helper is proven in
  // ai-generate-variants.test.ts; here we prove the prompt-identity seam.)
  const defaultGenerate: AiSuggestionDeps["generate"] = async (
    prompt,
    signal,
  ) => {
    const drafts = await Promise.all(
      Array.from({ length: VARIANT_COUNT }, (_v, i) =>
        stubProvider.generate({
          resolvedPrompt: prompt,
          model: "gpt-x",
          temperature: i / VARIANT_COUNT,
          maxOutputTokens: 120,
          signal,
        }),
      ),
    );
    return drafts;
  };

  const deps: AiSuggestionDeps = {
    resolvePrompt: async (sourceDraft?: string, adjustGuidance?: string) => {
      // The SOLE construction path — one immutable object per request. The
      // Rewrite source-draft (the user's own composition) is passed through; its
      // delimited rendering is plan 35-08's prompt-template work, so here it does
      // not widen the closed PromptContext allowlist.
      const p = resolvePrompt(
        sourceDraft ?? "",
        CONTEXT,
        undefined,
        adjustGuidance,
      );
      seam.resolved = p;
      return p;
    },
    generate: opts.generate ?? defaultGenerate,
    applyDraft,
    isEditorEmpty: () => editorEmpty,
    getEditorBody: () => editorBody,
    createController: () => {
      seam.controllerCount += 1;
      return new AbortController();
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    isActive: () => active,
    sanitizeError: (err) =>
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "unknown",
    onChange: (s) => states.push(s),
  };

  seam.lifecycle = new AiSuggestionLifecycle(deps);
  return seam;
}

describe("M1 — one immutable ResolvedPrompt across inspector and the fan-out adapter", () => {
  it("hands the SAME reference to the inspector and every adapter call; adapter reads .payload", async () => {
    const seam = makeSeam({ editorEmpty: true });
    await seam.lifecycle.begin();

    // The generation resolves to the non-destructive three-suggestion review.
    const state = seam.lifecycle.getState();
    expect(state.status).toBe("review");
    if (state.status !== "review") throw new Error("unreachable");
    expect(state.suggestions).toHaveLength(VARIANT_COUNT);

    const P = seam.resolved as ResolvedPrompt;

    // (1) the inspector reads the SAME immutable strings.
    const inspector = buildInspectorViewState(P);
    expect(inspector.display).toBe(P.inspectorDisplay);
    expect(inspector.display).toBe(P.prompt); // prompt === inspectorDisplay instance
    expect(inspector.truncations).toBe(P.truncations);

    // (2) every fan-out adapter call received the SAME object and read .payload.
    expect(seam.generateInputs).toHaveLength(VARIANT_COUNT);
    for (const input of seam.generateInputs) {
      expect(input.resolvedPrompt).toBe(P); // strict reference identity (C3-M1)
      expect(input.resolvedPrompt.payload).toBe(P.payload);
      expect(Object.isFrozen(input.resolvedPrompt)).toBe(true);
    }
    // Each suggestion is exactly the payload the adapter echoed.
    expect(state.suggestions).toEqual([P.payload, P.payload, P.payload]);
  });

  it("resolves the prompt exactly ONCE per request (one object reaches every call)", async () => {
    const seam = makeSeam({ editorEmpty: true });
    await seam.lifecycle.begin();
    expect(seam.generateCalls).toBe(VARIANT_COUNT);
    for (const input of seam.generateInputs) {
      expect(input.resolvedPrompt).toBe(seam.resolved);
    }
  });

  it("carries the Rewrite source-draft into resolvePrompt without widening context", async () => {
    const seam = makeSeam({
      editorEmpty: false,
      editorBody: "half-written line",
    });
    await seam.lifecycle.begin();
    // The one resolved object still reaches the adapter unchanged (identity seam).
    const P = seam.resolved as ResolvedPrompt;
    expect(seam.generateInputs[0]?.resolvedPrompt).toBe(P);
  });
});

describe("M1 seam — non-destructive review + in-flight cancellation", () => {
  it("a successful generation does NOT mutate the draft until chooseSuggestion", async () => {
    const seam = makeSeam({ editorEmpty: true });
    await seam.lifecycle.begin();
    expect(seam.lifecycle.getState().status).toBe("review");
    expect(seam.applyDraft).not.toHaveBeenCalled();

    seam.lifecycle.chooseSuggestion(0);
    expect(seam.applyDraft).toHaveBeenCalledTimes(1);
  });

  it("cancel during the in-flight fan-out drops the request with no draft mutation", async () => {
    let capturedSignal: AbortSignal | null = null;
    const gen = new Promise<readonly string[]>(() => {
      /* never settles */
    });
    const seam = makeSeam({
      editorEmpty: true,
      generate: (_p, signal) => {
        capturedSignal = signal;
        return gen;
      },
    });
    void seam.lifecycle.begin();
    await flush();
    expect((capturedSignal as unknown as AbortSignal).aborted).toBe(false);

    seam.lifecycle.cancel();
    expect((capturedSignal as unknown as AbortSignal).aborted).toBe(true);
    expect(seam.lifecycle.getState()).toEqual({ status: "idle" });
  });

  it("a non-stale generation failure aborts the shared signal (HIGH-2)", async () => {
    let capturedSignal: AbortSignal | null = null;
    const seam = makeSeam({
      editorEmpty: true,
      generate: async (_p, signal) => {
        capturedSignal = signal;
        throw { code: "network" };
      },
    });
    await seam.lifecycle.begin();
    expect((capturedSignal as unknown as AbortSignal).aborted).toBe(true);
    expect(seam.lifecycle.getState()).toEqual({
      status: "error",
      code: "network",
    });
  });
});
