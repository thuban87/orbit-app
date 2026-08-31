import { describe, expect, it } from "vitest";
import { hasResolvedMergeConflicts } from "@/screens/merge-conflict-logic";

describe("hasResolvedMergeConflicts", () => {
  it("requires a choice for every contended method type, including phone and email together", () => {
    const base = {
      scalarKeys: ["name"],
      customFieldIds: [7],
      primaryTypes: ["phone", "email"] as const,
      hasPhotoConflict: true,
      scalarChoices: { name: "survivor" as const },
      customFieldChoices: { 7: "absorbed" as const },
      photoChoice: "survivor",
    };

    expect(hasResolvedMergeConflicts({ ...base, primaryChoices: { phone: "survivor" } })).toBe(false);
    expect(hasResolvedMergeConflicts({ ...base, primaryChoices: { phone: "survivor", email: "absorbed" } })).toBe(true);
  });
});
