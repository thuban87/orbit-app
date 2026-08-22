/**
 * Catalog-driven model registry (14-10 — SUPERSEDES the 14-08 hand-curated arrays).
 *
 * WHY THIS MODULE CHANGED:
 *   14-08 shipped three hand-typed frontier arrays (OPENAI/ANTHROPIC/GOOGLE), which
 *   the owner had explicitly required be SOURCED from LiteLLM's maintained catalog
 *   instead — a hand list goes stale within a release. This module now reads an
 *   injected `ModelCatalog` (the on-device cache, or the bundled seed fallback) and
 *   applies the user's "Frontier only / All models" scope. The catalog itself is
 *   produced by `filterLiteLLMCatalog`; the ONLY thing maintained by hand here is
 *   the short frontier-family GLOB set below — and even that only NARROWS ids that
 *   always come from the live catalog.
 *
 * PURITY CONTRACT (grep-enforced by the test suite):
 *   No I/O and no network. The seed is bundled static data; the cache is read by
 *   the separate `model-catalog-cache` I/O module and PASSED IN. Free-text entry
 *   remains the escape hatch for any model not in the catalog.
 */
import type { CatalogProvider, ModelCatalog } from "@/ai/model-catalog-filter";
import { MODEL_CATALOG_SEED } from "@/ai/model-registry.seed.generated";
import type { AiProviderId } from "@/services/ai-types";

/** The bundled seed catalog — the offline / first-run fallback (D-01). */
export const SEED_CATALOG: ModelCatalog = MODEL_CATALOG_SEED;

/** The picker scope: the current-gen frontier subset, or the full chat set. */
export type ModelScope = "frontier" | "all";

// ─── Tunable frontier family globs (top-of-file — CLAUDE.md tunable-constants) ──
//
// The SINGLE hand-maintained knob. Each entry is a GLOB where `*` matches any run
// of characters; a bare stem (e.g. `gpt-5*`) also matches the stem exactly. Exact
// model ids ALWAYS come from the LiteLLM catalog — these patterns only pick which
// FAMILIES count as "current-gen frontier". Update a pattern when a provider ships
// a new frontier generation; never hand-list an individual id here.
export const FRONTIER_PATTERNS: Record<CatalogProvider, readonly string[]> = {
  openai: ["gpt-5*"],
  anthropic: ["claude-*-5", "claude-haiku-4-5"],
  google: ["gemini-3*"],
};

/** The frozen empty list reused for `none`/`custom` and no-match results. */
const EMPTY: readonly string[] = Object.freeze([]);

/** The three cloud providers that have a catalog (none/custom do not). */
function asCatalogProvider(provider: AiProviderId): CatalogProvider | null {
  return provider === "openai" ||
    provider === "anthropic" ||
    provider === "google"
    ? provider
    : null;
}

/** Compile a single frontier glob into an anchored, case-insensitive RegExp. */
function globToRegExp(pattern: string): RegExp {
  const body = pattern
    .split("*")
    .map((seg) => seg.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}$`, "i");
}

/** True when `id` matches ANY of the provider's frontier globs (case-insensitive). */
export function matchesFrontier(
  provider: CatalogProvider,
  id: string,
): boolean {
  return FRONTIER_PATTERNS[provider].some((pat) => globToRegExp(pat).test(id));
}

/**
 * Resolve the ACTIVE catalog the picker renders from: the on-device cache OVERRIDES
 * the bundled seed once the user has refreshed; a `null` cache (offline / first run
 * / corrupt) falls back to the seed. This is the cache-overrides-seed rule in one
 * place — the caller loads the cache (I/O) and passes it (or null) in.
 */
export function resolveActiveCatalog(
  cached: ModelCatalog | null,
): ModelCatalog {
  return cached ?? SEED_CATALOG;
}

/**
 * The picker model list for a provider under the active scope. `none`/`custom`
 * always yield an empty list (Custom is free-text only — C4-M1). `all` returns the
 * provider's full deprecation-filtered chat set (catalog order); `frontier`
 * narrows it to the frontier globs. Always returns a frozen array.
 */
export function modelsFor(
  catalog: ModelCatalog,
  provider: AiProviderId,
  scope: ModelScope,
): readonly string[] {
  const cp = asCatalogProvider(provider);
  if (!cp) return EMPTY;
  const all = catalog.models[cp] ?? EMPTY;
  if (scope === "all") return Object.freeze([...all]);
  return Object.freeze(all.filter((id) => matchesFrontier(cp, id)));
}

/**
 * Narrow a RAW discovered id list (a provider adapter's `listModels`, or any other
 * catalog) to the provider's frontier globs (14-10 evolution of the 14-08 curated
 * intersection). Preserves discovered order, de-duplicates case-insensitively, and
 * returns empty for `none`/`custom`. Free-text stays the escape hatch for anything
 * outside the frontier families.
 */
export function filterToFrontier(
  provider: AiProviderId,
  discovered: readonly string[],
): readonly string[] {
  const cp = asCatalogProvider(provider);
  if (!cp) return EMPTY;
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const id of discovered) {
    const key = id.toLowerCase();
    if (!seen.has(key) && matchesFrontier(cp, id)) {
      seen.add(key);
      kept.push(id);
    }
  }
  return Object.freeze(kept);
}
