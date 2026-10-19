import { describe, expect, it } from "vitest";
import { sheetKeyboardLayout } from "@/components/ui/sheet-contract";
import {
  CONTACT_PICKER_MIN_HEIGHT,
  CONTACT_PICKER_RESTING_MAX_HEIGHT,
  contactPickerKeyboardFrame,
  contactPickerTitle,
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
