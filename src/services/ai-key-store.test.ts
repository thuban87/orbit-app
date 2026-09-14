/**
 * ai-key-store — provider isolation + missing-key tolerance (T-14-02).
 *
 * Proven node-side with a FAKE in-memory SecureStore backend (a Map) injected
 * into `createAiKeyStore`, so the native module is never touched. The two
 * security-relevant properties:
 *   - a key stored for one provider is unreadable through any OTHER provider's
 *     name (per-provider namespaced items — no cross-provider leak);
 *   - a missing key is surfaced as `null` (ordinary reconfiguration), and a
 *     backend read failure degrades to `null` rather than throwing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAiKeyStore,
  keyItemName,
  type SecureKeyBackend,
} from "@/services/ai-key-store";

/** An in-memory SecureStore stand-in — records the exact item names written. */
function fakeBackend(): SecureKeyBackend & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async getItemAsync(key: string): Promise<string | null> {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async setItemAsync(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async deleteItemAsync(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

let backend: ReturnType<typeof fakeBackend>;

beforeEach(() => {
  backend = fakeBackend();
});

describe("ai-key-store — provider isolation", () => {
  it("stores each provider under its own namespaced item name", async () => {
    const store = createAiKeyStore(backend);
    await store.setKey("openai", "sk-openai");
    expect(backend.store.has(keyItemName("openai"))).toBe(true);
    expect(backend.store.get("orbit.ai.key.openai")).toBe("sk-openai");
  });

  it("a key set for openai is UNREADABLE as anthropic", async () => {
    const store = createAiKeyStore(backend);
    await store.setKey("openai", "sk-openai");
    expect(await store.getKey("anthropic")).toBeNull();
    expect(await store.getKey("openai")).toBe("sk-openai");
  });

  it("keeps four distinct provider keys separate", async () => {
    const store = createAiKeyStore(backend);
    await store.setKey("openai", "k-openai");
    await store.setKey("anthropic", "k-anthropic");
    await store.setKey("google", "k-google");
    await store.setKey("custom", "k-custom", "https://custom.example.com/v1");
    expect(await store.getKey("openai")).toBe("k-openai");
    expect(await store.getKey("anthropic")).toBe("k-anthropic");
    expect(await store.getKey("google")).toBe("k-google");
    expect(await store.getKey("custom", "https://custom.example.com/v1")).toBe(
      "k-custom",
    );
  });

  it("exposes no bulk/all-keys accessor on the repository surface", () => {
    const store = createAiKeyStore(backend);
    const keys = Object.keys(store);
    expect(keys.sort()).toEqual(["deleteKey", "getKey", "setKey"]);
  });

  it("returns a Custom credential only for its normalized bound endpoint", async () => {
    const store = createAiKeyStore(backend);
    await store.setKey(
      "custom",
      "bound-secret",
      " HTTPS://API.EXAMPLE.COM:443/v1 ",
    );

    await expect(
      store.getKey("custom", "https://api.example.com/v1"),
    ).resolves.toBe("bound-secret");
    await expect(
      store.getKey("custom", "https://other.example.com/v1"),
    ).resolves.toBeNull();
    await expect(store.getKey("custom")).resolves.toBeNull();
  });

  it("durably binds a legacy plaintext Custom key on first safe read", async () => {
    backend.store.set(keyItemName("custom"), "legacy-secret");
    const store = createAiKeyStore(backend);

    await expect(
      store.getKey("custom", "https://old.example.com/v1"),
    ).resolves.toBe("legacy-secret");
    expect(backend.store.get(keyItemName("custom"))).not.toBe("legacy-secret");
    await expect(
      store.getKey("custom", "https://new.example.com/v1"),
    ).resolves.toBeNull();
  });

  it("fails closed when a legacy key cannot be durably endpoint-bound", async () => {
    backend.store.set(keyItemName("custom"), "legacy-secret");
    backend.setItemAsync = vi.fn().mockRejectedValue(new Error("write failed"));
    const store = createAiKeyStore(backend);

    await expect(
      store.getKey("custom", "https://old.example.com/v1"),
    ).resolves.toBeNull();
  });
});

describe("ai-key-store — missing-key tolerance", () => {
  it("returns null for a provider that was never configured", async () => {
    const store = createAiKeyStore(backend);
    expect(await store.getKey("custom")).toBeNull();
  });

  it("returns null after a key is deleted (reconfiguration, not an error)", async () => {
    const store = createAiKeyStore(backend);
    await store.setKey("google", "k-google");
    await store.deleteKey("google");
    expect(await store.getKey("google")).toBeNull();
  });

  it("deleting a never-set key is a tolerated no-op", async () => {
    const store = createAiKeyStore(backend);
    await expect(store.deleteKey("openai")).resolves.toBeUndefined();
  });

  it("degrades a backend read failure to null instead of throwing", async () => {
    const flaky: SecureKeyBackend = {
      getItemAsync: vi
        .fn()
        .mockRejectedValue(new Error("keystore unavailable")),
      setItemAsync: vi.fn().mockResolvedValue(undefined),
      deleteItemAsync: vi.fn().mockResolvedValue(undefined),
    };
    const store = createAiKeyStore(flaky);
    expect(await store.getKey("openai")).toBeNull();
  });
});
