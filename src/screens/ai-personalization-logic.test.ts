import { describe, expect, it, vi } from "vitest";

import type { PromptContextEstimate } from "@/ai/context-estimate";
import type {
  PersonalizationSection,
  WritingStyle,
} from "@/db/personalization-dao";
import {
  createEstimateDebouncer,
  formatEstimateCaption,
  moveSectionUid,
  PERSONALIZATION_ESTIMATE_DEBOUNCE_MS,
  personalizationEstimateSource,
} from "@/screens/ai-personalization-logic";

const STYLE: WritingStyle = {
  tone: "balanced",
  length: "normal",
  directness: "balanced",
  freeform: "",
};

function section(
  uid: string,
  displayOrder: number,
  enabled = true,
): PersonalizationSection {
  return {
    id: displayOrder + 1,
    uid,
    title: `Title ${uid}`,
    body: `Body ${uid}`,
    enabled,
    displayOrder,
    createdAt: "now",
    modifiedAt: "now",
  };
}

describe("ai-personalization-logic", () => {
  it("coalesces rapid edits into one delayed recompute", () => {
    vi.useFakeTimers();
    const recompute = vi.fn();
    const debouncer = createEstimateDebouncer(recompute);
    debouncer.schedule();
    debouncer.schedule();
    debouncer.schedule();
    vi.advanceTimersByTime(PERSONALIZATION_ESTIMATE_DEBOUNCE_MS - 1);
    expect(recompute).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(recompute).toHaveBeenCalledTimes(1);
    debouncer.cancel();
    vi.useRealTimers();
  });

  it("moves sections deterministically in both directions and clamps edges", () => {
    expect(moveSectionUid(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveSectionUid(["a", "b", "c"], "b", "down")).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(moveSectionUid(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
  });

  it("estimates only custom guidance and enabled sections in stable order", () => {
    expect(personalizationEstimateSource(STYLE, [])).toBe("");
    expect(
      personalizationEstimateSource({ ...STYLE, freeform: "My guidance" }, [
        section("later", 2),
        section("private", 0, false),
        section("first", 1),
      ]),
    ).toBe("My guidance\nTitle first\nBody first\nTitle later\nBody later");
  });

  it("formats cost and flips overflow copy at the estimator boundary", () => {
    const base: PromptContextEstimate = {
      prompt: "x",
      estimatedInputTokens: 10,
      contextWindowTokens: 10,
      remainingTokens: 0,
      overflow: false,
      overflowNotice: null,
      estimatedInputCostUsd: 0.0002,
      costMessage: null,
    };
    expect(formatEstimateCaption(base, "model")).toEqual({
      context: "Estimated context · ~10 tokens",
      cost: "~$0.0002 input cost with model",
      overflow: null,
    });
    expect(
      formatEstimateCaption(
        {
          ...base,
          estimatedInputTokens: 11,
          remainingTokens: -1,
          overflow: true,
          overflowNotice: { category: "context", detail: "Context overflow" },
        },
        "model",
      ).overflow,
    ).toBe("Context overflow");
  });
});
