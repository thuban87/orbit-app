import { describe, expect, it } from "vitest";
import type { ProfileStatusMetric } from "@/services/profile-metrics";
import {
  FREQUENCY_CHOICES,
  PROFILE_MESSAGE_ARCHIVED_REASON,
  PROFILE_MESSAGE_SETTINGS_HOST_REASON,
  profileHeroActionState,
  RELATIONSHIP_DEFINITIONS,
  relationshipExplanation,
  relationshipSheetReducer,
  SNOOZE_CHOICES,
  savedMethodKinds,
  validateCustomSnoozeDate,
} from "./relationship-sheet-model";

const STANDARD = { archived: false, settingsHosted: false } as const;
const PHONE = { phone: { is_actionable: 1 } as never, email: null };
const NO_METHODS = { phone: null, email: null };
const CALL_ENABLED = { enabled: true, route: "call", reason: null };
const CALL_DISABLED = {
  enabled: false,
  route: null,
  reason: "Add a phone number to call this contact.",
};

describe("fixed Hero action capability", () => {
  it("keeps Call and Message independent with readable disabled reasons", () => {
    expect(
      profileHeroActionState(
        {
          phone: null,
          email: { is_actionable: 1 } as never,
        },
        STANDARD,
      ),
    ).toEqual({
      message: { enabled: true, route: "compose", reason: null },
      call: {
        enabled: false,
        route: null,
        reason: "Add a phone number to call this contact.",
      },
    });
    // 38.11 D-27: a saved phone that is not actionable is an unusable number,
    // not a missing one.
    expect(
      profileHeroActionState(
        {
          phone: { is_actionable: 0 } as never,
          email: null,
        },
        STANDARD,
      ),
    ).toEqual({
      message: {
        enabled: false,
        route: null,
        reason:
          "This contact's number can't be used to message. Check it in Edit Contact.",
      },
      call: {
        enabled: false,
        route: null,
        reason:
          "This phone number can't be used to call. Check it in Edit Contact.",
      },
    });
  });
});

// 38.11 D-27 (ADR-109): "no number" versus "a number that can't be used",
// naming only the method kinds the contact actually has (T-20).
describe("Hero reasons tell missing from unusable methods", () => {
  const NONE = { phone: false, email: false } as const;
  const UNUSABLE_PHONE = { phone: true, email: false } as const;
  const UNUSABLE_EMAIL = { phone: false, email: true } as const;
  const UNUSABLE_BOTH = { phone: true, email: true } as const;

  it("asks to add a phone number when there is no phone", () => {
    expect(profileHeroActionState(NO_METHODS, STANDARD, NONE).call).toEqual(
      CALL_DISABLED,
    );
  });

  it("says a saved phone number can't be used to call", () => {
    expect(
      profileHeroActionState(NO_METHODS, STANDARD, UNUSABLE_PHONE).call,
    ).toEqual({
      enabled: false,
      route: null,
      reason:
        "This phone number can't be used to call. Check it in Edit Contact.",
    });
  });

  it("asks to add a phone number or email when there are no methods", () => {
    expect(
      profileHeroActionState(NO_METHODS, STANDARD, NONE).message.reason,
    ).toBe("Add a phone number or email to message this contact.");
  });

  it("names only the number when only an unusable phone exists", () => {
    expect(
      profileHeroActionState(NO_METHODS, STANDARD, UNUSABLE_PHONE).message
        .reason,
    ).toBe(
      "This contact's number can't be used to message. Check it in Edit Contact.",
    );
  });

  it("names only the email when only an unusable email exists, never a number", () => {
    const reason = profileHeroActionState(NO_METHODS, STANDARD, UNUSABLE_EMAIL)
      .message.reason;
    expect(reason).toBe(
      "This contact's email can't be used to message. Check it in Edit Contact.",
    );
    expect(reason).not.toContain("number");
    expect(
      profileHeroActionState(NO_METHODS, STANDARD, UNUSABLE_EMAIL).call,
    ).toEqual(CALL_DISABLED);
  });

  it("names both when an unusable phone and an unusable email exist", () => {
    expect(
      profileHeroActionState(NO_METHODS, STANDARD, UNUSABLE_BOTH).message
        .reason,
    ).toBe(
      "This contact's number and email can't be used to message. Check them in Edit Contact.",
    );
  });

  it("keeps Message enabled when any method is usable", () => {
    expect(
      profileHeroActionState(
        { phone: null, email: { is_actionable: 1 } as never },
        STANDARD,
        UNUSABLE_PHONE,
      ).message,
    ).toEqual({ enabled: true, route: "compose", reason: null });
  });

  it("keeps the archived and Settings-host reasons first", () => {
    expect(
      profileHeroActionState(
        NO_METHODS,
        { archived: true, settingsHosted: false },
        UNUSABLE_PHONE,
      ).message.reason,
    ).toBe(PROFILE_MESSAGE_ARCHIVED_REASON);
    expect(
      profileHeroActionState(
        NO_METHODS,
        { archived: false, settingsHosted: true },
        UNUSABLE_BOTH,
      ).message.reason,
    ).toBe(PROFILE_MESSAGE_SETTINGS_HOST_REASON);
  });

  it("reads the saved kinds from the method groups", () => {
    expect(savedMethodKinds({ phone: [], email: [] })).toEqual(NONE);
    expect(savedMethodKinds({ phone: [{} as never], email: [] })).toEqual(
      UNUSABLE_PHONE,
    );
    expect(
      savedMethodKinds({ phone: [], email: [{} as never, {} as never] }),
    ).toEqual(UNUSABLE_EMAIL);
  });
});

