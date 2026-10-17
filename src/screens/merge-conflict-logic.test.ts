import { describe, expect, it } from "vitest";
import {
  customConflictDisplayValues,
  customPhotoConflictChoice,
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

describe("photo fields in merge conflicts (38.12 D-129)", () => {
  it("shows text left in a photo field as text and a stored photo as Photo, never its path", () => {
    expect(
      customConflictDisplayValues(
        "photo",
        "avatars/cv-1-portrait.jpg",
        "hello",
      ),
    ).toEqual(["Photo", "hello"]);
    expect(customConflictDisplayValues("photo", "Rex", "hello")).toEqual([
      "Rex",
      "hello",
    ]);
  });

  it("a photo choice's keep row keeps the survivor's photo", () => {
    expect(customPhotoConflictChoice("absorbed")).toBe("absorbed");
    expect(customPhotoConflictChoice("survivor")).toBe("survivor");
    expect(customPhotoConflictChoice("keep-orbit")).toBe("survivor");
  });
});
