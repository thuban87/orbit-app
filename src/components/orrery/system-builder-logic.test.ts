import { describe, expect, it } from "vitest";
import {
  draftToRules,
  emptyRuleDraft,
  isMeaningfulChange,
  summarizeFamily,
} from "./system-builder-logic";

describe("System builder draft logic", () => {
  it("summarizes selected values by their labels, not a bare count", () => {
    expect(
      summarizeFamily("category", ["friends", "community"], {
        friends: "Friends",
        community: "Community",
      }),
    ).toBe("Category · Friends, Community");
    expect(summarizeFamily("gravity", ["deep"], { deep: "Deep" })).toBe(
      "Gravity · Deep",
    );
  });

  it("emits only closed System-rule values and keeps manual-only Systems valid", () => {
    expect(draftToRules(emptyRuleDraft())).toEqual([]);
    expect(
      draftToRules({
        ...emptyRuleDraft(),
        category: ["friends"],
        favorite: true,
        "contact-frequency": ["monthly"],
      }),
    ).toEqual([
      { family: "category", value: "friends" },
      { family: "favorite", value: "on" },
      { family: "contact-frequency", value: "monthly" },
    ]);
  });

  it("flags meaningful name, rule, and override changes but not no-ops", () => {
    const before = {
      name: "Friends",
      rules: emptyRuleDraft(),
      overrideIntent: [],
    };
    expect(isMeaningfulChange(before, { ...before })).toBe(false);
    expect(
      isMeaningfulChange(before, { ...before, name: "Close friends" }),
    ).toBe(true);
    expect(
      isMeaningfulChange(before, {
        ...before,
        rules: { ...emptyRuleDraft(), gravity: ["deep"] },
      }),
    ).toBe(true);
    expect(
      isMeaningfulChange(before, {
        ...before,
        overrideIntent: [{ contactId: 8, mode: "include" }],
      }),
    ).toBe(true);
  });
});
