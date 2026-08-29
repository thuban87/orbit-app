import { describe, expect, it } from "vitest";
import type { ContactMethodRow } from "@/db/contact-methods-dao";
import {
  canStartLifecycleTransition,
  profileLifecycleView,
  profileMethodGroups,
  unbindConfirmation,
} from "@/screens/contact-profile-logic";

const phone: ContactMethodRow = {
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

describe("profileMethodGroups", () => {
  it("keeps phone first and renders stored labels, formatted values, primary state, extension, and full a11y", () => {
    expect(
      profileMethodGroups({
        phone: [phone],
        email: [
          {
            ...phone,
            id: 2,
            method_type: "email",
            label: "Work",
            extension: null,
            display_value: "ada@example.com",
          },
        ],
      }),
    ).toEqual([
      {
        type: "phone",
        title: "Phone numbers",
        rows: [
          {
            id: 1,
            label: "Mobile",
            displayValue: "+1 312 555 1234",
            extension: "42",
            isPrimary: true,
            helper: null,
            accessibilityLabel:
              "Mobile, +1 312 555 1234, extension 42, Primary",
          },
        ],
      },
      {
        type: "email",
        title: "Email addresses",
        rows: [
          {
            id: 2,
            label: "Work",
            displayValue: "ada@example.com",
            extension: null,
            isPrimary: true,
            helper: null,
            accessibilityLabel: "Work, ada@example.com, Primary",
          },
        ],
      },
    ]);
  });

  it("falls back only for a nullable label, retains invalid rows, and never exposes canonical/raw values", () => {
    const groups = profileMethodGroups({
      phone: [
        {
          ...phone,
          label: null,
          raw_value: "bad number",
          display_value: "bad number",
          canonical_value: null,
          canonical_region: null,
          is_actionable: 0,
        },
      ],
      email: [],
    });

    expect(groups).toEqual([
      {
        type: "phone",
        title: "Phone numbers",
        rows: [
          {
            id: 1,
            label: "Phone number",
            displayValue: "bad number",
            extension: "42",
            isPrimary: true,
            helper: "This number can’t be used for calls or messages yet.",
            accessibilityLabel:
              "Phone number, bad number, extension 42, Primary. This number can’t be used for calls or messages yet.",
          },
        ],
      },
    ]);
    expect(groups[0]?.rows[0]).not.toHaveProperty("canonicalValue");
    expect(groups[0]?.rows[0]).not.toHaveProperty("rawValue");
  });

  it("omits empty type groups", () => {
    expect(profileMethodGroups({ phone: [], email: [] })).toEqual([]);
  });
});

describe("profileLifecycleView", () => {
  it("retains Bound cadence treatment", () => {
    expect(
      profileLifecycleView({ trackingEnabled: 1, intervalDays: 30 }),
    ).toEqual({
      kind: "bound",
      showCadenceTreatment: true,
      showFrequencyPicker: false,
      bindEnabled: false,
    });
  });

  it("lets an Unbound contact with dormant cadence bind immediately", () => {
    expect(
      profileLifecycleView({ trackingEnabled: 0, intervalDays: 30 }),
    ).toEqual({
      kind: "unbound-dormant",
      showCadenceTreatment: false,
      showFrequencyPicker: false,
      bindEnabled: true,
    });
  });

  it("requires a cadence before binding a never-assigned Unbound contact", () => {
    expect(
      profileLifecycleView({ trackingEnabled: 0, intervalDays: null }),
    ).toEqual({
      kind: "unbound-never-assigned",
      showCadenceTreatment: false,
      showFrequencyPicker: true,
      bindEnabled: false,
    });
  });
});

describe("profile lifecycle actions", () => {
  it("uses the exact native Unbind confirmation copy", () => {
    expect(unbindConfirmation("Ada")).toEqual({
      title: "Unbind Ada?",
      message:
        "This removes them from your active orbit, reminders, favourites, and widgets. Their history, details, and saved cadence stay.",
    });
  });

  it("allows only one lifecycle transition at a time and requires a bindable cadence", () => {
    expect(canStartLifecycleTransition({ pending: false, bindEnabled: true })).toBe(true);
    expect(canStartLifecycleTransition({ pending: true, bindEnabled: true })).toBe(false);
    expect(canStartLifecycleTransition({ pending: false, bindEnabled: false })).toBe(false);
  });
});
