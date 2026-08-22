/**
 * LiteLLM catalog filter/map — the SINGLE source of the selectable-model set
 * (14-10, supersedes 14-08's hand-curated arrays).
 *
 * WHY THIS EXISTS:
 *   The owner's requirement is that the AI model list be SOURCED from LiteLLM's
 *   maintained, always-current catalog — never hand-typed (a hand-typed list goes
 *   stale within a release, exactly what 14-08 shipped). This module is the pure,
 *   node-testable core that turns the raw LiteLLM JSON into an ordered per-provider
 *   catalog. It is used in TWO places off a single implementation:
 *     - `scripts/gen-models.ts` — build-time, on THIS dev box, writes the bundled
 *       SEED snapshot (`model-registry.seed.generated.ts`);
 *     - `model-catalog-cache.ts` — runtime, on the user's device, on an explicit
 *       "Refresh models" tap (plain public `fetch`, no key, no user data).
 *
 * SOURCE (verified against the LIVE file on 2026-08-22):
 *   `model_prices_and_context_window.json` is a large object keyed by model id.
 *   Each value carries `litellm_provider`, `mode`, and (on some) `deprecation_date`
 *   (a `YYYY-MM-DD` string), plus cost/context fields we do NOT read. The reserved
 *   `sample_spec` key documents the schema and is NOT a model.
 *
 * FILTER/MAP RULES (all proven in the co-located test):
 *   1. keep ONLY `mode === "chat"` (drops image/embedding/tts/realtime/audio/…);
 *   2. map provider: `openai`→openai, `anthropic`→anthropic; the Gemini family
 *      (native `gemini`, plus `vertex_ai` / `vertex_ai-language-models` variants of
 *      the SAME id) → google, native preferred on dedup;
 *   3. DROP any entry whose `deprecation_date` is at/before `now`;
 *   4. DROP OpenAI `ft:` fine-tune TEMPLATE rows (not directly-selectable models —
 *      a user's own fine-tune id stays reachable via free-text);
 *   5. strip a leading `provider/` segment so ids are BARE (the adapters build
 *      request URLs from bare ids — e.g. Gemini `models/<id>`);
 *   6. de-duplicate case-insensitively, preserving first-seen order/casing.
 *
 * PURITY: no I/O, no network. It takes an ALREADY-PARSED object plus an injected
 * `now`, so the seed script and the device refresh share identical semantics and
 * the tests are deterministic.
 */

/** The public LiteLLM catalog file — a plain, key-free, data-only GET target. */
export const LITELLM_MODELS_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

/** The three cloud providers whose models Orbit can pick (see ai-types). */
export type CatalogProvider = "openai" | "anthropic" | "google";

/** The provider ids, ordered — the canonical iteration order for a catalog. */
export const CATALOG_PROVIDERS: readonly CatalogProvider[] = [
  "openai",
  "anthropic",
  "google",
];

/**
 * The persisted/bundled catalog shape. `models` is keyed by our provider ids and
 * each value is an ordered, de-duplicated, bare-id list. `limits` carries each
 * model's own MAXIMUM output-token count (from LiteLLM), keyed by the same bare
 * id — the only ceiling Anthropic sends now that the artificial cap is gone
 * (14-11); a model absent from a provider's `limits` simply has no recorded max
 * (the caller applies a safe fallback). `source` records the LiteLLM url and
 * `generatedAt` the ISO instant the snapshot was filtered.
 */
export interface ModelCatalog {
  readonly source: string;
  readonly generatedAt: string;
  readonly models: Record<CatalogProvider, readonly string[]>;
  readonly limits: Record<CatalogProvider, Readonly<Record<string, number>>>;
}

/** The subset of a LiteLLM entry this module reads (all other fields ignored). */
interface LiteLLMEntry {
  readonly litellm_provider?: unknown;
  readonly mode?: unknown;
  readonly deprecation_date?: unknown;
  /** The model's own max output ceiling — canonical field (14-11). */
  readonly max_output_tokens?: unknown;
  /** Legacy alias LiteLLM still emits alongside `max_output_tokens`. */
  readonly max_tokens?: unknown;
}

/**
 * The `litellm_provider` values that contribute Gemini models to `google`, in
 * DEDUP PRIORITY order: the native `gemini` provider wins over a `vertex_ai`
 * (or vertex language-models) variant of the same id. Only ids that normalize to
 * the `gemini` family are taken from the vertex providers — a vertex-hosted
 * Claude/Llama is NOT a Google model.
 */
const GEMINI_SOURCES: readonly string[] = [
  "gemini",
  "vertex_ai",
  "vertex_ai-language-models",
];

