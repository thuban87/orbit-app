/**
 * Provider-scoped API-key repository — the ONLY app-level storage boundary for
 * AI provider credentials (Phase 14, AI-01 / T-14-02).
 *
 * Provider API keys live EXCLUSIVELY in the device-backed Expo SecureStore,
 * NEVER in SQLite, `app_settings`, an exportable type, or a navigation param.
 * This repository is intentionally NARROW: it maps ONE cloud provider to ONE
 * namespaced SecureStore item (`orbit.ai.key.<provider>`) and exposes only
 * get/set/delete for that single provider at a time. There is deliberately NO
 * "get all keys" surface and no path that serializes a key back into settings —
 * so a bulk export or a mis-wired settings patch cannot leak credentials.
 *
 * The native module is injected (`SecureKeyBackend`) so the repository is fully
 * unit-testable node-side with a fake backend; the production default lazily
 * `import()`s `expo-secure-store` only when a method is actually called, keeping
 * the native module out of the node/vitest module graph entirely.
 *
 * `requireAuthentication` is NOT set: a biometric/keyguard gate on every
 * generation would be hostile for a dormant, opt-in convenience feature, and the
 * key is already at-rest-encrypted by the OS keystore. A missing key (SecureStore
 * clears on Android uninstall) is an ORDINARY reconfiguration state, surfaced as
 * `null`, never an error.
 */
import type { AiCloudProviderId } from "@/services/ai-types";

/** The namespaced SecureStore item prefix; one item per cloud provider. */
const KEY_ITEM_PREFIX = "orbit.ai.key.";

/** The SecureStore item name for a provider — provider-scoped by construction. */
export function keyItemName(provider: AiCloudProviderId): string {
  return `${KEY_ITEM_PREFIX}${provider}`;
}

/**
 * The minimal SecureStore surface this repository depends on — a subset of
 * `expo-secure-store` so a fake backend can implement it in tests without
 * pulling the native module into the graph.
 */
export interface SecureKeyBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** The provider-scoped repository surface. No bulk/all-keys accessor exists. */
export interface AiKeyStore {
  /** Read one provider's key, or `null` if unset/cleared (not an error). */
  getKey(provider: AiCloudProviderId): Promise<string | null>;
  /** Store one provider's key in its own namespaced SecureStore item. */
  setKey(provider: AiCloudProviderId, key: string): Promise<void>;
  /** Remove one provider's key. Idempotent — deleting a missing key is fine. */
  deleteKey(provider: AiCloudProviderId): Promise<void>;
}

/**
 * The production backend. It dynamically imports `expo-secure-store` ON EACH
 * CALL (never at module load) so node-side tests — which inject a fake backend —
 * never trigger the native module's resolution. On device the dynamic import
 * resolves the already-registered module cheaply (module cache).
 */
const nativeSecureStoreBackend: SecureKeyBackend = {
  async getItemAsync(key: string): Promise<string | null> {
    const secureStore = await import("expo-secure-store");
    return secureStore.getItemAsync(key);
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    const secureStore = await import("expo-secure-store");
    await secureStore.setItemAsync(key, value);
  },
  async deleteItemAsync(key: string): Promise<void> {
    const secureStore = await import("expo-secure-store");
    await secureStore.deleteItemAsync(key);
  },
};

/**
 * Build a provider-scoped key repository over the given backend (defaults to the
 * lazy `expo-secure-store` backend). Each method touches only the ONE item named
 * for its `provider` argument, so a key stored for one provider can never be
 * read through another provider's name.
 */
export function createAiKeyStore(
  backend: SecureKeyBackend = nativeSecureStoreBackend,
): AiKeyStore {
  return {
    async getKey(provider: AiCloudProviderId): Promise<string | null> {
      try {
        return await backend.getItemAsync(keyItemName(provider));
      } catch {
        // A read failure (item absent, keystore reset on uninstall) is an
        // ordinary "not configured" state — degrade to null, never throw.
        return null;
      }
    },
    async setKey(provider: AiCloudProviderId, key: string): Promise<void> {
      await backend.setItemAsync(keyItemName(provider), key);
    },
    async deleteKey(provider: AiCloudProviderId): Promise<void> {
      await backend.deleteItemAsync(keyItemName(provider));
    },
  };
}

/** The app-wide singleton over the native SecureStore backend. */
export const aiKeyStore: AiKeyStore = createAiKeyStore();
