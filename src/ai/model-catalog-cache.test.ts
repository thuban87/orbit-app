/**
 * Model catalog cache + user-instigated refresh — node-tested off-device (14-10).
 *
 * The refresh is a PLAIN public-file GET (NOT the Custom `orbit-secure-fetch`
 * transport): it sends NO key and NO user/contact data, only a bare URL fetch. It
 * fires ONLY when the user taps "Refresh models" — never on a read path. These
 * tests inject a fake `fetch` and an in-memory storage so NO real network is
 * touched, and they prove:
 *   - a successful refresh filters the LiteLLM JSON and WRITES the on-device cache;
 *   - the refresh request carries no headers/body/key (public GET only);
 *   - a network error, a non-2xx, or a shape-broken (all-empty) response THROWS and
 *     leaves the prior cache untouched (the caller degrades to the seed);
 *   - `loadCachedCatalog` returns the parsed cache, or null for
 *     absent/corrupt/wrong-shape (the offline fallback → seed happens in the
 *     registry's `resolveActiveCatalog`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CatalogStorage,
  loadCachedCatalog,
  refreshModelCatalog,
} from "@/ai/model-catalog-cache";
import { LITELLM_MODELS_URL } from "@/ai/model-catalog-filter";

/** An in-memory CatalogStorage the tests inspect directly. */
function memStorage(initial: string | null = null): CatalogStorage & {
  value: string | null;
} {
  return {
    value: initial,
    async read() {
      return this.value;
    },
    async write(data: string) {
      this.value = data;
    },
  };
}

const RAW_OK = {
  "gpt-5.4-mini": { mode: "chat", litellm_provider: "openai" },
  "claude-sonnet-5": { mode: "chat", litellm_provider: "anthropic" },
  "gemini/gemini-3.5-flash": { mode: "chat", litellm_provider: "gemini" },
};

function okFetch(payload: unknown) {
  return vi.fn(async (_url: string, _init?: { signal?: AbortSignal }) => ({
    ok: true,
    status: 200,
    json: async () => payload,
  }));
}

describe("refreshModelCatalog — user-instigated public GET, writes cache", () => {
  let storage: ReturnType<typeof memStorage>;
  beforeEach(() => {
    storage = memStorage();
  });

  it("fetches the LiteLLM url, filters, and writes the cache", async () => {
    const fetchImpl = okFetch(RAW_OK);
    const cat = await refreshModelCatalog({ fetchImpl, storage });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(LITELLM_MODELS_URL);
    expect(cat.models.openai).toEqual(["gpt-5.4-mini"]);
    expect(cat.models.anthropic).toEqual(["claude-sonnet-5"]);
    expect(cat.models.google).toEqual(["gemini-3.5-flash"]);
    // The cache was persisted and round-trips.
    expect(storage.value).not.toBeNull();
    expect(JSON.parse(storage.value as string).models.openai).toEqual([
      "gpt-5.4-mini",
    ]);
  });

  it("sends NO key/headers/body — a bare public GET (local-first privacy)", async () => {
    const fetchImpl = okFetch(RAW_OK);
    await refreshModelCatalog({ fetchImpl, storage });
    const init = fetchImpl.mock.calls[0][1];
    // Either no init at all, or an init that carries no headers/body/method.
    if (init) {
      expect(init).not.toHaveProperty("headers");
      expect(init).not.toHaveProperty("body");
      expect(init).not.toHaveProperty("method");
    }
  });

  it("THROWS on a non-2xx response and does NOT overwrite the cache", async () => {
    storage = memStorage("PRIOR");
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    await expect(refreshModelCatalog({ fetchImpl, storage })).rejects.toThrow();
    expect(storage.value).toBe("PRIOR");
  });

  it("THROWS on a network/fetch rejection and does NOT overwrite the cache", async () => {
    storage = memStorage("PRIOR");
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(refreshModelCatalog({ fetchImpl, storage })).rejects.toThrow();
    expect(storage.value).toBe("PRIOR");
  });

  it("THROWS on a shape-broken (all-empty) response, leaving the cache intact", async () => {
    storage = memStorage("PRIOR");
    // A response whose entries all fail the filter → empty catalog → reject.
    const fetchImpl = okFetch({
      "x-embed": { mode: "embedding", litellm_provider: "openai" },
    });
    await expect(refreshModelCatalog({ fetchImpl, storage })).rejects.toThrow();
    expect(storage.value).toBe("PRIOR");
  });
});

describe("loadCachedCatalog — parsed cache or null (offline fallback → seed)", () => {
  it("returns the parsed catalog when the cache is a valid snapshot", async () => {
    const good = await refreshModelCatalog({
      fetchImpl: okFetch(RAW_OK),
      storage: memStorage(),
    });
    const loaded = await loadCachedCatalog(memStorage(JSON.stringify(good)));
    expect(loaded?.models.openai).toEqual(["gpt-5.4-mini"]);
  });

  it("returns null when there is no cache yet (first run)", async () => {
    expect(await loadCachedCatalog(memStorage(null))).toBeNull();
  });

  it("returns null on corrupt JSON (never throws)", async () => {
    expect(await loadCachedCatalog(memStorage("{not json"))).toBeNull();
  });

  it("returns null on a wrong-shape object (missing provider arrays)", async () => {
    expect(
      await loadCachedCatalog(memStorage(JSON.stringify({ models: {} }))),
    ).toBeNull();
  });
});
