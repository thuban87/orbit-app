import { describe, expect, it, vi } from "vitest";
import type { AiAvailabilityInput } from "@/logic/ai-availability";
import {
  beginConnectionSetup,
  connectionCardState,
  finishConnectionSetup,
  removeLaneCredential,
  repairForAvailability,
  saveCustomConnection,
  saveDirectCredential,
} from "@/screens/ai-connection-logic";

describe("AI connection switching", () => {
  const initial = {
    activeLane: "openai" as const,
    pendingLane: null,
    rememberedModels: { openai: "gpt-live" },
  };

  it("keeps the prior lane active until setup succeeds", () => {
    const pending = beginConnectionSetup(initial, "anthropic");
    expect(pending.activeLane).toBe("openai");
    expect(
      finishConnectionSetup(pending, "anthropic", false, "claude"),
    ).toEqual(initial);
    expect(
      finishConnectionSetup(pending, "anthropic", true, "claude"),
    ).toMatchObject({
      activeLane: "anthropic",
      pendingLane: null,
      rememberedModels: { openai: "gpt-live", anthropic: "claude" },
    });
  });

  it("marks configured inactive lanes Saved and restores remembered models", () => {
    expect(connectionCardState("openai", "anthropic", "gpt-live")).toEqual({
      active: false,
      saved: true,
      rememberedModel: "gpt-live",
    });
  });
});

describe("credential boundary and endpoint guard", () => {
  it("routes direct credentials only to the provider-scoped key store", async () => {
    const setKey = vi.fn(async () => undefined);
    await saveDirectCredential({ setKey }, "google", " secret ");
    expect(setKey).toHaveBeenCalledWith("google", "secret");
  });

  it("validates a custom URL before writing either config or credential", async () => {
    const setKey = vi.fn(async () => undefined);
    const persistConnection = vi.fn(async () => undefined);
    const invalid = await saveCustomConnection(
      { setKey, persistConnection },
      {
        endpoint: "http://127.0.0.1/v1",
        credential: "secret",
        model: "local",
      },
    );
    expect(invalid.ok).toBe(false);
    expect(setKey).not.toHaveBeenCalled();
    expect(persistConnection).not.toHaveBeenCalled();

    const valid = await saveCustomConnection(
      { setKey, persistConnection },
      {
        endpoint: "https://api.example.com/v1",
        credential: "secret",
        model: "hosted-model",
      },
    );
    expect(valid).toEqual({ ok: true });
    expect(setKey).toHaveBeenCalledWith("custom", "secret");
    expect(persistConnection).toHaveBeenCalledWith({
      endpoint: "https://api.example.com/v1",
      model: "hosted-model",
    });
  });

  it("removes only the requested lane credential", async () => {
    const deleteKey = vi.fn(async () => undefined);
    await removeLaneCredential({ deleteKey }, "anthropic");
    expect(deleteKey).toHaveBeenCalledTimes(1);
    expect(deleteKey).toHaveBeenCalledWith("anthropic");
  });
});

describe("Needs Attention repair mapping", () => {
  const ready: AiAvailabilityInput = {
    aiEnabled: true,
    activeConnection: "openrouter",
    hasCredential: true,
    selectedModel: "provider/model",
    modelAvailable: true,
  };

  it("maps each cause to an explicit repair without substitution", () => {
    expect(
      repairForAvailability({ ...ready, hasCredential: false }, "expired"),
    ).toMatchObject({ action: "reconnect", label: "Reconnect" });
    expect(
      repairForAvailability({ ...ready, hasCredential: false }, "invalid-key"),
    ).toMatchObject({ action: "replace-key", label: "Replace key" });
    expect(
      repairForAvailability({ ...ready, modelAvailable: false }, null),
    ).toMatchObject({ action: "choose-model", label: "Choose another model" });
    expect(
      repairForAvailability({ ...ready, activeConnection: null }, null),
    ).toMatchObject({
      action: "change-connection",
      label: "Change AI connection",
    });
    expect(repairForAvailability(ready, null)).toBeNull();
  });
});
