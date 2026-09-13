/**
 * ai-availability — proof of the provisional three-state adapter (Phase 35-04,
 * COMP-09 / D-07 / D-12).
 */
import { describe, expect, it, vi } from "vitest";
import {
  type AiAvailability,
  computeAiAvailability,
  isCredentialFailure,
  readCredentialPresence,
  selectAiAffordance,
} from "@/logic/ai-availability";

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

describe("selectAiAffordance — every-state usability (COMP-09 / D-07)", () => {
  const ALL: AiAvailability[] = ["off", "ready", "needs-attention"];

  it("keeps manual composition and Research usable in ALL three states", () => {
    for (const state of ALL) {
      const posture = selectAiAffordance(state);
      expect(posture.manualComposition).toBe(true);
      expect(posture.research).toBe(true);
    }
  });

  it("'off' exposes NO AI affordance (no actions, no repair notice)", () => {
    const posture = selectAiAffordance("off");
    expect(posture.showAiActions).toBe(false);
    expect(posture.repairNotice).toBe(false);
  });

  it("'ready' exposes the AI actions with no repair notice", () => {
    const posture = selectAiAffordance("ready");
    expect(posture.showAiActions).toBe(true);
    expect(posture.repairNotice).toBe(false);
  });

  it("'needs-attention' REPLACES AI actions with a repair notice (not hide, not restore)", () => {
    const posture = selectAiAffordance("needs-attention");
    // Repair notice shown → not silently hidden.
    expect(posture.repairNotice).toBe(true);
    // AI actions NOT restored (does not bring back Draft/Rewrite/Add-to-AI).
    expect(posture.showAiActions).toBe(false);
  });
});

describe("computeAiAvailability — missing-key vs credential-present (Task 4)", () => {
  it("provider set + credential missing → 'needs-attention'", () => {
    expect(
      computeAiAvailability({ provider: "openai", hasCredential: false }),
    ).toBe("needs-attention");
  });

  it("provider set + credential present → 'ready'", () => {
    expect(
      computeAiAvailability({ provider: "openai", hasCredential: true }),
    ).toBe("ready");
  });

  it("provider 'none' + no credential → 'off'", () => {
    expect(
      computeAiAvailability({ provider: "none", hasCredential: false }),
    ).toBe("off");
  });
});

describe("isCredentialFailure — observed-unauthorized lever (Task 4)", () => {
  it("'unauthorized' IS a credential failure", () => {
    expect(isCredentialFailure("unauthorized")).toBe(true);
  });

  it("transient codes are NOT credential failures (never demote a good key)", () => {
    expect(isCredentialFailure("timeout")).toBe(false);
    expect(isCredentialFailure("rate_limited")).toBe(false);
    expect(isCredentialFailure("network")).toBe(false);
    expect(isCredentialFailure("blocked")).toBe(false);
    expect(isCredentialFailure("invalid_endpoint")).toBe(false);
    expect(isCredentialFailure("cancelled")).toBe(false);
    expect(isCredentialFailure("not_configured")).toBe(false);
  });
});

describe("readCredentialPresence — presence-only sourcing, 'none' zero-read (A4)", () => {
  it("returns false for provider 'none' WITHOUT calling getKey (zero key-store reads)", async () => {
    const getKey = vi.fn(async () => "a-key");
    await expect(readCredentialPresence("none", getKey)).resolves.toBe(false);
    expect(getKey).toHaveBeenCalledTimes(0);
  });

  it("returns true for a cloud provider whose key is present (getKey called once)", async () => {
    const getKey = vi.fn(async () => "sk-live-xyz");
    await expect(readCredentialPresence("openai", getKey)).resolves.toBe(true);
    expect(getKey).toHaveBeenCalledTimes(1);
    expect(getKey).toHaveBeenCalledWith("openai");
  });

  it("returns false for a cloud provider whose key is absent (null)", async () => {
    const getKey = vi.fn(async () => null);
    await expect(readCredentialPresence("anthropic", getKey)).resolves.toBe(
      false,
    );
    expect(getKey).toHaveBeenCalledTimes(1);
  });
});
