import { describe, expect, it } from "vitest";
import type { TouchpointRefineValue } from "@/components/TouchpointRefineForm";
import {
  applyChannelChange,
  buildLogInteractionInput,
  defaultsForChannel,
  ORDINARY_LOG_CHANNEL_OPTIONS,
  resolveInitialAllowAi,
  resolveInitialChannel,
  shouldUpdateRemembered,
} from "@/screens/log-interaction-logic";

const NOW = "2026-09-12 12:00:00";

const baseValue: TouchpointRefineValue = {
  occurredAt: "2026-09-01 09:30:00",
  channel: "Message",
  direction: "outbound",
  connected: 1,
  quality: null,
  note: null,
  duration: null,
  allowAi: 0,
};

describe("log-interaction-logic — channel-sensitive Direction/Connected defaults (CAPT-08, §R/§S)", () => {
  it("In Person → Direction Mutual, Connected hidden and 1", () => {
    expect(defaultsForChannel("In Person")).toEqual({
      direction: "mutual",
      connectedHidden: true,
      connected: 1,
    });
  });

  it("Message → Direction Outbound, Connected shown and 1", () => {
    expect(defaultsForChannel("Message")).toEqual({
      direction: "outbound",
      connectedHidden: false,
      connected: 1,
    });
  });

  it("Call → Direction Outbound, Connected shown and 1", () => {
    expect(defaultsForChannel("Call")).toEqual({
      direction: "outbound",
      connectedHidden: false,
      connected: 1,
    });
  });

  it("applyChannelChange seeds the channel defaults when the user has NOT overridden Direction", () => {
    const next = applyChannelChange(baseValue, "In Person", false);
    expect(next.channel).toBe("In Person");
    expect(next.direction).toBe("mutual");
    expect(next.connected).toBe(1);
  });

  it("applyChannelChange does NOT re-fight a user-overridden Direction on a channel change", () => {
    // The user picked Inbound; switching channel must preserve it (§R/§S).
    const overridden: TouchpointRefineValue = {
      ...baseValue,
      direction: "inbound",
    };
    const next = applyChannelChange(overridden, "In Person", true);
    expect(next.channel).toBe("In Person");
    expect(next.direction).toBe("inbound");
  });

  it("applyChannelChange forces Connected 1 when the new channel hides it (In Person)", () => {
    const disconnected: TouchpointRefineValue = { ...baseValue, connected: 0 };
    const next = applyChannelChange(disconnected, "In Person", false);
    expect(next.connected).toBe(1);
  });

  it("applyChannelChange preserves the user's Connected when the channel shows it (Message/Call)", () => {
    const disconnected: TouchpointRefineValue = { ...baseValue, connected: 0 };
    const next = applyChannelChange(disconnected, "Call", false);
    expect(next.connected).toBe(0);
  });
});

describe("log-interaction-logic — preference resolution (CAPT-11, D-09)", () => {
  it("a fixed preference selects that exact channel", () => {
    expect(resolveInitialChannel("Message", "Call")).toBe("Message");
    expect(resolveInitialChannel("Call", "Message")).toBe("Call");
    expect(resolveInitialChannel("In Person", "Message")).toBe("In Person");
  });

  it("the 'remember' sentinel reads the remembered value", () => {
    expect(resolveInitialChannel("remember", "Call")).toBe("Call");
    expect(resolveInitialChannel("remember", "In Person")).toBe("In Person");
  });

  it("falls back to Message when remembered is somehow absent", () => {
    expect(resolveInitialChannel("remember", null)).toBe("Message");
    expect(resolveInitialChannel("remember", undefined)).toBe("Message");
  });

  it("never returns an empty channel", () => {
    for (const pref of ["remember", "Message", "Call", "In Person"] as const) {
      expect(resolveInitialChannel(pref, null).length).toBeGreaterThan(0);
    }
  });
});

describe("log-interaction-logic — remembered-write gate (CAPT-11, D-09)", () => {
  it("updates the remembered channel ONLY on a successful ordinary save", () => {
    expect(
      shouldUpdateRemembered({ saveSucceeded: true, isGroupLog: false }),
    ).toBe(true);
  });

  it("never updates on a failed/cancelled save", () => {
    expect(
      shouldUpdateRemembered({ saveSucceeded: false, isGroupLog: false }),
    ).toBe(false);
  });

  it("never updates for a Group Log save (even on success)", () => {
    expect(
      shouldUpdateRemembered({ saveSucceeded: true, isGroupLog: true }),
    ).toBe(false);
    expect(
      shouldUpdateRemembered({ saveSucceeded: false, isGroupLog: true }),
    ).toBe(false);
  });
});

describe("log-interaction-logic — recordTouchpoint input assembly (D-04/D-08)", () => {
  it("passes an omitted Tone through as null (never coerced to Neutral — D-08)", () => {
    const input = buildLogInteractionInput(
      { ...baseValue, quality: null },
      { contactId: 3, uid: "uid-1", now: NOW },
    );
    expect(input.quality).toBeNull();
  });

  it("passes an explicit Tone through verbatim", () => {
    const input = buildLogInteractionInput(
      { ...baseValue, quality: "Negative" },
      { contactId: 3, uid: "uid-1", now: NOW },
    );
    expect(input.quality).toBe("Negative");
  });

  it("defaults Allow-AI OFF (0) for a non-explicit value (D-04)", () => {
    const input = buildLogInteractionInput(baseValue, {
      contactId: 3,
      uid: "uid-1",
      now: NOW,
    });
    expect(input.allowAi).toBe(0);
  });

  it("carries an explicit Allow-AI ON (1) through coerceAllowAi", () => {
    const input = buildLogInteractionInput(
      { ...baseValue, allowAi: 1 },
      { contactId: 3, uid: "uid-1", now: NOW },
    );
    expect(input.allowAi).toBe(1);
  });

  it("assembles the full recordTouchpoint input from the controlled value + ids", () => {
    const input = buildLogInteractionInput(
      {
        occurredAt: "2026-09-10 18:15:00",
        channel: "In Person",
        direction: "mutual",
        connected: 1,
        quality: "Positive",
        note: "coffee",
        duration: 1800,
        allowAi: 0,
      },
      { contactId: 42, uid: "uid-99", now: NOW },
    );
    expect(input).toEqual({
      contactId: 42,
      uid: "uid-99",
      occurredAt: "2026-09-10 18:15:00",
      now: NOW,
      channel: "In Person",
      direction: "mutual",
      connected: 1,
      quality: "Positive",
      note: "coffee",
      duration: 1800,
      allowAi: 0,
      source: "manual",
    });
  });
});

describe("log-interaction-logic — ordinary-log channel options + Allow-AI seam", () => {
  it("ORDINARY_LOG_CHANNEL_OPTIONS is exactly Message/Call/In Person in order", () => {
    expect(ORDINARY_LOG_CHANNEL_OPTIONS).toHaveLength(3);
    expect(ORDINARY_LOG_CHANNEL_OPTIONS.map((o) => o.value)).toEqual([
      "Message",
      "Call",
      "In Person",
    ]);
  });

  it("ORDINARY_LOG_CHANNEL_OPTIONS contains no legacy other/unspecified", () => {
    const values = ORDINARY_LOG_CHANNEL_OPTIONS.map((o) => o.value);
    expect(values).not.toContain("other");
    expect(values).not.toContain("unspecified");
  });

  it("resolveInitialAllowAi is the OFF (0) Phase-36 type-default seam", () => {
    expect(resolveInitialAllowAi()).toBe(0);
  });
});
