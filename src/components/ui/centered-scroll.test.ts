import { describe, expect, it } from "vitest";
import {
  CENTERING_MARGIN,
  centeredScrollY,
  keyboardSpacer,
} from "./centered-scroll";

/** A tall content (1200) in an 800-high viewport at the top of the window. */
const BASE = {
  viewportTop: 0,
  viewportBottom: 800,
  keyboardTop: 500,
  contentH: 1200,
  scrollY: 0,
  margin: CENTERING_MARGIN,
};

function centreInWindow(
  fieldY: number,
  fieldH: number,
  scrollY: number,
  viewportTop: number,
): number {
  return viewportTop + fieldY - scrollY + fieldH / 2;
}

describe("keyboardSpacer (D-66; convergence c6, Codex C-01)", () => {
  it("is the keyboard overlap alone when no entry field is active", () => {
    expect(
      keyboardSpacer({
        viewportTop: 0,
        viewportBottom: 800,
        keyboardTop: 500,
        fieldH: 60,
        active: false,
      }),
    ).toBe(300);
  });

  it("is 0 on a resized screen with no active entry field", () => {
    expect(
      keyboardSpacer({
        viewportTop: 0,
        viewportBottom: 500,
        keyboardTop: 500,
        fieldH: 60,
        active: false,
      }),
    ).toBe(0);
  });

  it("adds the centring slack on top of the overlap while a field is active", () => {
    // overlap 300; room 500; slack (500 - 60) / 2 = 220.
    expect(
      keyboardSpacer({
        viewportTop: 0,
        viewportBottom: 800,
        keyboardTop: 500,
        fieldH: 60,
        active: true,
      }),
    ).toBe(520);
  });

  it("never goes negative for a field taller than the room", () => {
    expect(
      keyboardSpacer({
        viewportTop: 0,
        viewportBottom: 500,
        keyboardTop: 600,
        fieldH: 900,
        active: true,
      }),
    ).toBe(0);
  });
});

describe("centeredScrollY (D-66)", () => {
  it("centres a mid-content field in the room above an overlapping keyboard", () => {
    const fieldY = 600;
    const fieldH = 60;
    const y = centeredScrollY({ ...BASE, fieldY, fieldH });
    // Room is [0, 500]; its centre is 250.
    expect(centreInWindow(fieldY, fieldH, y, BASE.viewportTop)).toBe(250);
  });

  it("clamps a top field to 0", () => {
    expect(centeredScrollY({ ...BASE, fieldY: 20, fieldH: 60 })).toBe(0);
  });

  it("a bottom field needs the spacer: without slack the clamp stops short", () => {
    const fieldY = 1140;
    const fieldH = 60;
    const withSlack = centeredScrollY({ ...BASE, fieldY, fieldH });
    // Overlap alone (300) would cap the scroll at 1200 + 300 - 800 = 700,
    // well short of the 920 the centre needs.
    const overlapOnlyMax =
      BASE.contentH +
      keyboardSpacer({ ...BASE, fieldH, active: false }) -
      (BASE.viewportBottom - BASE.viewportTop);
    expect(overlapOnlyMax).toBe(700);
    expect(withSlack).toBeGreaterThan(overlapOnlyMax);
  });

  it("centres the content's last field above an overlapping keyboard (c6)", () => {
    const fieldY = 1140;
    const fieldH = 60;
    const y = centeredScrollY({ ...BASE, fieldY, fieldH });
    expect(y).toBe(920);
    expect(centreInWindow(fieldY, fieldH, y, BASE.viewportTop)).toBe(250);
  });

  it("centres the content's last field on a resized screen (c6)", () => {
    const fieldY = 1140;
    const fieldH = 60;
    const input = {
      ...BASE,
      viewportBottom: 500,
      keyboardTop: 520,
      fieldY,
      fieldH,
    };
    // Overlap is 0, so the spacer is the slack alone.
    expect(keyboardSpacer({ ...input, active: true })).toBe(220);
    const y = centeredScrollY(input);
    expect(centreInWindow(fieldY, fieldH, y, input.viewportTop)).toBe(250);
  });

  it("aligns a field taller than the room to the viewport top plus margin", () => {
    const y = centeredScrollY({ ...BASE, fieldY: 400, fieldH: 700 });
    expect(y).toBe(400 - CENTERING_MARGIN);
  });

  it("respects a viewport that does not start at the window top", () => {
    const input = {
      ...BASE,
      viewportTop: 100,
      viewportBottom: 900,
      keyboardTop: 600,
      fieldY: 700,
      fieldH: 40,
    };
    const y = centeredScrollY(input);
    // Room is [100, 600]; its centre is 350.
    expect(centreInWindow(700, 40, y, 100)).toBe(350);
  });

  it("an already-centred field produces no scroll change", () => {
    const first = centeredScrollY({ ...BASE, fieldY: 600, fieldH: 60 });
    expect(
      centeredScrollY({ ...BASE, fieldY: 600, fieldH: 60, scrollY: first }),
    ).toBe(first);
  });
});
