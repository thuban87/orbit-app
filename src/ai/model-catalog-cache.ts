/**
 * Model catalog cache + user-instigated refresh (14-10) — the I/O half of the
 * LiteLLM-sourced picker.
 *
 * TRANSPORT & PRIVACY:
 *   The refresh is a PLAIN public-file GET of LiteLLM's `model_prices_and_context_
 *   window.json`. It is DELIBERATELY not routed through the Custom
 *   `orbit-secure-fetch` native transport — that transport exists only for the
 *   user's Custom-AI-provider egress. This fetch sends NO API key and NO
 *   user/contact data; it is a public, data-only GET. It MUST be invoked ONLY from
 *   the user's explicit "Refresh models" tap — never on a read path, screen mount,
 *   or app launch (local-first: no blocking network on a read path).
 *
 * INJECTED I/O:
 *   `fetchImpl` and `storage` are injected so this module is pure-testable with a
 *   fake network + in-memory store (see the co-located test). The device wiring
 *   supplies the real `fetch` and an `expo-file-system`-backed storage from
 *   `model-catalog-storage.ts` (the FS binding, proven on-device, not unit-tested).
 *
 * FALLBACK SEMANTICS:
 *   `loadCachedCatalog` returns the parsed cache or `null` (absent / corrupt /
 *   wrong-shape) — it NEVER throws, so a read path can always resolve a catalog.
 *   `refreshModelCatalog` THROWS on network / non-2xx / shape-broken responses and
 *   leaves any prior cache untouched, so a failed refresh degrades to the existing
 *   cache or the bundled seed rather than clobbering good data.
 */
import {
  filterLiteLLMCatalog,
  LITELLM_MODELS_URL,
  type ModelCatalog,
} from "@/ai/model-catalog-filter";

/** The minimal persisted-string store the cache reads/writes (injected). */
export interface CatalogStorage {
  /** The cached catalog JSON string, or null if none is stored yet. */
  read(): Promise<string | null>;
  /** Persist the catalog JSON string (overwrites the prior snapshot). */
  write(data: string): Promise<void>;
}

/** The narrow response shape the refresh needs from an injected `fetch`. */
export interface CatalogFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/** A `fetch`-like function — a bare GET; NO headers/body are ever passed. */
export type CatalogFetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<CatalogFetchResponse>;

export interface RefreshDeps {
  readonly fetchImpl: CatalogFetch;
  readonly storage: CatalogStorage;
  /** Injectable clock (defaults to real now) so the snapshot stamp is testable. */
  readonly now?: () => Date;
  /** Optional cancellation for the in-flight GET. */
  readonly signal?: AbortSignal;
}

/**
 * True when the value is a ModelCatalog with all three provider arrays present
 * AND the 14-11 per-provider `limits` map. A pre-14-11 cache (no `limits`) is
 * rejected here, so it degrades to the bundled seed until the user refreshes —
 * safer than accepting a cache that lacks the max-output ceilings Anthropic now
 * sources from it.
 */
function isModelCatalog(value: unknown): value is ModelCatalog {
  if (!value || typeof value !== "object") return false;
  const models = (value as { models?: unknown }).models;
  const limits = (value as { limits?: unknown }).limits;
  if (!models || typeof models !== "object") return false;
  if (!limits || typeof limits !== "object") return false;
  const m = models as Record<string, unknown>;
  const l = limits as Record<string, unknown>;
  const isRecord = (v: unknown): boolean =>
    !!v && typeof v === "object" && !Array.isArray(v);
  return (
    Array.isArray(m.openai) &&
    Array.isArray(m.anthropic) &&
    Array.isArray(m.google) &&
    isRecord(l.openai) &&
    isRecord(l.anthropic) &&
    isRecord(l.google)
  );
}

/** True when every provider list is empty (a shape-broken / useless snapshot). */
function isEmptyCatalog(cat: ModelCatalog): boolean {
  return (
    cat.models.openai.length === 0 &&
    cat.models.anthropic.length === 0 &&
    cat.models.google.length === 0
  );
}

/**
 * Read + parse the on-device cache. Returns the catalog, or `null` for an absent,
 * corrupt, or wrong-shape cache. NEVER throws — a read path can always resolve a
 * catalog (the registry's `resolveActiveCatalog` turns `null` into the seed).
 */
export async function loadCachedCatalog(
  storage: CatalogStorage,
): Promise<ModelCatalog | null> {
  let raw: string | null;
  try {
    raw = await storage.read();
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isModelCatalog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Fetch the public LiteLLM catalog, filter it, persist it, and return it. A bare
 * GET — NO key, NO headers, NO body (privacy). THROWS on a rejected fetch, a
 * non-2xx status, or an all-empty filtered result, WITHOUT writing, so a failed
 * refresh never clobbers a good cache/seed. MUST be called only from an explicit
 * user tap.
 */
export async function refreshModelCatalog(
  deps: RefreshDeps,
): Promise<ModelCatalog> {
  const { fetchImpl, storage, now, signal } = deps;

  const res = await fetchImpl(
    LITELLM_MODELS_URL,
    signal ? { signal } : undefined,
  );
  if (!res.ok) {
    throw new Error(`refreshModelCatalog: HTTP ${res.status}`);
  }

  const raw: unknown = await res.json();
  const catalog = filterLiteLLMCatalog(raw, now ? now() : new Date());
  if (isEmptyCatalog(catalog)) {
    throw new Error(
      "refreshModelCatalog: filtered catalog is empty — LiteLLM shape may have changed",
    );
  }

  await storage.write(JSON.stringify(catalog));
  return catalog;
}
