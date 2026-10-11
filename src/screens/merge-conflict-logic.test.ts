import { describe, expect, it } from "vitest";
import {
  customConflictDisplayValues,
  hasResolvedMergeConflicts,
} from "@/screens/merge-conflict-logic";

const THIS_YEAR = new Date().getFullYear();

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

    expect(
      hasResolvedMergeConflicts({
        ...base,
        primaryChoices: { phone: "survivor" },
      }),
    ).toBe(false);
    expect(
      hasResolvedMergeConflicts({
        ...base,
        primaryChoices: { phone: "survivor", email: "absorbed" },
      }),
    ).toBe(true);
  });
});

describe("customConflictDisplayValues (38.9 D-66; render only)", () => {
  it("shows a Date field's two values in the date-only display form", () => {
    expect(
      customConflictDisplayValues(
        "date",
        `${THIS_YEAR}-10-20`,
        `${THIS_YEAR - 1}-06-02`,
      ),
    ).toEqual(["Oct 20", `Jun 2, ${THIS_YEAR - 1}`]);
  });

  it("keeps a value the date parser rejects raw", () => {
    expect(
      customConflictDisplayValues("date", "next spring", `${THIS_YEAR}-10-20`),
    ).toEqual(["next spring", "Oct 20"]);
  });

  it("shows both raw values when two different values would read the same", () => {
    expect(
      customConflictDisplayValues(
        "date",
        `${THIS_YEAR}-10-20`,
        `${THIS_YEAR}-10-20 trip`,
      ),
    ).toEqual([`${THIS_YEAR}-10-20`, `${THIS_YEAR}-10-20 trip`]);
  });

  it("leaves every other field type unchanged", () => {
    expect(
      customConflictDisplayValues(
        "text",
        `${THIS_YEAR}-10-20`,
        `${THIS_YEAR}-10-21`,
      ),
    ).toEqual([`${THIS_YEAR}-10-20`, `${THIS_YEAR}-10-21`]);
    expect(customConflictDisplayValues("number", "1", "2")).toEqual(["1", "2"]);
  });
});
