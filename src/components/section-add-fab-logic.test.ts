import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAB_EDGE_GAP, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import {
  clamp01,
  FAB_HIDE_HYSTERESIS,
  fabA11yProps,
  fabSuppressed,
  fabTargetAfterScroll,
  lerp,
  MORPH_DURATION_MS,
  type MorphRect,
  morphFrame,
  sectionFabBottomOffset,
  sectionFabClearance,
  sectionFabIcon,
  snapOnPause,
} from "./section-add-fab-logic";

describe("section Add FAB tunables (D-131)", () => {
  it("morphs over the slow motion token", () => {
    expect(MORPH_DURATION_MS).toBe(320);
  });
});

describe("lerp / clamp01", () => {
  it("interpolates and clamps", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });
});

describe("fabTargetAfterScroll (D-131)", () => {
  const barBottom = 120;

  it("stays 0 while the Add's bottom is below the viewport top", () => {
    expect(fabTargetAfterScroll(0, 0, barBottom, false)).toBe(0);
    expect(fabTargetAfterScroll(0, barBottom - 1, barBottom, false)).toBe(0);
  });

  it("goes to 1 once the Add has scrolled off", () => {
    expect(fabTargetAfterScroll(0, barBottom, barBottom, false)).toBe(1);
    expect(fabTargetAfterScroll(0, barBottom + 300, barBottom, false)).toBe(1);
  });

  it("from 1 returns to 0 only past the hysteresis", () => {
    expect(fabTargetAfterScroll(1, barBottom - 1, barBottom, false)).toBe(1);
    expect(
      fabTargetAfterScroll(
        1,
        barBottom - FAB_HIDE_HYSTERESIS,
        barBottom,
        false,
      ),
    ).toBe(1);
    expect(
      fabTargetAfterScroll(
        1,
        barBottom - FAB_HIDE_HYSTERESIS - 1,
        barBottom,
        false,
      ),
    ).toBe(0);
  });

  it("suppressed always gives 0", () => {
    expect(fabTargetAfterScroll(0, 900, barBottom, true)).toBe(0);
    expect(fabTargetAfterScroll(1, 900, barBottom, true)).toBe(0);
  });

  it("an unmeasured Add (bottom 0) never shows the FAB", () => {
    expect(fabTargetAfterScroll(0, 0, 0, false)).toBe(0);
    expect(fabTargetAfterScroll(1, 50, 0, false)).toBe(0);
  });
});

describe("morphFrame (D-131)", () => {
  const bar: MorphRect = { x: 16, y: 100, width: 380, height: 48, radius: 12 };
  const fab: MorphRect = { x: 20, y: 700, width: 56, height: 56, radius: 28 };

  it("equals the bar at 0 and the FAB at 1", () => {
    const start = morphFrame(0, bar, fab);
    expect({
      x: start.x,
      y: start.y,
      width: start.width,
      height: start.height,
      radius: start.radius,
    }).toEqual(bar);
    const end = morphFrame(1, bar, fab);
    expect({
      x: end.x,
      y: end.y,
      width: end.width,
      height: end.height,
      radius: end.radius,
    }).toEqual(fab);
  });

  it("fades the label out over the first half", () => {
    expect(morphFrame(0, bar, fab).labelOpacity).toBe(1);
    expect(morphFrame(0.25, bar, fab).labelOpacity).toBeCloseTo(0.5);
    expect(morphFrame(0.5, bar, fab).labelOpacity).toBe(0);
    expect(morphFrame(1, bar, fab).labelOpacity).toBe(0);
  });

  it("fades the icon in over the second half", () => {
    expect(morphFrame(0, bar, fab).iconOpacity).toBe(0);
    expect(morphFrame(0.5, bar, fab).iconOpacity).toBe(0);
    expect(morphFrame(0.75, bar, fab).iconOpacity).toBeCloseTo(0.5);
    expect(morphFrame(1, bar, fab).iconOpacity).toBe(1);
  });

  it("hides the overlay at rest so the real bar shows", () => {
    expect(morphFrame(0, bar, fab).overlayOpacity).toBe(0);
    expect(morphFrame(0.5, bar, fab).overlayOpacity).toBe(1);
    expect(morphFrame(1, bar, fab).overlayOpacity).toBe(1);
  });

  it("clamps progress outside 0..1", () => {
    expect(morphFrame(-1, bar, fab).x).toBe(bar.x);
    expect(morphFrame(2, bar, fab).y).toBe(fab.y);
  });
});

