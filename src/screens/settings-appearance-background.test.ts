import { describe, expect, it } from "vitest";
import {
  BACKGROUND_ORDER,
  NONE_SLOT_ID,
  PACKAGE_DEFAULT_SLOT,
} from "@/theme/backgrounds";
import {
  backgroundChoicesForPackage,
  backgroundPatchForPackage,
  selectedBackgroundTile,
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

describe("selectedBackgroundTile — the highlighted tile is what actually renders (D-23 / Pitfall 7)", () => {
  it("NULL highlights the package default tile", () => {
    expect(selectedBackgroundTile("galaxy", null, "dark")).toBe(
      PACKAGE_DEFAULT_SLOT.galaxy,
    );
    expect(selectedBackgroundTile("standard", null, "light")).toBe(
      PACKAGE_DEFAULT_SLOT.standard,
    );
  });

  it("'none' highlights the None (Solid) tile", () => {
    expect(selectedBackgroundTile("standard", "none", "light")).toBe(
      NONE_SLOT_ID,
    );
    expect(selectedBackgroundTile("galaxy", "none", "dark")).toBe(NONE_SLOT_ID);
  });

  it("an unknown stored id highlights the default tile that is actually rendering (T-38.5-02-01)", () => {
    for (const mode of ["light", "dark"] as const) {
      expect(selectedBackgroundTile("galaxy", "made-up-id", mode)).toBe(
        PACKAGE_DEFAULT_SLOT.galaxy,
      );
      expect(selectedBackgroundTile("standard", "made-up-id", mode)).toBe(
        PACKAGE_DEFAULT_SLOT.standard,
      );
    }
  });

  it("a known stored id highlights its own tile in either mode", () => {
    expect(selectedBackgroundTile("galaxy", "galaxy-aurora", "light")).toBe(
      "galaxy-aurora",
    );
    expect(selectedBackgroundTile("galaxy", "galaxy-aurora", "dark")).toBe(
      "galaxy-aurora",
    );
  });

  it("the highlighted tile is always one the active package offers", () => {
    for (const pkg of ["galaxy", "standard"] as const) {
      for (const mode of ["light", "dark"] as const) {
        for (const stored of [
          null,
          "none",
          "made-up-id",
          ...BACKGROUND_ORDER[pkg],
        ]) {
          expect(backgroundChoicesForPackage(pkg)).toContain(
            selectedBackgroundTile(pkg, stored, mode),
          );
        }
      }
    }
  });
});
