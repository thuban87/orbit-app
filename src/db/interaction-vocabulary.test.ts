/**
 * The single canonical legacy->new vocabulary map (D-06) — pins every mapping and
 * every pass-through so no divergent second map can drift from it.
 */
import { describe, expect, it } from "vitest";
import {
  LEGACY_CHANNEL_REMAP,
  LEGACY_QUALITY_REMAP,
  remapLegacyChannel,
  remapLegacyQuality,
} from "@/db/interaction-vocabulary";

describe("interaction vocabulary — quality remap", () => {
  it("maps every legacy quality value to its Tone value", () => {
    expect(remapLegacyQuality("good")).toBe("Positive");
    expect(remapLegacyQuality("fine")).toBe("Neutral");
    expect(remapLegacyQuality("hard")).toBe("Negative");
  });

  it("passes through NULL/undefined and non-legacy values unchanged", () => {
    expect(remapLegacyQuality(null)).toBeNull();
    expect(remapLegacyQuality(undefined)).toBeUndefined();
    // Already-migrated values pass through.
    expect(remapLegacyQuality("Positive")).toBe("Positive");
    expect(remapLegacyQuality("Neutral")).toBe("Neutral");
    expect(remapLegacyQuality("Negative")).toBe("Negative");
    // Any unknown value passes through — never coerced.
    expect(remapLegacyQuality("whatever")).toBe("whatever");
  });

  it("freezes the quality map", () => {
    expect(Object.isFrozen(LEGACY_QUALITY_REMAP)).toBe(true);
    expect(LEGACY_QUALITY_REMAP).toEqual({
      good: "Positive",
      fine: "Neutral",
      hard: "Negative",
    });
  });
});

describe("interaction vocabulary — channel remap", () => {
  it("maps every legacy channel value to its user-facing label", () => {
    expect(remapLegacyChannel("text")).toBe("Message");
    expect(remapLegacyChannel("email")).toBe("Message");
    expect(remapLegacyChannel("call")).toBe("Call");
    expect(remapLegacyChannel("in-person")).toBe("In Person");
  });

  it("passes through other/unspecified, NULL/undefined, and already-migrated labels", () => {
    expect(remapLegacyChannel("other")).toBe("other");
    expect(remapLegacyChannel("unspecified")).toBe("unspecified");
    expect(remapLegacyChannel(null)).toBeNull();
    expect(remapLegacyChannel(undefined)).toBeUndefined();
    expect(remapLegacyChannel("Message")).toBe("Message");
    expect(remapLegacyChannel("Call")).toBe("Call");
    expect(remapLegacyChannel("In Person")).toBe("In Person");
  });

  it("freezes the channel map", () => {
    expect(Object.isFrozen(LEGACY_CHANNEL_REMAP)).toBe(true);
    expect(LEGACY_CHANNEL_REMAP).toEqual({
      text: "Message",
      email: "Message",
      call: "Call",
      "in-person": "In Person",
    });
  });
});
