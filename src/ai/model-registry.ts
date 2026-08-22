/**
 * Catalog-driven model registry (14-11 — narrows the 14-10 frontier from loose
 * family globs to EXACTLY THREE latest-per-tier ids per provider).
 *
 * WHY THIS MODULE CHANGED:
 *   14-10 sourced the model set from LiteLLM but the "Frontier only" scope still
 *   used broad family GLOBS (`gpt-5*`, `gemini-3*`, …), which returned 26/7/12
 *   models — far too many to be a useful "just pick a good one" shortlist. The
 *   owner wants Frontier to mean ONE current model per NAMED TIER per provider,
 *   each resolved to the LATEST version of that tier straight from the live
 *   catalog — so it auto-updates when a newer version ships after a refresh, and
 *   is NEVER a hardcoded id. This module now resolves those per-tier winners; the
 *   "All models" scope is unchanged (the full deprecation-filtered chat set).
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

// ─── Tunable frontier TIER keywords (top-of-file — CLAUDE.md tunable-constants) ─
//
// The SINGLE hand-maintained knob. Each provider has THREE named tiers; a tier is
// matched by a lowercase `include` keyword (and an optional `exclude` so `flash`
// never captures a `flash-lite`). Exact model ids ALWAYS come from the LiteLLM
// catalog — these keywords only pick which FAMILY each tier belongs to; the
// comparator below then resolves the LATEST version within that family. Update a
// keyword only when a provider renames a tier; never hand-list an individual id.
export interface FrontierTier {
  /** The tier's identity/label (also the keyword when `include` is omitted). */
  readonly tier: string;
  /** Lowercase substring a candidate id MUST contain (defaults to `tier`). */
  readonly include?: string;
  /** Lowercase substring a candidate id must NOT contain (e.g. `flash-lite`). */
  readonly exclude?: string;
}

export const FRONTIER_TIERS: Record<CatalogProvider, readonly FrontierTier[]> = {
  // OpenAI names its current tiers `gpt-<ver>-sol|terra|luna`.
  openai: [{ tier: "sol" }, { tier: "terra" }, { tier: "luna" }],
  anthropic: [{ tier: "opus" }, { tier: "sonnet" }, { tier: "haiku" }],
  google: [
    { tier: "pro" },
    // `flash` must NOT also match `flash-lite` (they are distinct tiers).
    { tier: "flash", exclude: "flash-lite" },
    { tier: "flash-lite" },
  ],
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

/**
 * Strip a trailing dated snapshot so the version parses off the base id and the
 * "dated" flag can be recorded: `YYYY-MM-DD` (OpenAI/Gemini), `YYYYMMDD`
 * (Anthropic), and `MM-YYYY` (some Gemini previews). Only ONE trailing form is
 * stripped — enough for the catalog's id shapes.
 */
function stripDateSuffix(id: string): string {
  return id
    .replace(/-\d{4}-\d{2}-\d{2}$/, "")
    .replace(/-\d{8}$/, "")
    .replace(/-\d{2}-\d{4}$/, "");
}

/** True when `id` carries a trailing dated snapshot (its base differs). */
function isDated(id: string): boolean {
  return stripDateSuffix(id) !== id;
}

/**
 * Parse a comparable version key from an id, or `null` when none is present (a
 * `-latest` alias, a robotics/omni id, etc.). OpenAI/Gemini encode the version
 * dotted right after the stem (`gpt-5.6`, `gemini-3.1`); Anthropic encodes it
 * dashed after the family (`claude-opus-4-5` → 4.5, `claude-opus-5` → 5.0). The
 * key is `major*10000 + minor` so a higher version always sorts higher. Parses
 * off the DATE-STRIPPED id so a dated snapshot never leaks digits into the minor.
 */
function versionKey(provider: CatalogProvider, id: string): number | null {
  const base = stripDateSuffix(id).toLowerCase();
  const match =
    provider === "anthropic"
      ? base.match(/claude-(?:opus|sonnet|haiku)-(\d+)(?:-(\d+))?/)
      : base.match(/(?:gemini|gpt)-(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  const minor = match[2] ? Number.parseInt(match[2], 10) : 0;
  return major * 10_000 + minor;
}

/** True when `id` belongs to `tier` under the provider's keyword rules. */
function matchesTier(tier: FrontierTier, id: string): boolean {
  const lower = id.toLowerCase();
  const include = (tier.include ?? tier.tier).toLowerCase();
  if (!lower.includes(include)) return false;
  if (tier.exclude && lower.includes(tier.exclude.toLowerCase())) return false;
  return true;
}

/**
 * Resolve the single LATEST id for one tier from `ids`, or `null` if the tier has
 * no candidate. Candidates must match the tier keywords AND carry a parseable
 * version (a `-latest` alias with no version never wins). The winner is: highest
 * version, then an undated alias over its dated snapshot, then the shorter id (so
 * a base id beats a `-customtools`/variant suffix), then lexicographic for a
 * stable result. Previews are eligible — they are not excluded here.
 */
function resolveTier(
  provider: CatalogProvider,
  ids: readonly string[],
  tier: FrontierTier,
): string | null {
  let best: string | null = null;
  let bestVer = -1;
  for (const id of ids) {
    if (!matchesTier(tier, id)) continue;
    const ver = versionKey(provider, id);
    if (ver === null) continue;
    if (best === null || better(ver, id, bestVer, best)) {
      best = id;
      bestVer = ver;
    }
  }
  return best;
}

/** True when candidate (verA,idA) should beat the incumbent (verB,idB). */
function better(verA: number, idA: string, verB: number, idB: string): boolean {
  if (verA !== verB) return verA > verB;
  const datedA = isDated(idA);
  const datedB = isDated(idB);
  if (datedA !== datedB) return !datedA; // prefer the undated alias
  if (idA.length !== idB.length) return idA.length < idB.length; // shorter base
  return idA < idB; // stable tiebreak
}

/**
 * The per-tier frontier winners for a provider over `ids`, in tier order,
 * skipping any tier the catalog cannot fill. Always ≤3 ids, frozen.
 */
function frontierWinners(
  provider: CatalogProvider,
  ids: readonly string[],
): readonly string[] {
  const kept: string[] = [];
  for (const tier of FRONTIER_TIERS[provider]) {
    const winner = resolveTier(provider, ids, tier);
    if (winner !== null) kept.push(winner);
  }
  return Object.freeze(kept);
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
 * narrows it to the ≤3 latest-per-tier winners. Always returns a frozen array.
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
  return frontierWinners(cp, all);
}

/**
 * Narrow a RAW discovered id list (a provider adapter's `listModels`, or any other
 * catalog) to the same ≤3 latest-per-tier winners (14-11 evolution of the 14-10
 * glob intersection). Returns empty for `none`/`custom`. Free-text stays the
 * escape hatch for anything outside the frontier tiers.
 */
export function filterToFrontier(
  provider: AiProviderId,
  discovered: readonly string[],
): readonly string[] {
  const cp = asCatalogProvider(provider);
  if (!cp) return EMPTY;
  return frontierWinners(cp, discovered);
}
