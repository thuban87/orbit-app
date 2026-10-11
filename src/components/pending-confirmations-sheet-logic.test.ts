import { describe, expect, it } from "vitest";
import {
  markNoteDirty,
  pruneDirtyNotes,
  shouldPromptOnSheetClose,
} from "./pending-confirmations-sheet-logic";

/**
 * The overlay variant of the unsaved-work guard (38.9 D-13, D-14; J-07): the
 * pending-confirmations sheet prompts on close only while a confirmation note
 * it still shows holds typed text. Dirty membership follows the real queue
 * (review M6), never the return of a confirm/dismiss handler.
 */

const EMPTY: ReadonlySet<string> = new Set();

describe("shouldPromptOnSheetClose (D-13, D-14)", () => {
  it("closes at once with no typed note", () => {
    expect(shouldPromptOnSheetClose(EMPTY)).toBe(false);
  });

  it("prompts with one typed note", () => {
    expect(shouldPromptOnSheetClose(new Set(["assist-1"]))).toBe(true);
  });
});

describe("markNoteDirty", () => {
  it("adds a uid when its note becomes typed, returning a new set", () => {
    const next = markNoteDirty(EMPTY, "assist-1", true);
    expect([...next]).toEqual(["assist-1"]);
    expect(next).not.toBe(EMPTY);
    expect(EMPTY.size).toBe(0);
  });

  it("removes a uid when its note is cleared, returning a new set", () => {
    const start: ReadonlySet<string> = new Set(["assist-1", "assist-2"]);
    const next = markNoteDirty(start, "assist-1", false);
    expect([...next]).toEqual(["assist-2"]);
    expect([...start]).toEqual(["assist-1", "assist-2"]);
  });

  it("returns the same set when nothing changes", () => {
    const start: ReadonlySet<string> = new Set(["assist-1"]);
    expect(markNoteDirty(start, "assist-1", true)).toBe(start);
    expect(markNoteDirty(start, "assist-2", false)).toBe(start);
  });
});

describe("pruneDirtyNotes follows the queue (review M6)", () => {
  it("keeps only uids still in the queue", () => {
    const dirty: ReadonlySet<string> = new Set(["assist-1", "assist-2"]);
    expect([...pruneDirtyNotes(dirty, ["assist-2", "assist-3"])]).toEqual([
      "assist-2",
    ]);
  });

  it("returns the same set when every uid is still queued", () => {
    const dirty: ReadonlySet<string> = new Set(["assist-1"]);
    expect(pruneDirtyNotes(dirty, ["assist-1", "assist-2"])).toBe(dirty);
  });

  it("a successful confirm removes the item from the queue, so its note stops counting", () => {
    let dirty = markNoteDirty(EMPTY, "assist-1", true);
    // The write succeeded and the queue refresh dropped assist-1.
    dirty = pruneDirtyNotes(dirty, ["assist-2"]);
    expect(shouldPromptOnSheetClose(dirty)).toBe(false);
  });

  it("a failed confirm leaves the item queued, so its note stays dirty and closing still prompts", () => {
    const dirty = markNoteDirty(EMPTY, "assist-1", true);
    // The handler resolved (it always does) but the write failed: the queue
    // still holds assist-1 with its typed note.
    const live = pruneDirtyNotes(dirty, ["assist-1", "assist-2"]);
    expect(shouldPromptOnSheetClose(live)).toBe(true);
  });

  it("an item removed elsewhere (dismissed in the banner, expired) stops counting", () => {
    const dirty = markNoteDirty(
      markNoteDirty(EMPTY, "assist-1", true),
      "assist-2",
      true,
    );
    expect(shouldPromptOnSheetClose(pruneDirtyNotes(dirty, []))).toBe(false);
    expect([...pruneDirtyNotes(dirty, ["assist-2"])]).toEqual(["assist-2"]);
  });
});