/** Strip a single leading `provider/` segment: `gemini/gemini-x` → `gemini-x`. */
function stripPrefix(id: string): string {
  const slash = id.indexOf("/");
  return slash === -1 ? id : id.slice(slash + 1);
}

/**
 * True when the entry is deprecated as of `now`. A missing/blank/unparseable
 * `deprecation_date` is NOT deprecated; a parseable date at or before `now` is.
 */
function isDeprecated(entry: LiteLLMEntry, now: Date): boolean {
  const raw = entry.deprecation_date;
  if (typeof raw !== "string" || raw === "") return false;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

/**
 * Read a LiteLLM entry's own max output-token ceiling: prefer the canonical
 * `max_output_tokens`, fall back to the legacy `max_tokens` LiteLLM still emits.
 * Returns `null` when neither is a positive finite number (the model then has no
 * recorded limit and the caller applies a safe fallback).
 */
function readMaxOutput(entry: LiteLLMEntry): number | null {
  for (const raw of [entry.max_output_tokens, entry.max_tokens]) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  }
  return null;
}

/**
 * Build the per-model limits map for one provider's DEDUPED id list from a
 * lowercase-keyed max lookup. Only ids with a recorded max appear (a missing key
 * means "no recorded limit"), keyed by the surviving id's canonical casing.
 */
function limitsFor(
  ids: readonly string[],
  maxByLower: ReadonlyMap<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const max = maxByLower.get(id.toLowerCase());
    if (max !== undefined) out[id] = max;
  }
  return out;
}

/**
 * De-duplicate case-insensitively, preserving first-seen order AND the first-seen
 * casing (LiteLLM ids are the canonical casing the provider expects).
 */
function dedupe(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const key = id.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(id);
    }
  }
  return out;
}

/**
 * Filter + map the raw LiteLLM catalog object into an ordered per-provider
 * `ModelCatalog`. Never throws on malformed input — a non-object (or an entry
 * that is not a record) simply contributes nothing, so a corrupt refresh degrades
 * to an empty catalog rather than an exception (the caller falls back to the seed).
 */
export function filterLiteLLMCatalog(
  raw: unknown,
  now: Date = new Date(),
): ModelCatalog {
  const openai: string[] = [];
  const anthropic: string[] = [];
  // Gemini ids gathered with their source-priority so the native provider wins
  // the dedup: [priorityIndex, normalizedId].
  const geminiBuf: Array<[number, string]> = [];
  // Each bare id's own max output ceiling, first-seen wins (mirrors `dedupe`),
  // keyed lowercase so the surviving-casing lookup is stable.
  const maxByLower = new Map<string, number>();

  const recordMax = (bare: string, entry: LiteLLMEntry): void => {
    const key = bare.toLowerCase();
    if (maxByLower.has(key)) return; // first-seen wins, matching dedupe
    const max = readMaxOutput(entry);
    if (max !== null) maxByLower.set(key, max);
  };

  if (raw && typeof raw === "object") {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (id === "sample_spec") continue;
      if (!value || typeof value !== "object") continue;
      const entry = value as LiteLLMEntry;
      if (entry.mode !== "chat") continue;
      if (isDeprecated(entry, now)) continue;

      const provider = entry.litellm_provider;
      if (provider === "openai") {
        if (id.startsWith("ft:")) continue; // fine-tune template, not selectable
        const bare = stripPrefix(id);
        openai.push(bare);
        recordMax(bare, entry);
      } else if (provider === "anthropic") {
        const bare = stripPrefix(id);
        anthropic.push(bare);
        recordMax(bare, entry);
      } else if (
        typeof provider === "string" &&
        GEMINI_SOURCES.includes(provider)
      ) {
        const bare = stripPrefix(id);
        if (/^gemini/i.test(bare)) {
          geminiBuf.push([GEMINI_SOURCES.indexOf(provider), bare]);
          recordMax(bare, entry);
        }
      }
    }
  }

  // Stable-sort Gemini ids by source priority (native first) BEFORE dedup so a
  // native id is the survivor when a vertex variant shares the same normalized id.
  geminiBuf.sort((a, b) => a[0] - b[0]);
  const google = geminiBuf.map(([, bare]) => bare);

  const models = {
    openai: dedupe(openai),
    anthropic: dedupe(anthropic),
    google: dedupe(google),
  };

  return {
    source: LITELLM_MODELS_URL,
    generatedAt: now.toISOString(),
    models,
    limits: {
      openai: limitsFor(models.openai, maxByLower),
      anthropic: limitsFor(models.anthropic, maxByLower),
      google: limitsFor(models.google, maxByLower),
    },
  };
}
