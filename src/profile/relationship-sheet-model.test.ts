import { describe, expect, it } from "vitest";
import {
  FREQUENCY_CHOICES,
  PROFILE_MESSAGE_ARCHIVED_REASON,
  PROFILE_MESSAGE_SETTINGS_HOST_REASON,
  profileHeroActionState,
  relationshipExplanation,
  relationshipSheetReducer,
  SNOOZE_CHOICES,
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
        reason: "Add a phone number or email to message this contact.",
      },
      call: {
        enabled: false,
        route: null,
        reason: "Add a phone number to call this contact.",
      },
    });
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
      summary: "Wobbly",
      details: [
        "Last interaction: 2026-08-13 09:00:00",
        "Contact frequency: every 30 days",
        "Elapsed progress: 90%",
        "Rarely Responds: only connected interactions reset the orbit",
      ],
      routes: ["history", "insights"],
    });
  });

  it("uses cadence-safe unavailable Status copy", () => {
    expect(
      relationshipExplanation({
        kind: "status",
        metric: {
          available: false,
          label: "Not tracked",
          context: "Set a contact frequency to see Orbit Status.",
        },
        insightsAvailable: false,
        historyAvailable: true,
      }),
    ).toEqual({
      title: "Orbit Status",
      summary: "Not tracked",
      details: ["Set a contact frequency to see Orbit Status."],
      routes: ["history"],
    });
  });

  // 38.3 RG-021 (D-11): when the Profile layout omits History, the Status
  // sheet offers no History route — Insights is unaffected.
  const AVAILABLE_STATUS = {
    available: true,
    label: "Steady",
    visualValue: 0.2,
    context: "6 of 30 days since the last interaction.",
    factors: {
      lastContact: "2026-09-13 09:00:00",
      intervalDays: 30,
      progress: 0.2,
      rarelyResponds: false,
      rogueReason: null,
    },
  } as const;
  const UNAVAILABLE_STATUS = {
    available: false,
    label: "Not tracked",
    context: "Set a contact frequency to see Orbit Status.",
  } as const;

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
