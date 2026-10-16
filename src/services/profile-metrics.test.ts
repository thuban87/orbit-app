import { describe, expect, it } from "vitest";
import type { ImpactInputs } from "@/db/impact-read";
import {
  resolveProfileGravity,
  resolveProfileIntensity,
  resolveProfileIntensityWindow,
  resolveProfileStatus,
} from "@/services/profile-metrics";

const NOW = "2026-09-09 12:00:00";

function impactInputs(overrides: Partial<ImpactInputs> = {}): ImpactInputs {
  return {
    trackingEnabled: 1,
    intervalDays: 30,
    rarelyResponds: 0,
    interactions: [
      {
        occurredAt: "2026-09-03 10:00:00",
        connected: 1,
        direction: "outbound",
      },
      {
        occurredAt: "2026-07-20 10:00:00",
        connected: 1,
        direction: "mutual",
      },
    ],
    ...overrides,
  };
}

describe("resolveProfileIntensityWindow", () => {
  it("uses the actual positive cadence for a Bound contact", () => {
    expect(resolveProfileIntensityWindow(1, 14, "2026-09-09")).toEqual({
      kind: "cadence",
      days: 14,
      label: "14 days",
    });
  });

  it.each([
    [0, 30],
    [0, null],
    [1, null],
  ])(
    "uses one current local calendar-month contract for tracking=%s cadence=%s",
    (trackingEnabled, intervalDays) => {
      expect(
        resolveProfileIntensityWindow(
          trackingEnabled,
          intervalDays,
          "2026-09-30",
        ),
      ).toEqual({
        kind: "calendar-month",
        start: "2026-09-01",
        endExclusive: "2026-10-01",
        label: "This month",
      });
    },
  );

  it("crosses the December boundary without UTC conversion", () => {
    expect(resolveProfileIntensityWindow(0, null, "2026-12-31")).toEqual({
      kind: "calendar-month",
      start: "2026-12-01",
      endExclusive: "2027-01-01",
      label: "This month",
    });
  });
});

