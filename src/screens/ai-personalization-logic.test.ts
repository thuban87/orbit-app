import { describe, expect, it, vi } from "vitest";

import type { PromptContextEstimate } from "@/ai/context-estimate";
import type {
  PersonalizationSection,
  WritingStyle,
} from "@/db/personalization-dao";
import {
  applyStyleLoad,
  applyStyleSave,
  createEstimateDebouncer,
  formatEstimateCaption,
  hasSectionDraftChanges,
  initialStyleSync,
  isWritingStyleDirty,
  moveSectionUid,
  orderSectionsByUid,
  PERSONALIZATION_ESTIMATE_DEBOUNCE_MS,
  personalizationEstimateSource,
  reorderSectionUids,
  type StyleSyncState,
  shouldReplaceStyleOnLoad,
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

describe("isWritingStyleDirty (D-34)", () => {
  it("compares all four fields", () => {
    expect(isWritingStyleDirty(STYLE, { ...STYLE })).toBe(false);
    expect(isWritingStyleDirty(STYLE, { ...STYLE, tone: "casual" })).toBe(true);
    expect(isWritingStyleDirty(STYLE, { ...STYLE, length: "concise" })).toBe(
      true,
    );
    expect(isWritingStyleDirty(STYLE, { ...STYLE, directness: "direct" })).toBe(
      true,
    );
    expect(isWritingStyleDirty(STYLE, { ...STYLE, freeform: "x" })).toBe(true);
  });

  it("compares freeform exactly, untrimmed", () => {
    expect(isWritingStyleDirty(STYLE, { ...STYLE, freeform: " " })).toBe(true);
  });
});

describe("Writing Style load / save baseline (D-13, D-34; reviews C4-M4, C5-L1, C6-L5)", () => {
  const STORED: WritingStyle = { ...STYLE, tone: "polished" };
  const A: WritingStyle = { ...STYLE, freeform: "A" };
  const B: WritingStyle = { ...STYLE, freeform: "B" };
  const C: WritingStyle = { ...STYLE, freeform: "C" };
  const dirty = (state: StyleSyncState) =>
    isWritingStyleDirty(state.saved, state.current);

  it("shouldReplaceStyleOnLoad: only a valid token and a clean style", () => {
    expect(
      shouldReplaceStyleOnLoad({
        saved: STYLE,
        current: STYLE,
        readToken: 2,
        invalidBefore: 1,
      }),
    ).toBe(true);
    expect(
      shouldReplaceStyleOnLoad({
        saved: STYLE,
        current: STYLE,
        readToken: 1,
        invalidBefore: 1,
      }),
    ).toBe(false);
    expect(
      shouldReplaceStyleOnLoad({
        saved: STYLE,
        current: A,
        readToken: 2,
        invalidBefore: 0,
      }),
    ).toBe(false);
  });

  it("first load with an untouched style replaces it and is clean", () => {
    const state = applyStyleLoad(initialStyleSync(STYLE), STORED, 1);
    expect(state.current).toEqual(STORED);
    expect(state.saved).toEqual(STORED);
    expect(dirty(state)).toBe(false);
  });

  it("an edit made before the first load resolves is kept and dirty against the stored style (C5-L1)", () => {
    const edited = { ...initialStyleSync(STYLE), current: A };
    const state = applyStyleLoad(edited, STORED, 1);
    expect(state.current).toEqual(A);
    expect(state.saved).toEqual(STORED);
    expect(dirty(state)).toBe(true);
  });

  it("after a failed first load, the next successful load still sets the baseline", () => {
    // The first load (token 1) failed: nothing applied. The user edits.
    const edited = { ...initialStyleSync(STYLE), current: A };
    const state = applyStyleLoad(edited, STORED, 2);
    expect(state.current).toEqual(A);
    expect(state.saved).toEqual(STORED);
    expect(state.loadedOnce).toBe(true);
  });

  it("a section action's refresh keeps an edited style dirty (C4-M4)", () => {
    let state = applyStyleLoad(initialStyleSync(STYLE), STORED, 1);
    state = { ...state, current: A };
    state = applyStyleLoad(state, STORED, 2);
    expect(state.current).toEqual(A);
    expect(state.saved).toEqual(STORED);
    expect(dirty(state)).toBe(true);
  });

  it("a clean refresh replaces the style and re-baselines to the loaded value", () => {
    let state = applyStyleLoad(initialStyleSync(STYLE), STORED, 1);
    state = applyStyleLoad(state, B, 2);
    expect(state.current).toEqual(B);
    expect(state.saved).toEqual(B);
    expect(dirty(state)).toBe(false);
  });

  it("save re-baselines to the submitted snapshot; an edit made while saving stays dirty", () => {
    let state = applyStyleLoad(initialStyleSync(STYLE), STORED, 1);
    state = { ...state, current: B };
    // Save of B submitted; the user types C before it completes.
    state = { ...state, current: C };
    state = applyStyleSave(state, B, 1);
    expect(state.saved).toEqual(B);
    expect(dirty(state)).toBe(true);
    const clean = applyStyleSave(
      { ...applyStyleLoad(initialStyleSync(STYLE), STORED, 1), current: B },
      B,
      1,
    );
    expect(dirty(clean)).toBe(false);
  });

  it("a stale refresh started before a Save never replaces the saved style (C6-L5)", () => {
    // Load token 2 starts (reads A), Save of B completes at seq 2, then the
    // load resolves.
    let state = applyStyleLoad(initialStyleSync(STYLE), STORED, 1);
    state = { ...state, current: B };
    state = applyStyleSave(state, B, 2);
    state = applyStyleLoad(state, A, 2);
    expect(state.current).toEqual(B);
    expect(state.saved).toEqual(B);
    expect(dirty(state)).toBe(false);
  });

  it("a stale refresh with an edit typed while the Save was pending keeps that edit dirty (C6-L5)", () => {
    let state = applyStyleLoad(initialStyleSync(STYLE), STORED, 1);
    state = { ...state, current: C };
    state = applyStyleSave(state, B, 2);
    state = applyStyleLoad(state, A, 2);
    expect(state.current).toEqual(C);
    expect(state.saved).toEqual(B);
    expect(dirty(state)).toBe(true);
  });

  it("a refresh started after the Save, with a clean style, still replaces and re-baselines", () => {
    let state = applyStyleLoad(initialStyleSync(STYLE), STORED, 1);
    state = { ...state, current: B };
    state = applyStyleSave(state, B, 1);
    state = applyStyleLoad(state, A, 2);
    expect(state.current).toEqual(A);
    expect(state.saved).toEqual(A);
    expect(dirty(state)).toBe(false);
  });

  it("an invalidated first load does not set the baseline", () => {
    let state = { ...initialStyleSync(STYLE), current: B };
    state = applyStyleSave(state, B, 1);
    state = applyStyleLoad(state, A, 1);
    expect(state.loadedOnce).toBe(false);
    expect(state.saved).toEqual(B);
    expect(state.current).toEqual(B);
  });
});

describe("hasSectionDraftChanges (D-13; review C5-L7)", () => {
  const none = {
    adding: false,
    draftTitle: "",
    draftBody: "",
    editingOpen: false,
    editDirty: false,
  };

  it("is false with no draft open, even with stale text left after Cancel", () => {
    expect(hasSectionDraftChanges(none)).toBe(false);
    expect(
      hasSectionDraftChanges({ ...none, draftTitle: "old", draftBody: "x" }),
    ).toBe(false);
  });

  it("is true while adding with a non-blank title or body", () => {
    expect(hasSectionDraftChanges({ ...none, adding: true })).toBe(false);
    expect(
      hasSectionDraftChanges({ ...none, adding: true, draftTitle: "T" }),
    ).toBe(true);
    expect(
      hasSectionDraftChanges({ ...none, adding: true, draftBody: "B" }),
    ).toBe(true);
    expect(
      hasSectionDraftChanges({ ...none, adding: true, draftTitle: "   " }),
    ).toBe(false);
  });

  it("is true when an inline edit is open and differs from its section", () => {
    expect(hasSectionDraftChanges({ ...none, editingOpen: true })).toBe(false);
    expect(
      hasSectionDraftChanges({ ...none, editingOpen: true, editDirty: true }),
    ).toBe(true);
  });
});

describe("section reorder helpers (38.12 D-120)", () => {
  it("a drag moves one row and keeps the others in order", () => {
    expect(reorderSectionUids(["a", "b", "c", "d"], 3, 1)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
    expect(reorderSectionUids(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("a drop in place or out of range leaves the order alone", () => {
    expect(reorderSectionUids(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(reorderSectionUids(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(reorderSectionUids(["a", "b"], 0, 2)).toEqual(["a", "b"]);
  });

  it("orders loaded sections by uid, skipping unknown uids and keeping unlisted rows last", () => {
    const rows = [section("a", 0), section("b", 1), section("c", 2)];
    expect(
      orderSectionsByUid(rows, ["c", "x", "a"]).map((row) => row.uid),
    ).toEqual(["c", "a", "b"]);
  });
});
