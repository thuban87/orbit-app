import { describe, expect, it, vi } from "vitest";
import {
  estimateOpenRouterInputCost,
  loadCachedOpenRouterCatalog,
  OPENROUTER_MODELS_URL,
  type OpenRouterCatalogStorage,
  refreshOpenRouterCatalog,
  refreshOpenRouterCatalogIfStale,
  shouldRefreshOpenRouterCatalog,
} from "@/ai/openrouter-catalog";

function memStorage(initial: string | null = null): OpenRouterCatalogStorage & {
  value: string | null;
} {
  return {
    value: initial,
    async read() {
      return this.value;
    },
    async write(value: string) {
      this.value = value;
    },
  };
}

const RAW_CATALOG = {
  data: [
    {
      id: "vendor/model-b",
      name: "Model B",
      context_length: 128_000,
      pricing: {
        prompt: "0.00000125",
        completion: "0.000005",
        image: "0.004",
        request: "0",
      },
    },
    {
      id: "vendor/model-a",
      name: "Model A",
      context_length: 32_000,
      pricing: { prompt: "0.0000005", completion: "0.000001" },
    },
    // Exact duplicate from the upstream payload must not create a second card.
    {
      id: "vendor/model-a",
      name: "Model A",
      context_length: 32_000,
      pricing: { prompt: "0.0000005", completion: "0.000001" },
    },
  ],
};

function okFetch(payload: unknown = RAW_CATALOG) {
  return vi.fn(async (_url: string, _init?: { signal?: AbortSignal }) => ({
    ok: true,
    status: 200,
    json: async () => payload,
  }));
}

describe("refreshOpenRouterCatalog", () => {
  it("fetches the public models endpoint without credentials and caches pricing", async () => {
    const fetchImpl = okFetch();
    const storage = memStorage();
    const catalog = await refreshOpenRouterCatalog({
      fetchImpl,
      storage,
      now: () => new Date(2026, 8, 14, 23, 30),
    });

    expect(fetchImpl).toHaveBeenCalledWith(OPENROUTER_MODELS_URL, undefined);
    expect(fetchImpl.mock.calls[0][1]).toBeUndefined();
    expect(catalog.updatedLocalDate).toBe("2026-09-14");
    expect(catalog.models).toHaveLength(2);
    expect(catalog.models[0]).toMatchObject({
      id: "vendor/model-b",
      contextLength: 128_000,
      pricing: { prompt: "0.00000125", completion: "0.000005" },
    });
    expect(JSON.parse(storage.value as string)).toEqual(catalog);
  });

  it.each([
    [
      "non-2xx",
      async () => ({ ok: false, status: 503, json: async () => ({}) }),
    ],
    [
      "malformed",
      async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }),
    ],
  ])("throws on %s and preserves the prior cache", async (_case, fetchImpl) => {
    const storage = memStorage("PRIOR");
    await expect(
      refreshOpenRouterCatalog({ fetchImpl, storage }),
    ).rejects.toThrow();
    expect(storage.value).toBe("PRIOR");
  });
});

describe("loadCachedOpenRouterCatalog", () => {
  it("returns null for absent, corrupt, wrong-shape, or failed storage reads", async () => {
    expect(await loadCachedOpenRouterCatalog(memStorage())).toBeNull();
    expect(
      await loadCachedOpenRouterCatalog(memStorage("not-json")),
    ).toBeNull();
    expect(
      await loadCachedOpenRouterCatalog(
        memStorage(JSON.stringify({ models: {} })),
      ),
    ).toBeNull();
    expect(
      await loadCachedOpenRouterCatalog({
        read: async () => {
          throw new Error("unavailable");
        },
        write: async () => undefined,
      }),
    ).toBeNull();
  });

  it("round-trips a valid cached catalog", async () => {
    const storage = memStorage();
    const refreshed = await refreshOpenRouterCatalog({
      fetchImpl: okFetch(),
      storage,
    });
    await expect(loadCachedOpenRouterCatalog(storage)).resolves.toEqual(
      refreshed,
    );
  });
});

describe("OpenRouter catalog daily refresh", () => {
  it("uses the local calendar date and refreshes only on the first open of a new day", async () => {
    const storage = memStorage();
    const dayOne = new Date(2026, 8, 14, 23, 30);
    const dayTwo = new Date(2026, 8, 15, 0, 5);
    const first = await refreshOpenRouterCatalog({
      fetchImpl: okFetch(),
      storage,
      now: () => dayOne,
    });
    expect(shouldRefreshOpenRouterCatalog(first, dayOne)).toBe(false);
    expect(shouldRefreshOpenRouterCatalog(first, dayTwo)).toBe(true);

    const fetchImpl = okFetch();
    const sameDay = await refreshOpenRouterCatalogIfStale({
      fetchImpl,
      storage,
      now: () => dayOne,
    });
    expect(sameDay).toEqual({ catalog: first, refreshed: false });
    expect(fetchImpl).not.toHaveBeenCalled();

    const nextDay = await refreshOpenRouterCatalogIfStale({
      fetchImpl,
      storage,
      now: () => dayTwo,
    });
    expect(nextDay.refreshed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("estimateOpenRouterInputCost", () => {
  it("multiplies estimated input tokens by Number(pricing.prompt)", async () => {
    const storage = memStorage();
    const catalog = await refreshOpenRouterCatalog({
      fetchImpl: okFetch(),
      storage,
    });
    expect(estimateOpenRouterInputCost(catalog.models[0], 2_000)).toBe(0.0025);
  });

  it("returns null when prompt pricing is absent or invalid", () => {
    expect(
      estimateOpenRouterInputCost(
        {
          id: "x",
          name: "X",
          contextLength: null,
          pricing: {},
        },
        10,
      ),
    ).toBeNull();
  });
});
