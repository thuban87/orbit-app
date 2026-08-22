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
 * each value is an ordered, de-duplicated, bare-id list. `source` records the
 * LiteLLM url and `generatedAt` the ISO instant the snapshot was filtered.
 */
export interface ModelCatalog {
  readonly source: string;
  readonly generatedAt: string;
  readonly models: Record<CatalogProvider, readonly string[]>;
}

/** The subset of a LiteLLM entry this module reads (all other fields ignored). */
interface LiteLLMEntry {
  readonly litellm_provider?: unknown;
  readonly mode?: unknown;
  readonly deprecation_date?: unknown;
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
        openai.push(stripPrefix(id));
      } else if (provider === "anthropic") {
        anthropic.push(stripPrefix(id));
      } else if (
        typeof provider === "string" &&
        GEMINI_SOURCES.includes(provider)
      ) {
        const bare = stripPrefix(id);
        if (/^gemini/i.test(bare)) {
          geminiBuf.push([GEMINI_SOURCES.indexOf(provider), bare]);
        }
      }
    }
  }

  // Stable-sort Gemini ids by source priority (native first) BEFORE dedup so a
  // native id is the survivor when a vertex variant shares the same normalized id.
  geminiBuf.sort((a, b) => a[0] - b[0]);
  const google = geminiBuf.map(([, bare]) => bare);

  return {
    source: LITELLM_MODELS_URL,
    generatedAt: now.toISOString(),
    models: {
      openai: dedupe(openai),
      anthropic: dedupe(anthropic),
      google: dedupe(google),
    },
  };
}
