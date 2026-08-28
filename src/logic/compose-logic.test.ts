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
  resolveComposeControls,
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