// RG-021 — owner rulings D-09 (archived → Message disabled in every host) and
// D-25 (Settings-hosted Profile → Message disabled). Disabled with a reason,
// never hidden; Call is unaffected (D-27 keeps native handoffs enabled).
describe("Hero Message eligibility by archive state and host", () => {
  it("enables Message for a live contact in a standard host", () => {
    expect(profileHeroActionState(PHONE, STANDARD)).toEqual({
      message: { enabled: true, route: "compose", reason: null },
      call: CALL_ENABLED,
    });
  });

  it("disables Message for an archived contact with the archived reason", () => {
    expect(
      profileHeroActionState(PHONE, { archived: true, settingsHosted: false }),
    ).toEqual({
      message: {
        enabled: false,
        route: null,
        reason: PROFILE_MESSAGE_ARCHIVED_REASON,
      },
      call: CALL_ENABLED,
    });
  });

  it("disables Message for a Settings-hosted live contact with the host reason", () => {
    expect(
      profileHeroActionState(PHONE, { archived: false, settingsHosted: true }),
    ).toEqual({
      message: {
        enabled: false,
        route: null,
        reason: PROFILE_MESSAGE_SETTINGS_HOST_REASON,
      },
      call: CALL_ENABLED,
    });
  });

  it("prefers the archived reason when archived and Settings-hosted", () => {
    expect(
      profileHeroActionState(PHONE, { archived: true, settingsHosted: true })
        .message,
    ).toEqual({
      enabled: false,
      route: null,
      reason: PROFILE_MESSAGE_ARCHIVED_REASON,
    });
  });

  it("checks archive and host before method availability", () => {
    expect(
      profileHeroActionState(NO_METHODS, {
        archived: true,
        settingsHosted: false,
      }).message.reason,
    ).toBe(PROFILE_MESSAGE_ARCHIVED_REASON);
    expect(
      profileHeroActionState(NO_METHODS, {
        archived: false,
        settingsHosted: true,
      }).message.reason,
    ).toBe(PROFILE_MESSAGE_SETTINGS_HOST_REASON);
    expect(profileHeroActionState(NO_METHODS, STANDARD)).toEqual({
      message: {
        enabled: false,
        route: null,
        reason: "Add a phone number or email to message this contact.",
      },
      call: CALL_DISABLED,
    });
  });

  it("leaves Call exactly as the method rule decides in every context", () => {
    for (const archived of [false, true]) {
      for (const settingsHosted of [false, true]) {
        const context = { archived, settingsHosted };
        expect(profileHeroActionState(PHONE, context).call).toEqual(
          CALL_ENABLED,
        );
        expect(profileHeroActionState(NO_METHODS, context).call).toEqual(
          CALL_DISABLED,
        );
      }
    }
  });

  it("uses distinct, non-empty reason copy", () => {
    expect(PROFILE_MESSAGE_ARCHIVED_REASON.length).toBeGreaterThan(0);
    expect(PROFILE_MESSAGE_SETTINGS_HOST_REASON.length).toBeGreaterThan(0);
    expect(PROFILE_MESSAGE_ARCHIVED_REASON).not.toBe(
      PROFILE_MESSAGE_SETTINGS_HOST_REASON,
    );
  });
});

