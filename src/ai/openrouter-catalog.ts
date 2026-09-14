/**
 * OpenRouter's public model catalog + pricing cache.
 *
 * Refresh is a bare, keyless GET that carries no contact data. It is invoked
 * only by an explicit Refresh Models action or the first settings-open of a new
 * local day. Cache reads never throw; refresh failures never overwrite the last
 * good snapshot, preserving Orbit's local-first read path.
 */
import { formatLocalDate } from "@/utils/dates";

export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export interface OpenRouterPricing {
  readonly prompt?: string;
  readonly completion?: string;
  readonly image?: string;
  readonly request?: string;
}

export interface OpenRouterModel {
  readonly id: string;
  readonly name: string;
  readonly contextLength: number | null;
  readonly pricing: OpenRouterPricing;
}

export interface OpenRouterCatalog {
  readonly source: typeof OPENROUTER_MODELS_URL;
  readonly updatedLocalDate: string;
  readonly models: readonly OpenRouterModel[];
}

export interface OpenRouterCatalogStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

export interface OpenRouterCatalogResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type OpenRouterCatalogFetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<OpenRouterCatalogResponse>;

export interface RefreshOpenRouterCatalogDeps {
  readonly fetchImpl: OpenRouterCatalogFetch;
  readonly storage: OpenRouterCatalogStorage;
  readonly now?: () => Date;
  readonly signal?: AbortSignal;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseModel(value: unknown): OpenRouterModel | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  const pricingRaw =
    raw.pricing && typeof raw.pricing === "object"
      ? (raw.pricing as Record<string, unknown>)
      : {};
  const contextLength =
    typeof raw.context_length === "number" &&
    Number.isFinite(raw.context_length) &&
    raw.context_length > 0
      ? raw.context_length
      : null;
  return {
    id: raw.id,
    name:
      typeof raw.name === "string" && raw.name.length > 0 ? raw.name : raw.id,
    contextLength,
    pricing: {
      ...(optionalString(pricingRaw.prompt) !== undefined
        ? { prompt: optionalString(pricingRaw.prompt) }
        : {}),
      ...(optionalString(pricingRaw.completion) !== undefined
        ? { completion: optionalString(pricingRaw.completion) }
        : {}),
      ...(optionalString(pricingRaw.image) !== undefined
        ? { image: optionalString(pricingRaw.image) }
        : {}),
      ...(optionalString(pricingRaw.request) !== undefined
        ? { request: optionalString(pricingRaw.request) }
        : {}),
    },
  };
}

function parseCatalog(value: unknown, now: Date): OpenRouterCatalog | null {
  if (!value || typeof value !== "object") return null;
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;

  const models: OpenRouterModel[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    const model = parseModel(item);
    if (model === null || seen.has(model.id)) continue;
    seen.add(model.id);
    models.push(model);
  }
  if (models.length === 0) return null;
  return {
    source: OPENROUTER_MODELS_URL,
    updatedLocalDate: formatLocalDate(now),
    models,
  };
}

function isPricing(value: unknown): value is OpenRouterPricing {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["prompt", "completion", "image", "request"].every((key) => {
    const field = (value as Record<string, unknown>)[key];
    return field === undefined || typeof field === "string";
  });
}

function isCachedCatalog(value: unknown): value is OpenRouterCatalog {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  if (
    raw.source !== OPENROUTER_MODELS_URL ||
    typeof raw.updatedLocalDate !== "string" ||
    !Array.isArray(raw.models) ||
    raw.models.length === 0
  ) {
    return false;
  }
  return raw.models.every((item) => {
    if (!item || typeof item !== "object") return false;
    const model = item as Record<string, unknown>;
    return (
      typeof model.id === "string" &&
      model.id.length > 0 &&
      typeof model.name === "string" &&
      (model.contextLength === null ||
        (typeof model.contextLength === "number" &&
          Number.isFinite(model.contextLength) &&
          model.contextLength > 0)) &&
      isPricing(model.pricing)
    );
  });
}

/** Read a valid cached snapshot or null. This function never throws. */
export async function loadCachedOpenRouterCatalog(
  storage: OpenRouterCatalogStorage,
): Promise<OpenRouterCatalog | null> {
  try {
    const raw = await storage.read();
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCachedCatalog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Explicit public refresh. It writes only after the complete response validates. */
export async function refreshOpenRouterCatalog(
  deps: RefreshOpenRouterCatalogDeps,
): Promise<OpenRouterCatalog> {
  const response = await deps.fetchImpl(
    OPENROUTER_MODELS_URL,
    deps.signal ? { signal: deps.signal } : undefined,
  );
  if (!response.ok) {
    throw new Error(`refreshOpenRouterCatalog: HTTP ${response.status}`);
  }
  const catalog = parseCatalog(
    await response.json(),
    deps.now ? deps.now() : new Date(),
  );
  if (catalog === null) {
    throw new Error("refreshOpenRouterCatalog: invalid catalog response");
  }
  await deps.storage.write(JSON.stringify(catalog));
  return catalog;
}

/** True when no snapshot exists or its local calendar day is no longer today. */
export function shouldRefreshOpenRouterCatalog(
  catalog: OpenRouterCatalog | null,
  now: Date = new Date(),
): boolean {
  return catalog === null || catalog.updatedLocalDate !== formatLocalDate(now);
}

/** Settings-open entry point: at most one automatic refresh per local day. */
export async function refreshOpenRouterCatalogIfStale(
  deps: RefreshOpenRouterCatalogDeps,
): Promise<{ catalog: OpenRouterCatalog; refreshed: boolean }> {
  const cached = await loadCachedOpenRouterCatalog(deps.storage);
  const now = deps.now ? deps.now() : new Date();
  if (!shouldRefreshOpenRouterCatalog(cached, now) && cached !== null) {
    return { catalog: cached, refreshed: false };
  }
  const catalog = await refreshOpenRouterCatalog({ ...deps, now: () => now });
  return { catalog, refreshed: true };
}

/** Real USD input estimate sourced only from the selected catalog entry. */
export function estimateOpenRouterInputCost(
  model: OpenRouterModel,
  estimatedInputTokens: number,
): number | null {
  if (!Number.isFinite(estimatedInputTokens) || estimatedInputTokens < 0) {
    return null;
  }
  const promptPrice = Number(model.pricing.prompt);
  if (!Number.isFinite(promptPrice) || promptPrice < 0) return null;
  return estimatedInputTokens * promptPrice;
}
