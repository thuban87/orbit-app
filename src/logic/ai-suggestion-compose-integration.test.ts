/**
 * M1 — the injected Compose-flow integration test (Plan 14-05).
 *
 * The pure-lifecycle unit test proves the state machine with stubbed consumers;
 * this test proves the REAL integration seam the Compose screen wires: the ONE
 * immutable `ResolvedPrompt` the resolver produced is the SAME object that
 *   (1) the inspector view-state reads (`buildInspectorViewState`),
 *   (2) the per-provider acknowledgement view reads (`buildProviderAckViewState`),
 *   (3) the provider adapter receives as `input.resolvedPrompt` — and the adapter
 *       reads exactly `resolved.payload`, never a reconstructed string (C3-M1).
 *
 * It also proves the egress ordering (C2-H3) and stale-guard (C3-H4) at this
 * seam: with a controllable ack, NO controller is created and NO `generate`
 * fires until the durable ack resolves; a rejected ack yields zero `generate`;
 * and a cancel / unmount / config change DURING the pending ack drops the request.
 *
 * Node-pure: drives the exact lifecycle + settings-ai-logic builders the screen
 * uses, with the resolver and provider adapter injected.
 */
import { describe, expect, it, vi } from "vitest";
import type { GenerationInput } from "@/services/AiService";
import type { PromptContext, ResolvedPrompt } from "@/ai/prompt-types";
import { resolvePrompt } from "@/ai/prompt-template";
import {
  buildInspectorViewState,
  buildProviderAckViewState,
} from "@/screens/settings-ai-logic";
import {
  AiSuggestionLifecycle,
  type AiSuggestionDeps,
  type AiSuggestionState,
  type RequestConfig,
} from "@/logic/ai-suggestion-logic";

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

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

const CONFIG: RequestConfig = {
  provider: "openai",
  model: "gpt-x",
  contactId: 7,
};

interface Seam {
  lifecycle: AiSuggestionLifecycle;
  states: AiSuggestionState[];
  /** The exact object `resolvePrompt` returned for the active request. */
  resolved: ResolvedPrompt | null;
  /** The GenerationInput the injected adapter received (C3-M1). */
  generateInput: GenerationInput | null;
  generateCalls: number;
  controllerCount: number;
  setActive: (a: boolean) => void;
  setConfig: (c: RequestConfig) => void;
  setAcked: (a: boolean) => void;
}