describe("relationship explanations", () => {
  it("names only the actual available Status factors and History/Insights routes", () => {
    expect(
      relationshipExplanation({
        kind: "status",
        metric: {
          available: true,
          label: "Wobbly",
          visualValue: 0.9,
          context: "27 of 30 days since the last interaction.",
          factors: {
            lastContact: "2026-08-13 09:00:00",
            intervalDays: 30,
            progress: 0.9,
            rarelyResponds: true,
            rogueReason: null,
          },
        },
        insightsAvailable: true,
        historyAvailable: true,
      }),
    ).toEqual({
      title: "Orbit Status",
      definition: RELATIONSHIP_DEFINITIONS.status,
      summary: "Wobbly",
      details: [
        "Last interaction: Aug 13, 2026, 9:00 AM",
        "Contact frequency: every 30 days",
        "Elapsed progress: 90%",
        "Rarely Responds: only connected interactions reset the orbit",
      ],
      routes: ["history", "insights"],
    });
  });

  it("D-72: shows Last interaction at minute precision, never seconds", () => {
    const status = (lastContact: string) =>
      relationshipExplanation({
        kind: "status",
        metric: {
          available: true,
          label: "Stable",
          visualValue: 0.1,
          context: "0 of 14 days since the last interaction.",
          factors: {
            lastContact,
            intervalDays: 14,
            progress: 0.1,
            rarelyResponds: false,
            rogueReason: null,
          },
        },
        insightsAvailable: false,
        historyAvailable: false,
      }).details[0];
    expect(status("2026-09-27 16:38:58")).toBe(
      "Last interaction: Sep 27, 2026, 4:38 PM",
    );
    expect(status("2026-09-27 16:38:58")).not.toMatch(/:58/);
    expect(status("not a timestamp")).toBe("Last interaction: Unknown time");
  });

  it("uses cadence-safe unavailable Status copy for each reason (38.11 D-23, D-24)", () => {
    expect(
      relationshipExplanation({
        kind: "status",
        metric: {
          available: false,
          label: "Not tracked",
          context:
            "Unbound contacts aren't tracked. Bind this contact to see Orbit Status.",
          reason: "unbound",
        },
        insightsAvailable: false,
        historyAvailable: true,
      }),
    ).toMatchObject({
      title: "Orbit Status",
      summary: "Not tracked",
      details: [
        "Unbound contacts aren't tracked. Bind this contact to see Orbit Status.",
      ],
      routes: ["history"],
    });
  });

  it("shows Never Contacted with its context and no progress factors (38.11 D-05)", () => {
    const explanation = relationshipExplanation({
      kind: "status",
      metric: {
        available: false,
        label: "Never Contacted",
        context: "Orbit Status starts after your first logged interaction.",
        reason: "not-contacted",
      },
      insightsAvailable: true,
      historyAvailable: true,
    });
    expect(explanation).toMatchObject({
      title: "Orbit Status",
      summary: "Never Contacted",
      details: ["Orbit Status starts after your first logged interaction."],
      routes: ["history"],
    });
    expect(explanation.details.join(" ")).not.toMatch(/progress/i);
  });

  // 38.3 RG-021 (D-11): when the Profile layout omits History, the Status
  // sheet offers no History route — Insights is unaffected.
  const AVAILABLE_STATUS: ProfileStatusMetric = {
    available: true,
    label: "Stable",
    visualValue: 0.2,
    context: "6 of 30 days since the last interaction.",
    factors: {
      lastContact: "2026-09-13 09:00:00",
      intervalDays: 30,
      progress: 0.2,
      rarelyResponds: false,
      rogueReason: null,
    },
  };
  const UNAVAILABLE_STATUS: ProfileStatusMetric = {
    available: false,
    label: "Not tracked",
    context: "Set a contact frequency to see Orbit Status.",
    reason: "no-frequency",
  };

  it("omits the History route when History is not available (D-11)", () => {
    expect(
      relationshipExplanation({
        kind: "status",
        metric: AVAILABLE_STATUS,
        insightsAvailable: true,
        historyAvailable: false,
      }).routes,
    ).toEqual(["insights"]);
    expect(
      relationshipExplanation({
        kind: "status",
        metric: AVAILABLE_STATUS,
        insightsAvailable: false,
        historyAvailable: false,
      }).routes ?? [],
    ).toEqual([]);
  });

  it("offers no routes for an unavailable Status when History is not available", () => {
    expect(
      relationshipExplanation({
        kind: "status",
        metric: UNAVAILABLE_STATUS,
        insightsAvailable: true,
        historyAvailable: false,
      }).routes ?? [],
    ).toEqual([]);
  });

  it("keeps the History route unchanged when History is available", () => {
    expect(
      relationshipExplanation({
        kind: "status",
        metric: AVAILABLE_STATUS,
        insightsAvailable: false,
        historyAvailable: true,
      }).routes,
    ).toEqual(["history"]);
    expect(
      relationshipExplanation({
        kind: "status",
        metric: UNAVAILABLE_STATUS,
        insightsAvailable: false,
        historyAvailable: true,
      }).routes,
    ).toEqual(["history"]);
  });

  it("explains Gravity and Intensity without making either editable", () => {
    const gravity = relationshipExplanation({
      kind: "gravity",
      metric: {
        available: true,
        label: "Solid",
        visualValue: 8.5,
        context: "Derived from 12 interactions, weighted by recency.",
        factors: { interactionCount: 12, tierIndex: 2, tierCount: 4 },
      },
    });
    const intensity = relationshipExplanation({
      kind: "intensity",
      metric: {
        available: true,
        label: "Active",
        visualValue: 3,
        context:
          "No contact frequency — showing this month's activity instead.",
        window: {
          kind: "calendar-month",
          start: "2026-09-01",
          endExclusive: "2026-10-01",
          label: "This month",
        },
        cadenceRelative: false,
        currentCount: 3,
        intendedPerPeriod: null,
        multiple: null,
        trailingAvgGapDays: 4,
      },
    });
    expect(gravity.details).toEqual([
      "12 interactions",
      "Weighted by recency",
      "Tier 3 of 4",
    ]);
    expect(intensity.details).toEqual([
      "This month",
      "3 qualifying interactions",
      "No contact frequency — showing this month's activity instead.",
    ]);
    expect(gravity).not.toHaveProperty("editable");
    expect(intensity).not.toHaveProperty("editable");
  });

  // 38.11 D-75: each stat sheet opens with a plain explanation of the term.
  it("defines Orbit Status, Gravity and Intensity in plain words (D-75)", () => {
    expect(RELATIONSHIP_DEFINITIONS).toEqual({
      status:
        "Orbit Status shows how far along you are toward your contact frequency since you last spoke.",
      gravity:
        "Gravity is how much shared history you have with this person. Every logged interaction adds to it, and recent ones weigh more than old ones, so it grows as you keep in touch and fades slowly when you don't. Old history never fades away completely. It shows as a tier (Thin, Building, Solid or Deep), not a score. For people marked Rarely Responds, only interactions that connected count.",
      intensity:
        "Intensity counts the times you reached out recently: within one contact frequency (the last 30 days for Monthly), or this calendar month when the contact is Unbound or has no frequency. With a frequency, reaching out once in that time reads as At pace and more often reads as Active. Interactions they started don't count.",
    });
    // Status about one line, Intensity a little more, Gravity the most.
    expect(RELATIONSHIP_DEFINITIONS.status.length).toBeLessThan(
      RELATIONSHIP_DEFINITIONS.intensity.length,
    );
    expect(RELATIONSHIP_DEFINITIONS.intensity.length).toBeLessThan(
      RELATIONSHIP_DEFINITIONS.gravity.length,
    );
  });

  it("puts the definition on every stat sheet, available or not (D-75)", () => {
    expect(
      relationshipExplanation({
        kind: "status",
        metric: UNAVAILABLE_STATUS,
        insightsAvailable: false,
        historyAvailable: false,
      }).definition,
    ).toBe(RELATIONSHIP_DEFINITIONS.status);
    expect(
      relationshipExplanation({
        kind: "gravity",
        metric: {
          available: false,
          label: "No interactions yet",
          context: "Gravity builds as you log interactions.",
        },
      }),
    ).toEqual({
      title: "Gravity",
      definition: RELATIONSHIP_DEFINITIONS.gravity,
      summary: "No interactions yet",
      details: ["Gravity builds as you log interactions."],
    });
    expect(
      relationshipExplanation({
        kind: "intensity",
        metric: {
          available: true,
          label: "No activity",
          visualValue: 0,
          context: "0× this period vs 30-day contact frequency.",
          window: { kind: "cadence", days: 30, label: "30 days" },
          cadenceRelative: true,
          currentCount: 0,
          intendedPerPeriod: 1,
          multiple: 0,
          trailingAvgGapDays: null,
        },
      }).definition,
    ).toBe(RELATIONSHIP_DEFINITIONS.intensity);
  });
});

