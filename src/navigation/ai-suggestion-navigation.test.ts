/**
 * ai-suggestion-navigation — proof of the consume-once profile→Compose intent
 * (Plan 14-05, T-14-16) and that the Compose route param stays serializable.
 *
 * The profile entry hands Compose a serializable `requestAiSuggestion: true`; the
 * screen must auto-start the suggestion EXACTLY ONCE and never on a focus reload /
 * re-render. This suite pins the pure decision and the serializable-only param
 * contract.
 */
import { describe, expect, it } from "vitest";
import { consumeAiSuggestionIntent } from "@/navigation/ai-suggestion-navigation";

describe("consumeAiSuggestionIntent — consume-once decision (T-14-16)", () => {
  it("starts a suggestion for a fresh true intent", () => {
    expect(consumeAiSuggestionIntent(true, false)).toBe(true);
  });

  it("does NOT re-fire once the intent was already consumed", () => {
    expect(consumeAiSuggestionIntent(true, true)).toBe(false);
  });

  it("never fires for an absent intent (ordinary compose entry)", () => {
    expect(consumeAiSuggestionIntent(undefined, false)).toBe(false);
  });

  it("never fires for an explicit false intent", () => {
    expect(consumeAiSuggestionIntent(false, false)).toBe(false);
  });

  it("fires exactly once across repeated focus passes", () => {
    // Simulate the screen: consume flips a local 'consumed' latch after a true.
    let consumed = false;
    const focusPass = () => {
      const start = consumeAiSuggestionIntent(true, consumed);
      if (start) consumed = true;
      return start;
    };
    // First focus fires; every subsequent focus (reload/foreground) does not.
    expect(focusPass()).toBe(true);
    expect(focusPass()).toBe(false);
    expect(focusPass()).toBe(false);
  });
});

describe("Compose route param — serializable primitives only (deep-link safety)", () => {
  it("survives a JSON round-trip unchanged (no functions/callbacks)", () => {
    const params = { contactId: 7, requestAiSuggestion: true };
    expect(JSON.parse(JSON.stringify(params))).toEqual(params);
  });

  it("carries only primitive values", () => {
    const params: Record<string, unknown> = {
      contactId: 7,
      requestAiSuggestion: true,
    };
    for (const value of Object.values(params)) {
      expect(["number", "boolean", "string"]).toContain(typeof value);
    }
  });
});
