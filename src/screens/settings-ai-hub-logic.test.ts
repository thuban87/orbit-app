import { describe, expect, it } from "vitest";
import {
  buildAiEnabledPatch,
  computeAiHubAvailability,
  deriveAiHubState,
} from "./settings-ai-hub-logic";

describe("settings AI hub", () => {
  it("collapses AI off to preservation guidance without needs-attention", () => {
    const state = deriveAiHubState(false, "needs-attention");

    expect(state).toEqual({
      status: "off",
      showSimplified: true,
      escapeHatch: true,
      sections: [],
    });
  });

  it("exposes six distinct routed sections in the approved order when on", () => {
    const state = deriveAiHubState(true, "ready");

    expect(state.showSimplified).toBe(false);
    expect(state.escapeHatch).toBe(false);
    expect(state.sections).toHaveLength(6);
    expect(state.sections).toEqual([
      { label: "Connection", route: "AIConnection" },
      { label: "Model", route: "AIModelPicker" },
      {
        label: "Writing Style",
        route: "AIPersonalization",
        params: { focus: "writing-style" },
      },
      {
        label: "Personalization Context",
        route: "AIPersonalization",
        params: { focus: "personalization" },
      },
      { label: "AI Data Permissions", route: "AIPermissions" },
      { label: "Preview What Orbit Sends", route: "AIPreview" },
    ]);
  });

  it("keeps needs-attention separate from off while AI remains enabled", () => {
    expect(deriveAiHubState(true, "needs-attention").status).toBe(
      "needs-attention",
    );
  });

  it("builds an enabled-only durable patch and is idempotent by value", () => {
    expect(buildAiEnabledPatch(false)).toEqual({ aiEnabled: 0 });
    expect(buildAiEnabledPatch(true)).toEqual({ aiEnabled: 1 });
    expect(buildAiEnabledPatch(true)).toEqual(buildAiEnabledPatch(true));
    expect(Object.keys(buildAiEnabledPatch(false))).toEqual(["aiEnabled"]);
  });

  it("reports needs-attention for dangling pointers, missing credentials, and unavailable exact models", () => {
    const connection = {
      lane: "openrouter" as const,
      model: "vendor/model",
      customEndpoint: "",
    };
    const catalogModel = {
      id: "vendor/model",
      name: "Model",
      contextLength: 128_000,
      pricing: {},
    };

    expect(
      computeAiHubAvailability({
        aiEnabled: true,
        activeConnection: null,
        hasCredential: true,
        openRouterModels: [catalogModel],
      }),
    ).toBe("needs-attention");
    expect(
      computeAiHubAvailability({
        aiEnabled: true,
        activeConnection: connection,
        hasCredential: false,
        openRouterModels: [catalogModel],
      }),
    ).toBe("needs-attention");
    expect(
      computeAiHubAvailability({
        aiEnabled: true,
        activeConnection: connection,
        hasCredential: true,
        openRouterModels: [],
      }),
    ).toBe("needs-attention");
    expect(
      computeAiHubAvailability({
        aiEnabled: true,
        activeConnection: connection,
        hasCredential: true,
        openRouterModels: [catalogModel],
      }),
    ).toBe("ready");
  });
});