describe("frequency and snooze choices", () => {
  it("exposes every canonical frequency with selected accessible labels", () => {
    expect(FREQUENCY_CHOICES.map((choice) => choice.days)).toEqual([
      1, 7, 14, 30, 90, 182, 365,
    ]);
    expect(FREQUENCY_CHOICES.map((choice) => choice.label)).toEqual([
      "Daily",
      "Weekly",
      "Bi-Weekly",
      "Monthly",
      "Quarterly",
      "Bi-Annually",
      "Yearly",
    ]);
    expect(FREQUENCY_CHOICES[1].accessibilityLabel).toBe(
      "Weekly, every 7 days",
    );
  });

  it("exposes all presets, custom-date, and conditional Unsnooze actions", () => {
    expect(SNOOZE_CHOICES).toEqual([
      {
        kind: "preset",
        preset: "3d",
        label: "3 days",
        accessibilityLabel: "Snooze for 3 days",
      },
      {
        kind: "preset",
        preset: "1w",
        label: "1 week",
        accessibilityLabel: "Snooze for 1 week",
      },
      {
        kind: "preset",
        preset: "1m",
        label: "1 month",
        accessibilityLabel: "Snooze for 1 month",
      },
      {
        kind: "custom",
        label: "Choose date",
        accessibilityLabel: "Choose a custom snooze date",
      },
    ]);
  });

  it("validates future local custom dates without UTC conversion", () => {
    expect(validateCustomSnoozeDate("2026-09-10", "2026-09-09")).toEqual({
      valid: true,
    });
    for (const value of ["", "2026-02-30", "2026-09-09", "not-a-date"]) {
      expect(validateCustomSnoozeDate(value, "2026-09-09")).toEqual({
        valid: false,
        error: "Choose a future date.",
      });
    }
  });
});

describe("persist-first relationship sheet state", () => {
  it("publishes committed values only after success", () => {
    const initial = { committed: 30, draft: 30, pending: false, error: null };
    const pending = relationshipSheetReducer(initial, {
      type: "submit",
      value: 14,
    });
    expect(pending).toEqual({
      committed: 30,
      draft: 14,
      pending: true,
      error: null,
    });
    expect(relationshipSheetReducer(pending, { type: "success" })).toEqual({
      committed: 14,
      draft: 14,
      pending: false,
      error: null,
    });
  });

  it("retains a failed choice for Retry and permits clean dismissal", () => {
    const failed = relationshipSheetReducer(
      { committed: "3d", draft: "1w", pending: true, error: null },
      { type: "failure" },
    );
    expect(failed).toEqual({
      committed: "3d",
      draft: "1w",
      pending: false,
      error: "Couldn't save your changes. Nothing was applied. Try again.",
    });
    expect(relationshipSheetReducer(failed, { type: "retry" }).pending).toBe(
      true,
    );
    expect(relationshipSheetReducer(failed, { type: "dismiss" })).toEqual({
      committed: "3d",
      draft: "3d",
      pending: false,
      error: null,
    });
  });
});
