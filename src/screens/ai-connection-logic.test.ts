import { describe, expect, it, vi } from "vitest";
import type { AiAvailabilityInput } from "@/logic/ai-availability";
import {
  beginConnectionSetup,
  CustomCredentialCompensationError,
  connectionCardState,
  finishConnectionSetup,
  removeLaneCredential,
  repairForAvailability,
  saveCustomConnection,
  saveDirectCredential,
} from "@/screens/ai-connection-logic";
import {
  createAiKeyStore,
  keyItemName,
  type SecureKeyBackend,
} from "@/services/ai-key-store";

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
    expect(connectionCardState("google", "anthropic", "").saved).toBe(false);
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
    const readRawCustomItem = vi.fn(async () => null);
    const restoreRawCustomItem = vi.fn(async () => undefined);
    const persistConnection = vi.fn(async () => undefined);
    const invalid = await saveCustomConnection(
      { setKey, readRawCustomItem, restoreRawCustomItem, persistConnection },
      {
        endpoint: "http://127.0.0.1/v1",
        previousEndpoint: "",
        credential: "secret",
        model: "local",
      },
    );
    expect(invalid.ok).toBe(false);
    expect(setKey).not.toHaveBeenCalled();
    expect(persistConnection).not.toHaveBeenCalled();

    const valid = await saveCustomConnection(
      { setKey, readRawCustomItem, restoreRawCustomItem, persistConnection },
      {
        endpoint: "https://api.example.com/v1",
        previousEndpoint: "",
        credential: "secret",
        model: "hosted-model",
      },
    );
    expect(valid).toEqual({ ok: true });
    expect(setKey).toHaveBeenCalledWith(
      "custom",
      "secret",
      "https://api.example.com/v1",
    );
    expect(persistConnection).toHaveBeenCalledWith({
      endpoint: "https://api.example.com/v1",
      model: "hosted-model",
    });
  });

  it.each([
    ["unbound", "SYNTHETIC-UNBOUND-KEY-DO-NOT-USE"],
    [
      "bound",
      JSON.stringify({
        version: 1,
        endpoint: "https://old.example.com/v1",
        credential: "SYNTHETIC-BOUND-KEY-DO-NOT-USE",
      }),
    ],
    ["absent", null],
  ])(
    "restores the %s raw Custom item after a failed save",
    async (_state, raw) => {
      const items = new Map<string, string>();
      if (raw !== null) items.set(keyItemName("custom"), raw);
      const backend: SecureKeyBackend = {
        getItemAsync: vi.fn(async (name) => items.get(name) ?? null),
        setItemAsync: vi.fn(async (name, value) => {
          items.set(name, value);
        }),
        deleteItemAsync: vi.fn(async (name) => {
          items.delete(name);
        }),
      };
      const store = createAiKeyStore(backend);
      await expect(
        saveCustomConnection(
          {
            ...store,
            persistConnection: vi.fn(async () => {
              throw new Error("sqlite failed");
            }),
          },
          {
            endpoint: "https://new.example.com/v1",
            previousEndpoint: "https://old.example.com/v1",
            credential: "SYNTHETIC-NEW-KEY-DO-NOT-USE",
            model: "new-model",
          },
        ),
      ).rejects.toThrow("sqlite failed");
      expect(items.get(keyItemName("custom")) ?? null).toBe(raw);
      expect(backend.deleteItemAsync).toHaveBeenCalledTimes(
        raw === null ? 1 : 0,
      );
    },
  );

  it("aborts before writing if raw snapshot read fails", async () => {
    const setKey = vi.fn(async () => undefined);
    await expect(
      saveCustomConnection(
        {
          setKey,
          readRawCustomItem: vi.fn(async () => {
            throw new Error("read failed");
          }),
          restoreRawCustomItem: vi.fn(async () => undefined),
          persistConnection: vi.fn(async () => undefined),
        },
        {
          endpoint: "https://new.example.com/v1",
          previousEndpoint: "",
          credential: "SYNTHETIC-NEW-KEY-DO-NOT-USE",
          model: "model",
        },
      ),
    ).rejects.toThrow("read failed");
    expect(setKey).not.toHaveBeenCalled();
  });

  it("raises an explicit hard error if raw restoration fails", async () => {
    await expect(
      saveCustomConnection(
        {
          setKey: vi.fn(async () => undefined),
          readRawCustomItem: vi.fn(async () => "SYNTHETIC-OLD-KEY-DO-NOT-USE"),
          restoreRawCustomItem: vi.fn(async () => {
            throw new Error("restore failed");
          }),
          persistConnection: vi.fn(async () => {
            throw new Error("sqlite failed");
          }),
        },
        {
          endpoint: "https://new.example.com/v1",
          previousEndpoint: "",
          credential: "SYNTHETIC-NEW-KEY-DO-NOT-USE",
          model: "model",
        },
      ),
    ).rejects.toBeInstanceOf(CustomCredentialCompensationError);
  });

  it("saves a blank credential without touching SecureStore", async () => {
    const setKey = vi.fn(async () => undefined);
    const readRawCustomItem = vi.fn(async () => null);
    await saveCustomConnection(
      {
        setKey,
        readRawCustomItem,
        restoreRawCustomItem: vi.fn(async () => undefined),
        persistConnection: vi.fn(async () => undefined),
      },
      {
        endpoint: "https://new.example.com/v1",
        previousEndpoint: "",
        credential: "",
        model: "model",
      },
    );
    expect(setKey).not.toHaveBeenCalled();
    expect(readRawCustomItem).not.toHaveBeenCalled();
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
