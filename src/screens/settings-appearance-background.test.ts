import { describe, expect, it } from "vitest";
import { BACKGROUND_ORDER, NONE_SLOT_ID } from "@/theme/backgrounds";
import {
  backgroundChoicesForPackage,
  backgroundPatchForPackage,
} from "./settings-appearance-background";

describe("backgroundChoicesForPackage — active-package guard (D-07)", () => {
  it("offers the Galaxy slots + None for galaxy", () => {
    expect(backgroundChoicesForPackage("galaxy")).toEqual([
      "galaxy-deep-space",
      "galaxy-starfield",
      "galaxy-nebula",
      "galaxy-aurora",
      NONE_SLOT_ID,
    ]);
    // Contract-anchored: it is exactly the package's ordered list.
    expect(backgroundChoicesForPackage("galaxy")).toEqual(
      BACKGROUND_ORDER.galaxy,
    );
  });

  it("offers the Standard slots + None for standard", () => {
    expect(backgroundChoicesForPackage("standard")).toEqual([
      "standard-dawn",
      "standard-paper",
      "standard-dusk",
      "standard-mesh",
      NONE_SLOT_ID,
    ]);
    expect(backgroundChoicesForPackage("standard")).toEqual(
      BACKGROUND_ORDER.standard,
    );
  });

  it("does NOT offer the Galaxy-only choices while Standard is active", () => {
    const standardChoices = backgroundChoicesForPackage("standard");
    for (const galaxySlot of [
      "galaxy-deep-space",
      "galaxy-starfield",
      "galaxy-nebula",
      "galaxy-aurora",
    ] as const) {
      expect(standardChoices).not.toContain(galaxySlot);
    }
  });
});

describe("backgroundPatchForPackage — per-package durable key (review cycle-2 #5)", () => {
  it("writes galaxyBackground for a galaxy selection", () => {
    expect(backgroundPatchForPackage("galaxy", "galaxy-nebula")).toEqual({
      galaxyBackground: "galaxy-nebula",
    });
    // None under Galaxy still targets the galaxy column.
    expect(backgroundPatchForPackage("galaxy", NONE_SLOT_ID)).toEqual({
      galaxyBackground: NONE_SLOT_ID,
    });
  });

  it("writes standardBackground for a standard selection", () => {
    expect(backgroundPatchForPackage("standard", "standard-dawn")).toEqual({
      standardBackground: "standard-dawn",
    });
    expect(backgroundPatchForPackage("standard", NONE_SLOT_ID)).toEqual({
      standardBackground: NONE_SLOT_ID,
    });
  });
});