function makeSeam(opts: {
  acked?: boolean;
  draftEmpty?: boolean;
  acknowledgeProvider?: AiSuggestionDeps["acknowledgeProvider"];
}): Seam {
  const states: AiSuggestionState[] = [];
  let active = true;
  let config = CONFIG;
  let acked = opts.acked ?? false;
  const seam: Seam = {
    lifecycle: null as unknown as AiSuggestionLifecycle,
    states,
    resolved: null,
    generateInput: null,
    generateCalls: 0,
    controllerCount: 0,
    setActive: (a) => {
      active = a;
    },
    setConfig: (c) => {
      config = c;
    },
    setAcked: (a) => {
      acked = a;
    },
  };

  // A stub provider that mirrors the real adapter contract: it reads ONLY
  // `input.resolvedPrompt.payload` and returns it as the "draft".
  const stubProvider = {
    generate: (input: GenerationInput): Promise<string> => {
      seam.generateInput = input;
      seam.generateCalls += 1;
      return Promise.resolve(input.resolvedPrompt.payload);
    },
  };

  const deps: AiSuggestionDeps = {
    resolvePrompt: async () => {
      // The SOLE construction path — one immutable object per request.
      const p = resolvePrompt("", CONTEXT);
      seam.resolved = p;
      return p;
    },
    isProviderAcknowledged: () => acked,
    acknowledgeProvider:
      opts.acknowledgeProvider ?? (async () => undefined),
    // Mirror ComposeScreen's dep: build the GenerationInput, forward the signal,
    // and call the adapter (which reads only `.payload`).
    generate: (prompt, signal) =>
      stubProvider.generate({
        resolvedPrompt: prompt,
        model: config.model,
        temperature: 0.7,
        maxOutputTokens: 120,
        signal,
      }),
    applyDraft: vi.fn(),
    isDraftEmpty: () => opts.draftEmpty ?? true,
    createController: () => {
      seam.controllerCount += 1;
      return new AbortController();
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    isActive: () => active,
    currentConfig: () => config,
    sanitizeError: (err) =>
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "unknown",
    onChange: (s) => states.push(s),
  };

  seam.lifecycle = new AiSuggestionLifecycle(deps);
  return seam;
}

describe("M1 — one immutable ResolvedPrompt across inspector, ack, and adapter", () => {
  it("hands the SAME reference to all three consumers and the adapter reads .payload", async () => {
    const seam = makeSeam({ acked: false });
    await seam.lifecycle.begin();

    // The gate carries the exact object the resolver built.
    const gate = seam.lifecycle.getState();
    expect(gate.status).toBe("needs-acknowledgement");
    if (gate.status !== "needs-acknowledgement") throw new Error("unreachable");
    const P = seam.resolved as ResolvedPrompt;
    expect(gate.prompt).toBe(P);

    // (1) inspector + (2) acknowledgement read the SAME immutable strings.
    const inspector = buildInspectorViewState(gate.prompt);
    const ack = buildProviderAckViewState(gate.provider, gate.prompt);
    expect(inspector.display).toBe(P.inspectorDisplay);
    expect(inspector.display).toBe(P.prompt); // prompt === inspectorDisplay instance
    expect(ack.prompt).toBe(P.prompt);
    expect(inspector.truncations).toBe(P.truncations);

    // (3) the adapter receives the SAME object and reads exactly .payload.
    await seam.lifecycle.acknowledge();
    expect(seam.generateInput).not.toBeNull();
    const input = seam.generateInput as GenerationInput;
    expect(input.resolvedPrompt).toBe(P); // strict reference identity (C3-M1)
    expect(input.resolvedPrompt.payload).toBe(P.payload);
    // The object is deeply frozen (no consumer could have rebuilt it).
    expect(Object.isFrozen(input.resolvedPrompt)).toBe(true);
  });

  it("resolves the prompt exactly ONCE per request (one object reaches the adapter)", async () => {
    const seam = makeSeam({ acked: true });
    await seam.lifecycle.begin();
    expect(seam.generateCalls).toBe(1);
    // The one resolved object is the very instance the adapter received.
    expect(seam.generateInput?.resolvedPrompt).toBe(seam.resolved);
  });
});

describe("M1 seam — declined / unacknowledged provider makes no network call (H5)", () => {
  it("issues no generate when the gate is declined", async () => {
    const seam = makeSeam({ acked: false });
    await seam.lifecycle.begin();
    seam.lifecycle.decline();
    await flush();
    expect(seam.generateCalls).toBe(0);
    expect(seam.controllerCount).toBe(0);
  });
});

describe("M1 seam — egress strictly after a durable ack (C2-H3)", () => {
  it("no controller and no generate until the ack write resolves", async () => {
    const ack = deferred<void>();
    const seam = makeSeam({
      acked: false,
      acknowledgeProvider: () => ack.promise,
    });
    await seam.lifecycle.begin();
    const ackP = seam.lifecycle.acknowledge();

    expect(seam.controllerCount).toBe(0);
    expect(seam.generateCalls).toBe(0);

    ack.resolve();
    await ackP;
    expect(seam.controllerCount).toBe(1);
    expect(seam.generateCalls).toBe(1);
  });

  it("a rejected ack write yields ZERO generate calls", async () => {
    const seam = makeSeam({
      acked: false,
      acknowledgeProvider: async () => {
        throw { code: "network" };
      },
    });
    await seam.lifecycle.begin();
    await seam.lifecycle.acknowledge();
    expect(seam.generateCalls).toBe(0);
    expect(seam.controllerCount).toBe(0);
    expect(seam.lifecycle.getState()).toEqual({
      status: "error",
      code: "network",
    });
  });
});

describe("M1 seam — stale-request guard after the ack await (C3-H4)", () => {
  it("drops the request when Cancel arrives during the pending ack", async () => {
    const ack = deferred<void>();
    const seam = makeSeam({
      acked: false,
      acknowledgeProvider: () => ack.promise,
    });
    await seam.lifecycle.begin();
    const ackP = seam.lifecycle.acknowledge();
    seam.lifecycle.cancel();
    ack.resolve();
    await ackP;
    expect(seam.controllerCount).toBe(0);
    expect(seam.generateCalls).toBe(0);
  });

  it("drops the request when unmount/navigation arrives during the pending ack", async () => {
    const ack = deferred<void>();
    const seam = makeSeam({
      acked: false,
      acknowledgeProvider: () => ack.promise,
    });
    await seam.lifecycle.begin();
    const ackP = seam.lifecycle.acknowledge();
    seam.lifecycle.dispose();
    ack.resolve();
    await ackP;
    expect(seam.generateCalls).toBe(0);
  });

  it("drops the request when provider/model/contact changes during the pending ack", async () => {
    const ack = deferred<void>();
    const seam = makeSeam({
      acked: false,
      acknowledgeProvider: () => ack.promise,
    });
    await seam.lifecycle.begin();
    const ackP = seam.lifecycle.acknowledge();
    seam.setConfig({ provider: "anthropic", model: "claude-x", contactId: 7 });
    ack.resolve();
    await ackP;
    expect(seam.generateCalls).toBe(0);
  });

  it("an UNCHANGED intent proceeds to a single generate after the ack resolves", async () => {
    const ack = deferred<void>();
    const seam = makeSeam({
      acked: false,
      acknowledgeProvider: () => ack.promise,
    });
    await seam.lifecycle.begin();
    const ackP = seam.lifecycle.acknowledge();
    ack.resolve();
    await ackP;
    expect(seam.controllerCount).toBe(1);
    expect(seam.generateCalls).toBe(1);
  });
});