describe("sectionFabBottomOffset / sectionFabClearance", () => {
  it("clears the system inset on a focused route", () => {
    expect(sectionFabBottomOffset({ focused: true, insetBottom: 24 })).toBe(
      24 + FAB_EDGE_GAP,
    );
  });

  it("sits FAB_EDGE_GAP above the in-flow tab bar on a tab page", () => {
    expect(sectionFabBottomOffset({ focused: false, insetBottom: 24 })).toBe(
      FAB_EDGE_GAP,
    );
  });

  it("lets the last entry scroll fully above the FAB", () => {
    expect(sectionFabClearance({ focused: true, insetBottom: 24 })).toBe(
      24 + FAB_EDGE_GAP + FAB_SIZE + FAB_EDGE_GAP,
    );
  });
});

describe("sectionFabIcon (D-131)", () => {
  it("maps each page to its registry icon", () => {
    expect(sectionFabIcon("general")).toBe("section-memories");
    expect(sectionFabIcon("thought_of_them")).toBe("section-thought-of-them");
    expect(sectionFabIcon("gift_idea")).toBe("section-gift-ideas");
    expect(sectionFabIcon("key_people")).toBe("section-key-people");
    expect(sectionFabIcon("off_limits")).toBe("section-off-limits");
    expect(sectionFabIcon("last_talked_about")).toBe(
      "section-last-talked-about",
    );
    expect(sectionFabIcon("current_location")).toBe("section-current-location");
  });

  it("Imported has no Add, so no FAB (D-35)", () => {
    expect(sectionFabIcon("imported")).toBeNull();
  });
});

describe("fabSuppressed (D-131)", () => {
  it("shows only when loaded with no form open and the keyboard down", () => {
    expect(
      fabSuppressed({ loaded: true, formOpen: false, keyboardUp: false }),
    ).toBe(false);
  });

  it("is suppressed before the read loads, with a form open or the keyboard up", () => {
    expect(
      fabSuppressed({ loaded: false, formOpen: false, keyboardUp: false }),
    ).toBe(true);
    expect(
      fabSuppressed({ loaded: true, formOpen: true, keyboardUp: false }),
    ).toBe(true);
    expect(
      fabSuppressed({ loaded: true, formOpen: false, keyboardUp: true }),
    ).toBe(true);
  });
});

describe("fabA11yProps", () => {
  it("a shown FAB is reachable and tappable", () => {
    expect(fabA11yProps(true)).toEqual({
      accessible: true,
      importantForAccessibility: "auto",
      accessibilityElementsHidden: false,
      pointerEvents: "auto",
    });
  });

  it("a hidden FAB is out of the accessibility tree and takes no touches", () => {
    expect(fabA11yProps(false)).toEqual({
      accessible: false,
      importantForAccessibility: "no-hide-descendants",
      accessibilityElementsHidden: true,
      pointerEvents: "none",
    });
  });
});

describe("snapOnPause", () => {
  it("snaps to the current target, never an in-between value", () => {
    expect(snapOnPause(0)).toBe(0);
    expect(snapOnPause(1)).toBe(1);
  });
});

describe("worklet order (memory worklet-forward-ref-hazard)", () => {
  it("declares every worklet above the worklets that call it", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/section-add-fab-logic.ts"),
      "utf8",
    );
    const at = (name: string) => {
      const index = source.indexOf(`export function ${name}(`);
      expect(index, name).toBeGreaterThanOrEqual(0);
      return index;
    };
    expect(at("lerp")).toBeLessThan(at("morphFrame"));
    expect(at("clamp01")).toBeLessThan(at("morphFrame"));
    expect(at("morphFrame")).toBeLessThan(at("fabTargetAfterScroll"));
  });
});
