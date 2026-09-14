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

import { validateCustomEndpoint } from "@/ai/custom-endpoint";
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
  getKey(
    provider: AiCloudProviderId,
    customEndpoint?: string,
  ): Promise<string | null>;
  /** Store one provider's key in its own namespaced SecureStore item. */
  setKey(
    provider: AiCloudProviderId,
    key: string,
    customEndpoint?: string,
  ): Promise<void>;
  /** Remove one provider's key. Idempotent — deleting a missing key is fine. */
  deleteKey(provider: AiCloudProviderId): Promise<void>;
}

interface BoundCustomCredential {
  readonly version: 1;
  readonly endpoint: string;
  readonly credential: string;
}

function normalizeCustomEndpoint(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const validation = validateCustomEndpoint(raw);
  if (!validation.ok || validation.url === "") return null;
  return new URL(validation.url).href;
}

function parseBoundCustomCredential(raw: string): BoundCustomCredential | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      parsed.version === 1 &&
      "endpoint" in parsed &&
      typeof parsed.endpoint === "string" &&
      "credential" in parsed &&
      typeof parsed.credential === "string"
    ) {
      return parsed as BoundCustomCredential;
    }
  } catch {
    // A pre-Phase-36 plaintext value is a legacy credential, handled below.
  }
  return null;
}

function encodeBoundCustomCredential(
  endpoint: string,
  credential: string,
): string {
  return JSON.stringify({ version: 1, endpoint, credential });
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
    async getKey(
      provider: AiCloudProviderId,
      customEndpoint?: string,
    ): Promise<string | null> {
      try {
        const stored = await backend.getItemAsync(keyItemName(provider));
        if (provider !== "custom" || stored === null) return stored;

        const endpoint = normalizeCustomEndpoint(customEndpoint);
        if (endpoint === null) return null;
        const bound = parseBoundCustomCredential(stored);
        if (bound !== null) {
          return bound.endpoint === endpoint ? bound.credential : null;
        }

        // Legacy Custom keys predate endpoint binding. Bind the plaintext key
        // to the currently persisted, already-validated endpoint on first read.
        // If the durable upgrade fails, fail closed instead of returning an
        // unbound secret that could later be paired with a different endpoint.
        await backend.setItemAsync(
          keyItemName(provider),
          encodeBoundCustomCredential(endpoint, stored),
        );
        return stored;
      } catch {
        // A read failure (item absent, keystore reset on uninstall) is an
        // ordinary "not configured" state — degrade to null, never throw.
        return null;
      }
    },
    async setKey(
      provider: AiCloudProviderId,
      key: string,
      customEndpoint?: string,
    ): Promise<void> {
      if (provider !== "custom") {
        await backend.setItemAsync(keyItemName(provider), key);
        return;
      }
      const endpoint = normalizeCustomEndpoint(customEndpoint);
      if (endpoint === null) {
        throw new Error(
          "A valid Custom endpoint is required to store a credential.",
        );
      }
      await backend.setItemAsync(
        keyItemName(provider),
        encodeBoundCustomCredential(endpoint, key),
      );
    },
    async deleteKey(provider: AiCloudProviderId): Promise<void> {
      await backend.deleteItemAsync(keyItemName(provider));
    },
  };
}

/** The app-wide singleton over the native SecureStore backend. */
export const aiKeyStore: AiKeyStore = createAiKeyStore();