describe("Profile Overview metric models", () => {
  // 38.11 D-05, D-23, D-24: each unavailable reason is distinct.
  const STATUS_BASE = {
    trackingEnabled: 1,
    intervalDays: 30 as number | null,
    status: null,
    progress: null,
    lastContact: null as string | null,
    rarelyResponds: 0,
    rogueReason: null,
    archived: false,
  } as const;
  const CONTACTED = {
    status: "wobble",
    progress: 0.9,
    lastContact: "2026-08-13 09:00:00",
  } as const;

  it("gives a Bound, never-contacted contact Never Contacted with no progress (D-05, D-06, D-08)", () => {
    const status = resolveProfileStatus(STATUS_BASE);
    expect(status).toEqual({
      available: false,
      label: "Never Contacted",
      context: "Orbit Status starts after your first logged interaction.",
      reason: "not-contacted",
    });
    expect(status).not.toHaveProperty("visualValue");
    expect(status).not.toHaveProperty("factors");
  });

  it("gives an Unbound contact with a frequency an Unbound reason, not a set-frequency ask (D-24)", () => {
    const status = resolveProfileStatus({
      ...STATUS_BASE,
      trackingEnabled: 0,
      lastContact: "2026-08-01 12:00:00",
    });
    expect(status).toEqual({
      available: false,
      label: "Not tracked",
      context:
        "Unbound contacts aren't tracked. Bind this contact to see Orbit Status.",
      reason: "unbound",
    });
    expect(status).not.toHaveProperty("visualValue");
  });

  it("asks an Unbound contact with no frequency to set one and bind (D-24)", () => {
    const status = resolveProfileStatus({
      ...STATUS_BASE,
      trackingEnabled: 0,
      intervalDays: null,
    });
    expect(status).toEqual({
      available: false,
      label: "Not tracked",
      context:
        "Set a contact frequency and bind this contact to see Orbit Status.",
      reason: "unbound",
    });
    expect(status).not.toHaveProperty("visualValue");
  });

  it("asks a Bound contact with no frequency to set one (D-23)", () => {
    for (const intervalDays of [null, 0]) {
      const status = resolveProfileStatus({
        ...STATUS_BASE,
        intervalDays,
        lastContact: "2026-08-01 12:00:00",
      });
      expect(status).toEqual({
        available: false,
        label: "Not tracked",
        context: "Set a contact frequency to see Orbit Status.",
        reason: "no-frequency",
      });
      expect(status).not.toHaveProperty("visualValue");
    }
  });

  it("keeps today's literal for an archived contact that is unavailable, never contacted included (D-23)", () => {
    const archivedNeverContacted = resolveProfileStatus({
      ...STATUS_BASE,
      archived: true,
    });
    const archivedUnbound = resolveProfileStatus({
      ...STATUS_BASE,
      archived: true,
      trackingEnabled: 0,
      lastContact: "2026-08-01 12:00:00",
    });
    const todays = {
      available: false,
      label: "Not tracked",
      context: "Set a contact frequency to see Orbit Status.",
      reason: "archived",
    };
    expect(archivedNeverContacted).toEqual(todays);
    expect(archivedNeverContacted.label).not.toBe("Never Contacted");
    expect(archivedUnbound).toEqual(todays);
    expect(archivedUnbound).not.toHaveProperty("visualValue");
  });

  it("keeps an archived, Bound, contacted contact available with its status (D-23)", () => {
    const live = resolveProfileStatus({ ...STATUS_BASE, ...CONTACTED });
    const archived = resolveProfileStatus({
      ...STATUS_BASE,
      ...CONTACTED,
      archived: true,
    });
    expect(archived.available).toBe(true);
    expect(archived).toEqual(live);
  });

  it("exposes only canonical Status factors and no editable value", () => {
    const status = resolveProfileStatus({
      trackingEnabled: 1,
      intervalDays: 30,
      status: "wobble",
      progress: 0.9,
      lastContact: "2026-08-13 09:00:00",
      rarelyResponds: 1,
      rogueReason: null,
      archived: false,
    });

    expect(status).toEqual({
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
    });
    expect(status).not.toHaveProperty("editable");
    expect(status).not.toHaveProperty("health");
    expect(status).not.toHaveProperty("gravity");
    expect(status).not.toHaveProperty("intensity");
  });

  it("keeps Gravity derived and gives empty history a truthful unavailable model", () => {
    expect(resolveProfileGravity(null, 0)).toEqual({
      available: false,
      label: "Not available yet",
      context: "Gravity is derived from interaction history.",
    });

    const gravity = resolveProfileGravity(
      { raw: 8.5, tierIndex: 2, tierName: "solid", tierCount: 4 },
      12,
    );
    expect(gravity).toEqual({
      available: true,
      label: "Solid",
      visualValue: 8.5,
      context: "Derived from 12 interactions, weighted by recency.",
      factors: { interactionCount: 12, tierIndex: 2, tierCount: 4 },
    });
    expect(gravity).not.toHaveProperty("editable");
  });

  it("preserves canonical cadence-relative Intensity for Bound contacts", () => {
    expect(resolveProfileIntensity(impactInputs(), NOW)).toMatchObject({
      available: true,
      label: "At pace",
      context: "1× this period vs 30-day contact frequency.",
      visualValue: 1,
      window: { kind: "cadence", days: 30, label: "30 days" },
      cadenceRelative: true,
      currentCount: 1,
      intendedPerPeriod: 1,
    });
  });

  it("uses exact month boundaries for Unbound activity without dormant cadence", () => {
    const result = resolveProfileIntensity(
      impactInputs({
        trackingEnabled: 0,
        intervalDays: 365,
        interactions: [
          {
            occurredAt: "2026-09-01 00:00:00",
            connected: 1,
            direction: "outbound",
          },
          {
            occurredAt: "2026-08-31 23:59:59",
            connected: 1,
            direction: "outbound",
          },
          {
            occurredAt: "2026-09-10 00:00:00",
            connected: 1,
            direction: "outbound",
          },
          {
            occurredAt: "2026-09-04 00:00:00",
            connected: 1,
            direction: "inbound",
          },
        ],
      }),
      NOW,
    );

    expect(result).toEqual({
      available: true,
      label: "Some activity",
      context: "No contact frequency — showing this month's activity instead.",
      visualValue: 1,
      window: {
        kind: "calendar-month",
        start: "2026-09-01",
        endExclusive: "2026-10-01",
        label: "This month",
      },
      cadenceRelative: false,
      currentCount: 1,
      intendedPerPeriod: null,
      multiple: null,
      trailingAvgGapDays: 1,
    });
  });

  it("keeps the canonical rarely-responds connected filter in month activity", () => {
    const result = resolveProfileIntensity(
      impactInputs({
        trackingEnabled: 0,
        intervalDays: null,
        rarelyResponds: 1,
        interactions: [
          {
            occurredAt: "2026-09-02 10:00:00",
            connected: 0,
            direction: "outbound",
          },
          {
            occurredAt: "2026-09-03 10:00:00",
            connected: 1,
            direction: "outbound",
          },
        ],
      }),
      NOW,
    );

    expect(result.currentCount).toBe(1);
  });
});
