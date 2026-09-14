/**
 * ai-availability — proof of the provisional three-state adapter (Phase 35-04,
 * COMP-09 / D-07 / D-12).
 */
import { describe, expect, it, vi } from "vitest";
import {
  type AiAvailability,
  computeAiAvailability,
  isCredentialFailure,
  isSelectedConnectionModelAvailable,
  readCredentialPresence,
  selectAiAffordance,
} from "@/logic/ai-availability";

describe("isSelectedConnectionModelAvailable — exact OpenRouter model", () => {
  const model = {
    id: "vendor/model-a",
    name: "Model A",
    contextLength: 128_000,
    pricing: {},
  };

  it("accepts only the exact selected OpenRouter id present in the loaded catalog", () => {
    expect(
      isSelectedConnectionModelAvailable(
        { lane: "openrouter", model: model.id, customEndpoint: "" },
        [model],
      ),
    ).toBe(true);
    expect(
      isSelectedConnectionModelAvailable(
        { lane: "openrouter", model: "vendor/missing", customEndpoint: "" },
        [model],
      ),
    ).toBe(false);
  });

  it("preserves manual non-blank model ids for direct connections and validates Custom endpoints", () => {
    expect(
      isSelectedConnectionModelAvailable(
        { lane: "openai", model: "manual-model", customEndpoint: "" },
        [],
      ),
    ).toBe(true);
    expect(
      isSelectedConnectionModelAvailable(
        {
          lane: "custom",
          model: "manual-model",
          customEndpoint: "http://old.example.com/v1",
        },
        [],
      ),
    ).toBe(false);
    expect(
      isSelectedConnectionModelAvailable(
        { lane: "custom", model: "manual-model", customEndpoint: "" },
        [],
      ),
    ).toBe(false);
    expect(
      isSelectedConnectionModelAvailable(
        {
          lane: "custom",
          model: "manual-model",
          customEndpoint: "https://example.com",
        },
        [],
      ),
    ).toBe(true);
  });
});

describe("computeAiAvailability — three-state derivation (D-12)", () => {
  const readyInput = {
    aiEnabled: true,
    activeConnection: "openai" as const,
    hasCredential: true,
    selectedModel: "gpt-model",
    modelAvailable: true,
  };

  it("AI disabled → 'off' for every connection/model condition", () => {
    expect(computeAiAvailability({ ...readyInput, aiEnabled: false })).toBe(
      "off",
    );
    expect(
      computeAiAvailability({
        aiEnabled: false,
        activeConnection: null,
        hasCredential: false,
        selectedModel: "",
        modelAvailable: false,
      }),
    ).toBe("off");
  });

  it("AI enabled + connection + credential + available model → 'ready'", () => {
    expect(computeAiAvailability(readyInput)).toBe("ready");
  });

  it("missing connection or credential → 'needs-attention'", () => {
    expect(
      computeAiAvailability({ ...readyInput, activeConnection: null }),
    ).toBe("needs-attention");
    expect(computeAiAvailability({ ...readyInput, hasCredential: false })).toBe(
      "needs-attention",
    );
  });

  it("allows authenticated and unauthenticated Custom while direct providers still require credentials", () => {
    for (const hasCredential of [true, false]) {
      expect(
        computeAiAvailability({
          ...readyInput,
          activeConnection: "custom",
          hasCredential,
        }),
      ).toBe("ready");
    }
    expect(
      computeAiAvailability({ ...readyInput, hasCredential: false }),
    ).toBe("needs-attention");
  });

  it("missing or unavailable selected model → 'needs-attention' without substitution", () => {
    expect(computeAiAvailability({ ...readyInput, selectedModel: "" })).toBe(
      "needs-attention",
    );
    expect(
      computeAiAvailability({ ...readyInput, modelAvailable: false }),
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
      computeAiAvailability({
        aiEnabled: true,
        activeConnection: "openai",
        hasCredential: false,
        selectedModel: "gpt-model",
        modelAvailable: true,
      }),
    ).toBe("needs-attention");
  });

  it("provider set + credential present → 'ready'", () => {
    expect(
      computeAiAvailability({
        aiEnabled: true,
        activeConnection: "openai",
        hasCredential: true,
        selectedModel: "gpt-model",
        modelAvailable: true,
      }),
    ).toBe("ready");
  });

  it("master disabled + no connection → 'off'", () => {
    expect(
      computeAiAvailability({
        aiEnabled: false,
        activeConnection: null,
        hasCredential: false,
        selectedModel: "",
        modelAvailable: false,
      }),
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
