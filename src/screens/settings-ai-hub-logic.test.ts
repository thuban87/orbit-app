import { describe, expect, it, vi } from "vitest";
import {
  OPENROUTER_MODELS_URL,
  type OpenRouterCatalog,
} from "@/ai/openrouter-catalog";
import type { ResolvedAiConnection } from "@/db/ai-connections-dao";
import type { SqlExecutor } from "@/db/types";
import {
  type AiHubAvailabilityDeps,
  type AiHubSnapshot,
  aiHubRowDisplay,
  buildAiEnabledPatch,
  computeAiHubAvailability,
  deriveAiHubState,
  loadAiHubSnapshot,
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

  it("exposes five routed sections with one Style and Context row when on (38.12 D-126)", () => {
    const state = deriveAiHubState(true, "ready");

    expect(state.showSimplified).toBe(false);
    expect(state.escapeHatch).toBe(false);
    expect(state.sections).toHaveLength(5);
    // Style and Context opens the personalization page at the top: no
    // section target (D-126, owner Q-27).
    expect(state.sections).toEqual([
      { label: "Connection", route: "AIConnection" },
      { label: "Model", route: "AIModelPicker" },
      { label: "Style and Context", route: "AIPersonalization" },
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

  it.each([true, false])(
    "reports authenticated=%s Custom ready when its model and endpoint are valid",
    (hasCredential) => {
      expect(
        computeAiHubAvailability({
          aiEnabled: true,
          activeConnection: {
            lane: "custom",
            model: "local-model",
            customEndpoint: "https://ai.example.com/v1",
          },
          hasCredential,
          openRouterModels: [],
        }),
      ).toBe("ready");
    },
  );

  it("rejects invalid restored Custom endpoint metadata even when a credential exists", () => {
    expect(
      computeAiHubAvailability({
        aiEnabled: true,
        activeConnection: {
          lane: "custom",
          model: "local-model",
          customEndpoint: "http://old.example.com/v1",
        },
        hasCredential: true,
        openRouterModels: [],
      }),
    ).toBe("needs-attention");
  });
});

/**
 * The migrated availability HYDRATION pipeline (review cycle-2 MEDIUM #1). The AI
 * screen must PRODUCE the availability it derives from, not consume an
 * unpopulated default. These tests inject mocked collaborators (no real AI
 * provider network call — the catalog thunk is a local read) and prove
 * `loadAiHubAvailability` returns a populated (non-"off") availability for a
 * populated snapshot, needs-attention for a missing credential, and REJECTS when
 * a collaborator throws so the screen can hit its `setAiHubError` focus-load path.
 */
describe("loadAiHubSnapshot — migrated fresh-on-focus pipeline", () => {
  const exec = {} as SqlExecutor;

  const openRouterConnection: ResolvedAiConnection = {
    lane: "openrouter",
    model: "vendor/model",
    customEndpoint: "",
  };
  const catalog: OpenRouterCatalog = {
    source: OPENROUTER_MODELS_URL,
    updatedLocalDate: "2026-09-14",
    models: [
      {
        id: "vendor/model",
        name: "Model",
        contextLength: 128_000,
        pricing: {},
      },
    ],
  };

  function deps(
    overrides: Partial<AiHubAvailabilityDeps> = {},
  ): AiHubAvailabilityDeps {
    return {
      hydrateAiConfig: vi.fn(async () => {}),
      getAiConfig: vi.fn(() => ({ aiEnabled: true })),
      resolveActiveAiConnection: vi.fn(async () => openRouterConnection),
      readCredentialPresence: vi.fn(async () => true),
      loadCachedOpenRouterCatalog: vi.fn(async () => catalog),
      getKey: vi.fn(async () => "sk-test"),
      ...overrides,
    };
  }

  it("derives a populated (ready) availability from a complete snapshot, feeding populated hub sections", async () => {
    const d = deps();
    const { availability } = await loadAiHubSnapshot(exec, d);

    expect(availability).toBe("ready");
    // The screen derives its hub state from THIS populated availability.
    expect(deriveAiHubState(true, availability).sections).toHaveLength(5);
    expect(deriveAiHubState(true, availability).showSimplified).toBe(false);
    // Read-path only: config was hydrated and the LOCAL catalog was read.
    expect(d.hydrateAiConfig).toHaveBeenCalledWith(exec);
    expect(d.loadCachedOpenRouterCatalog).toHaveBeenCalledTimes(1);
  });

  it("returns needs-attention (not off) when the credential is missing", async () => {
    const { availability } = await loadAiHubSnapshot(
      exec,
      deps({ readCredentialPresence: vi.fn(async () => false) }),
    );

    expect(availability).toBe("needs-attention");
    expect(deriveAiHubState(true, availability).status).toBe("needs-attention");
  });

  it("skips the catalog read entirely for a non-openrouter lane", async () => {
    const loadCatalog = vi.fn(async () => catalog);
    const { availability } = await loadAiHubSnapshot(
      exec,
      deps({
        resolveActiveAiConnection: vi.fn(
          async (): Promise<ResolvedAiConnection> => ({
            lane: "custom",
            model: "local-model",
            customEndpoint: "https://ai.example.com/v1",
          }),
        ),
        loadCachedOpenRouterCatalog: loadCatalog,
      }),
    );

    expect(loadCatalog).not.toHaveBeenCalled();
    expect(availability).toBe("ready");
  });

  it("propagates a collaborator failure so the caller can surface its error path", async () => {
    await expect(
      loadAiHubSnapshot(
        exec,
        deps({
          resolveActiveAiConnection: vi.fn(async () => {
            throw new Error("db unavailable");
          }),
        }),
      ),
    ).rejects.toThrow("db unavailable");
  });
});

/**
 * 38.12 D-85: the hub rows show current values — provider and model, and
 * readiness — from the snapshot the hub already loads (the active connection
 * and the LOCAL OpenRouter catalog cache). No new read path, no network.
 */
describe("AI hub row values (38.12 D-85)", () => {
  const exec = {} as SqlExecutor;
  const catalog: OpenRouterCatalog = {
    source: OPENROUTER_MODELS_URL,
    updatedLocalDate: "2026-10-17",
    models: [
      {
        id: "vendor/model",
        name: "Vendor Model",
        contextLength: 128_000,
        pricing: {},
      },
    ],
  };
  function deps(
    overrides: Partial<AiHubAvailabilityDeps> = {},
  ): AiHubAvailabilityDeps {
    return {
      hydrateAiConfig: vi.fn(async () => {}),
      getAiConfig: vi.fn(() => ({ aiEnabled: true })),
      resolveActiveAiConnection: vi.fn(
        async (): Promise<ResolvedAiConnection> => ({
          lane: "openrouter",
          model: "vendor/model",
          customEndpoint: "",
        }),
      ),
      readCredentialPresence: vi.fn(async () => true),
      loadCachedOpenRouterCatalog: vi.fn(async () => catalog),
      getKey: vi.fn(async () => "SYNTHETIC-KEY-DO-NOT-USE"),
      ...overrides,
    };
  }
  const section = (label: string) => {
    const found = deriveAiHubState(true, "ready").sections.find(
      (candidate) => candidate.label === label,
    );
    if (!found) throw new Error(`no ${label} row`);
    return found;
  };

  it("the snapshot carries the active connection and the model's catalog name", async () => {
    const snapshot = await loadAiHubSnapshot(exec, deps());
    expect(snapshot).toEqual({
      availability: "ready",
      connection: {
        lane: "openrouter",
        model: "vendor/model",
        customEndpoint: "",
      },
      modelName: "Vendor Model",
    });
    // The snapshot never carries the key.
    expect(JSON.stringify(snapshot)).not.toContain("SYNTHETIC-KEY-DO-NOT-USE");
  });

  it("Connection reads 'OpenRouter · <model name>' with its readiness; Model reads the name", async () => {
    const snapshot = await loadAiHubSnapshot(exec, deps());
    expect(aiHubRowDisplay(section("Connection"), snapshot)).toEqual({
      value: "OpenRouter · Vendor Model",
      subtitle: "Ready",
    });
    expect(aiHubRowDisplay(section("Model"), snapshot)).toEqual({
      value: "Vendor Model",
      subtitle: null,
    });
  });

  it("a direct lane shows its model id, since no name is known", async () => {
    const snapshot = await loadAiHubSnapshot(
      exec,
      deps({
        resolveActiveAiConnection: vi.fn(
          async (): Promise<ResolvedAiConnection> => ({
            lane: "anthropic",
            model: "claude-model",
            customEndpoint: "",
          }),
        ),
      }),
    );
    expect(aiHubRowDisplay(section("Connection"), snapshot).value).toBe(
      "Anthropic · claude-model",
    );
  });

  it("a missing key reads Needs attention", async () => {
    const snapshot = await loadAiHubSnapshot(
      exec,
      deps({ readCredentialPresence: vi.fn(async () => false) }),
    );
    expect(aiHubRowDisplay(section("Connection"), snapshot).subtitle).toBe(
      "Needs attention",
    );
  });

  it("no active connection reads Not set on Connection and Model", () => {
    const snapshot: AiHubSnapshot = {
      availability: "needs-attention",
      connection: null,
      modelName: null,
    };
    expect(aiHubRowDisplay(section("Connection"), snapshot)).toEqual({
      value: "Not set",
      subtitle: "Needs attention",
    });
    expect(aiHubRowDisplay(section("Model"), snapshot).value).toBe("Not set");
  });

  it("rows show no value before the snapshot has loaded, and other rows carry none", async () => {
    expect(aiHubRowDisplay(section("Connection"), null)).toEqual({
      value: null,
      subtitle: null,
    });
    const snapshot = await loadAiHubSnapshot(exec, deps());
    for (const label of [
      "Style and Context",
      "AI Data Permissions",
      "Preview What Orbit Sends",
    ]) {
      expect(aiHubRowDisplay(section(label), snapshot), label).toEqual({
        value: null,
        subtitle: null,
      });
    }
  });
});
