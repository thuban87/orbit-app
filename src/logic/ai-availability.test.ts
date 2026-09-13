/**
 * ai-availability — proof of the provisional three-state adapter (Phase 35-04,
 * COMP-09 / D-07 / D-12).
 */
import { describe, expect, it } from "vitest";
import {
  type AiAvailability,
  computeAiAvailability,
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
