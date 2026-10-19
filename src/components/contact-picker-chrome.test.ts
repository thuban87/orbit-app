import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sheetKeyboardLayout } from "@/components/ui/sheet-contract";
import {
  CONTACT_PICKER_MIN_HEIGHT,
  CONTACT_PICKER_RESTING_MAX_HEIGHT,
  contactPickerKeyboardFrame,
  contactPickerTitle,
  growRestingFrame,
  rebaseRestingFrame,
} from "./contact-picker-chrome";

describe("contactPickerTitle (38.13 D-70)", () => {
  it("keeps today's title when the caller passes none", () => {
    expect(contactPickerTitle(undefined, false)).toBe("Choose contact");
    expect(contactPickerTitle(undefined, true)).toBe("Choose contacts");
  });

  it("names the action that opened the picker", () => {
    expect(contactPickerTitle("Quick Log: choose contact", false)).toBe(
      "Quick Log: choose contact",
    );
    expect(contactPickerTitle("Group Log: choose contacts", true)).toBe(
      "Group Log: choose contacts",
    );
  });

  it("falls back to today's title for a blank title", () => {
    expect(contactPickerTitle("  ", false)).toBe("Choose contact");
  });
});

describe("contactPickerKeyboardFrame (38.13 D-43, the 38.9 sheet keyboard layout)", () => {
  const resting = {
    frameHeight: 900,
    restingFrameHeight: 900,
    topClearance: 40,
  };

  it("keyboard down: no lift and the resting 82% cap", () => {
    expect(
      contactPickerKeyboardFrame({ ...resting, keyboardHeight: 0 }),
    ).toEqual({
      lift: 0,
      maxHeight: CONTACT_PICKER_RESTING_MAX_HEIGHT,
      minHeight: CONTACT_PICKER_MIN_HEIGHT,
    });
    expect(CONTACT_PICKER_RESTING_MAX_HEIGHT).toBe("82%");
  });

  it("keyboard up: the expanded sheet's lift, capped to the room above the keyboard", () => {
    const input = { ...resting, keyboardHeight: 320 };
    const layout = sheetKeyboardLayout({ variant: "expanded", ...input });
    const frame = contactPickerKeyboardFrame(input);
    expect(frame.lift).toBe(layout.lift);
    expect(frame.lift).toBe(320);
    const room = input.frameHeight - frame.lift - input.topClearance;
    expect(typeof frame.maxHeight).toBe("number");
    expect(frame.maxHeight as number).toBeLessThanOrEqual(room);
    expect(frame.maxHeight).toBe(540);
    expect(frame.minHeight).toBe(CONTACT_PICKER_MIN_HEIGHT);
  });

  it("keyboard up: never taller than the resting cap", () => {
    // A short keyboard leaves more room than the picker has at rest.
    const frame = contactPickerKeyboardFrame({
      ...resting,
      keyboardHeight: 40,
    });
    expect(frame.maxHeight).toBe(Math.round(0.82 * 900));
  });

  it("keyboard up on a window the system already resized: lifts only the rest", () => {
    const frame = contactPickerKeyboardFrame({
      frameHeight: 600,
      restingFrameHeight: 900,
      keyboardHeight: 320,
      topClearance: 40,
    });
    expect(frame.lift).toBe(20);
    expect(frame.maxHeight).toBe(540);
  });

  it("keyboard up with little room: the floor shrinks to the cap so the search stays on screen", () => {
    const frame = contactPickerKeyboardFrame({
      frameHeight: 560,
      restingFrameHeight: 560,
      keyboardHeight: 320,
      topClearance: 40,
    });
    expect(frame.maxHeight).toBe(200);
    expect(frame.minHeight).toBe(200);
  });
});

describe("the picker's resting frame height (38.13 review B-IN-05)", () => {
  it("grows with each layout while the window keeps its size (a keyboard resize only shrinks the frame)", () => {
    let resting = rebaseRestingFrame({ height: 0, windowHeight: 0 }, 891);
    resting = growRestingFrame(resting, 891);
    resting = growRestingFrame(resting, 560);
    expect(resting).toEqual({ height: 891, windowHeight: 891 });
  });

  it("starts again when the window shrinks (cover display, split screen), so it never stays at the old maximum", () => {
    let resting = growRestingFrame({ height: 0, windowHeight: 891 }, 891);
    resting = rebaseRestingFrame(resting, 420);
    expect(resting).toEqual({ height: 0, windowHeight: 420 });
    resting = growRestingFrame(resting, 420);
    expect(resting.height).toBe(420);
    // With the keyboard up on the small window, the lift is the keyboard
    // height again rather than the old 891 - 420 "resize" (which was 0).
    expect(
      contactPickerKeyboardFrame({
        frameHeight: 420,
        restingFrameHeight: resting.height,
        keyboardHeight: 200,
        topClearance: 48,
      }).lift,
    ).toBe(200);
  });

  it("ContactPicker rebases on the window height and grows on layout", () => {
    const picker = readFileSync("src/components/ContactPicker.tsx", "utf8");
    expect(picker).toMatch(
      /rebaseRestingFrame\(restingFrame\.current, windowHeight\)/,
    );
    expect(picker).toMatch(/growRestingFrame\(restingFrame\.current, height\)/);
    expect(picker).not.toMatch(/Math\.max\(restingFrameHeight/);
  });

  it("keeps the same object when nothing changes", () => {
    const resting = { height: 891, windowHeight: 891 };
    expect(rebaseRestingFrame(resting, 891)).toBe(resting);
  });
});
