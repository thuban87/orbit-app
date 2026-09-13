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
import type { ContactMethodRow } from "@/db/contact-methods-dao";
import {
  actionablePrimaryPhoneDestination,
  effectiveMode,
  nextRememberedMode,
  resolveComposeControls,
  resolveUsableMode,
} from "@/logic/compose-logic";

const primaryPhone: ContactMethodRow = {
  id: 1,
  uid: "method-phone",
  contact_id: 4,
  method_type: "phone",
  raw_value: "(312) 555-1234",
  display_value: "+1 312 555 1234",
  canonical_value: "+13125551234",
  canonical_region: "US",
  extension: "42",
  label: "Mobile",
  is_actionable: 1,
  is_primary: 1,
  display_order: 0,
  created_at: "2026-08-28 12:00:00",
  modified_at: "2026-08-28 12:00:00",
};

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

describe("resolveComposeControls — Text/Email mode (COMP-03, HIGH-2)", () => {
  // H1 (build-breaker fix): the two NEW params (mode/hasEmail) are OPTIONAL with
  // defaults ('text'/false), so the wave-1 2-arg call returns the SAME object as
  // the explicit ('text', false) call for every (hasPhone, smsAvailable) row.
  it("H1: the 2-arg call equals the explicit ('text', false) call for every row", () => {
    for (const hasPhone of [true, false]) {
      for (const smsAvailable of [true, false, null] as const) {
        expect(resolveComposeControls(hasPhone, smsAvailable)).toEqual(
          resolveComposeControls(hasPhone, smsAvailable, "text", false),
        );
      }
    }
  });

  it("Text mode + primary phone + SMS available → Transmit shown, Copy secondary", () => {
    expect(resolveComposeControls(true, true, "text", false)).toEqual({
      send: "shown",
      copyEmphasis: "secondary",
      addNumber: false,
      smsUnavailableHelper: false,
    });
  });

  it("Text mode + no phone (no email) → Transmit unavailable, Copy sole primary, establish-primary prompt (not an error)", () => {
    expect(resolveComposeControls(false, true, "text", false)).toEqual({
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: true,
      smsUnavailableHelper: false,
    });
  });

  it("Email mode + primary email → Transmit shown (email), Copy secondary, no SMS helper", () => {
    expect(resolveComposeControls(false, false, "email", true)).toEqual({
      send: "shown",
      copyEmphasis: "secondary",
      addNumber: false,
      smsUnavailableHelper: false,
    });
  });

  it("Email mode + primary email + smsAvailable===null → Transmit STILL available (SMS probe does not gate Email)", () => {
    expect(resolveComposeControls(false, null, "email", true)).toEqual({
      send: "shown",
      copyEmphasis: "secondary",
      addNumber: false,
      smsUnavailableHelper: false,
    });
  });

  it("Email mode + primary email + smsAvailable===false → Transmit STILL available (Email has no probe-pending / SMS dependency)", () => {
    expect(resolveComposeControls(true, false, "email", true)).toEqual({
      send: "shown",
      copyEmphasis: "secondary",
      addNumber: false,
      smsUnavailableHelper: false,
    });
  });

  it("Email mode + no email but phone (SMS available) → falls back to the usable Text mode (Transmit shown)", () => {
    expect(resolveComposeControls(true, true, "email", false)).toEqual({
      send: "shown",
      copyEmphasis: "secondary",
      addNumber: false,
      smsUnavailableHelper: false,
    });
  });

  it("Email mode + no email but phone (device can't text) → falls back to Text with the SMS-unavailable helper", () => {
    expect(resolveComposeControls(true, false, "email", false)).toEqual({
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: false,
      smsUnavailableHelper: true,
    });
  });

  it("Text mode + smsAvailable===null (probe pending) → Transmit hidden, Copy primary, no helper (probe-pending gates Text)", () => {
    expect(resolveComposeControls(true, null, "text", false)).toEqual({
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: false,
      smsUnavailableHelper: false,
    });
  });

  it("Neither phone nor email → Transmit unavailable + Copy sole primary in BOTH modes, never throws", () => {
    for (const mode of ["text", "email"] as const) {
      for (const smsAvailable of [true, false, null] as const) {
        expect(() =>
          resolveComposeControls(false, smsAvailable, mode, false),
        ).not.toThrow();
        expect(resolveComposeControls(false, smsAvailable, mode, false)).toEqual(
          {
            send: "hidden",
            copyEmphasis: "primary",
            addNumber: true,
            smsUnavailableHelper: false,
          },
        );
      }
    }
  });
});

describe("resolveUsableMode — preferred-then-fallback destination resolution (COMP-03)", () => {
  it("Text preferred: uses Text when a phone exists", () => {
    expect(resolveUsableMode("text", true, false)).toBe("text");
    expect(resolveUsableMode("text", true, true)).toBe("text");
  });

  it("Text preferred with no phone: falls back to Email when one exists", () => {
    expect(resolveUsableMode("text", false, true)).toBe("email");
  });

  it("Email preferred: uses Email when an email exists", () => {
    expect(resolveUsableMode("email", false, true)).toBe("email");
    expect(resolveUsableMode("email", true, true)).toBe("email");
  });

  it("Email preferred with no email: falls back to Text when a phone exists", () => {
    expect(resolveUsableMode("email", true, false)).toBe("text");
  });

  it("neither destination exists → null (no usable mode) in both modes", () => {
    expect(resolveUsableMode("text", false, false)).toBeNull();
    expect(resolveUsableMode("email", false, false)).toBeNull();
  });
});

describe("effectiveMode — resolves the 'remember' sentinel (COMP-02)", () => {
  it("'remember' resolves to the remembered concrete mode", () => {
    expect(effectiveMode("remember", "text")).toBe("text");
    expect(effectiveMode("remember", "email")).toBe("email");
  });

  it("a fixed default is used verbatim, ignoring the remembered value", () => {
    expect(effectiveMode("email", "text")).toBe("email");
    expect(effectiveMode("text", "email")).toBe("text");
  });
});

describe("nextRememberedMode — advances ONLY on a Transmit/Copy commit (COMP-02)", () => {
  it("returns the ad-hoc mode only when committed is true", () => {
    expect(nextRememberedMode("text", "email", true)).toBe("email");
  });

  it("returns the current remembered mode on an ad-hoc in-session switch (not committed)", () => {
    expect(nextRememberedMode("text", "email", false)).toBe("text");
  });
});

describe("actionablePrimaryPhoneDestination", () => {
  it("passes the DAO-selected canonical primary through unchanged for the OS handoff", () => {
    expect(actionablePrimaryPhoneDestination(primaryPhone)).toBe(
      "+13125551234",
    );
  });

  it("suppresses missing, invalid, and malformed stored primary rows without re-parsing", () => {
    expect(actionablePrimaryPhoneDestination(null)).toBeNull();
    expect(
      actionablePrimaryPhoneDestination({ ...primaryPhone, is_actionable: 0 }),
    ).toBeNull();
    expect(
      actionablePrimaryPhoneDestination({
        ...primaryPhone,
        canonical_value: null,
      }),
    ).toBeNull();
  });
});
