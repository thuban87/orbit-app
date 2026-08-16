/**
 * Pure Send/Copy capability resolver — proof (CMP-03).
 *
 * resolveComposeControls(hasPhone, smsAvailable) resolves an EXPLICIT precedence,
 * the three-row capability matrix from 09-UI-SPEC "Interaction States":
 *   (1) !hasPhone                → Send hidden, Copy primary, add-number affordance
 *                                  (a missing number always wins over SMS capability).
 *   (2) hasPhone && !smsAvailable → Send hidden, Copy primary, SMS-unavailable helper.
 *   (3) hasPhone && smsAvailable  → Send shown, Copy secondary (both controls).
 *
 * The load-bearing decision this locks: without a phone number, SMS capability is
 * irrelevant — the no-phone row (1) fires FIRST, so (false, true) reads identically
 * to (false, false). Pure: same inputs → same output; never throws.
 */
import { describe, expect, it } from "vitest";
import { resolveComposeControls } from "@/logic/compose-logic";

describe("resolveComposeControls — CMP-03 Send/Copy capability matrix", () => {
  it("no phone, no SMS → Send hidden, Copy primary, add-number, no helper (CMP-03)", () => {
    expect(resolveComposeControls(false, false)).toEqual({
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: true,
      smsUnavailableHelper: false,
    });
  });

  it("no phone but SMS available → identical to the no-phone row (SMS irrelevant without a number) (CMP-03)", () => {
    expect(resolveComposeControls(false, true)).toEqual({
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: true,
      smsUnavailableHelper: false,
    });
  });

  it("phone present but device can't text → Send hidden, Copy primary, helper line, no add-number (CMP-03)", () => {
    expect(resolveComposeControls(true, false)).toEqual({
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: false,
      smsUnavailableHelper: true,
    });
  });

  it("phone present and SMS available → Send shown, Copy secondary, no affordances (CMP-03)", () => {
    expect(resolveComposeControls(true, true)).toEqual({
      send: "shown",
      copyEmphasis: "secondary",
      addNumber: false,
      smsUnavailableHelper: false,
    });
  });

  it("probe pending (smsAvailable null), no phone → Send hidden, Copy primary, add-number, no helper (WR-02)", () => {
    expect(resolveComposeControls(false, null)).toEqual({
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: true,
      smsUnavailableHelper: false,
    });
  });

  it("probe pending (smsAvailable null), phone present → Send hidden, Copy primary, no add-number, no helper (WR-02)", () => {
    expect(resolveComposeControls(true, null)).toEqual({
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: false,
      smsUnavailableHelper: false,
    });
  });

  it("is pure — same inputs yield a deep-equal output, never throws (CMP-03)", () => {
    expect(resolveComposeControls(true, true)).toEqual(
      resolveComposeControls(true, true),
    );
  });
});
