/**
 * ai-availability — proof of the provisional three-state adapter (Phase 35-04,
 * COMP-09 / D-07 / D-12).
 */
import { describe, expect, it } from "vitest";
import { computeAiAvailability } from "@/logic/ai-availability";

describe("computeAiAvailability — three-state derivation (D-12)", () => {
  it("provider 'none' → 'off' (regardless of credential)", () => {
    expect(
      computeAiAvailability({ provider: "none", hasCredential: false }),
    ).toBe("off");
    expect(
      computeAiAvailability({ provider: "none", hasCredential: true }),
    ).toBe("off");
  });

  it("provider set + credential present → 'ready'", () => {
    expect(
      computeAiAvailability({ provider: "openai", hasCredential: true }),
    ).toBe("ready");
  });

  it("provider set + credential missing/invalid → 'needs-attention'", () => {
    expect(
      computeAiAvailability({ provider: "anthropic", hasCredential: false }),
    ).toBe("needs-attention");
  });
});
