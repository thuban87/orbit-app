import { describe, expect, it } from "vitest";
import { aiLockReason, memoryAiLock } from "@/logic/ai-lock";

describe("memoryAiLock (D-98, D-102, D-103)", () => {
  it("locks a Group Note copy, linked or not", () => {
    expect(memoryAiLock({ group_note_copy: 1, linked_note_ai_locked: 0 })).toBe(
      "group_note",
    );
  });

  it("the Group Note marker wins over an Off Limits lock", () => {
    expect(memoryAiLock({ group_note_copy: 1, linked_note_ai_locked: 1 })).toBe(
      "group_note",
    );
  });

  it("locks a memory whose linked note was moved into Off Limits", () => {
    expect(memoryAiLock({ group_note_copy: 0, linked_note_ai_locked: 1 })).toBe(
      "off_limits",
    );
  });

  it("leaves an ordinary memory unlocked", () => {
    expect(
      memoryAiLock({ group_note_copy: 0, linked_note_ai_locked: 0 }),
    ).toBeNull();
  });
});

describe("aiLockReason", () => {
  it("gives a short reason per lock", () => {
    expect(aiLockReason("group_note")).toBe(
      "Group Notes are never shared with AI.",
    );
    expect(aiLockReason("off_limits")).toBe(
      "Moved to Off Limits, so AI stays off.",
    );
  });
});
