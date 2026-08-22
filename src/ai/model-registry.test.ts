/**
 * Catalog-driven model registry — node-tested off-device (14-11, narrows the
 * 14-10 frontier from loose family globs to EXACTLY THREE latest-per-tier ids).
 *
 * These pin the invariants the picker relies on now that "Frontier only" means
 * one CURRENT model per named tier per provider, each resolved to the LATEST
 * version from the live LiteLLM catalog (never a hardcoded id):
 *   - `modelsFor` reads an injected catalog (cache-or-seed) and, in `frontier`
 *     scope, returns the per-tier winners (≤3); `all` is the full chat set;
 *     `none`/`custom` always return empty (Custom is free-text only — C4-M1);
 *   - `FRONTIER_TIERS` is the ONLY hand-maintained knob — the tier KEYWORDS per
 *     provider; exact ids ALWAYS come from the catalog and auto-update on refresh;
 *   - the comparator picks the HIGHEST version per tier, previews eligible, and
 *     prefers an undated alias over its dated snapshot at the same version;
 *   - `resolveActiveCatalog` makes the on-device cache OVERRIDE the bundled seed,
 *     and falls back to the seed when there is no cache (offline / first run);
 *   - `filterToFrontier` resolves the same per-tier winners over a raw discovered
 *     list.
 */
import { describe, expect, it } from "vitest";
import type { ModelCatalog } from "@/ai/model-catalog-filter";
import {
  FRONTIER_TIERS,
  filterToFrontier,
  modelsFor,
  resolveActiveCatalog,
  SEED_CATALOG,
} from "@/ai/model-registry";

/** A deterministic synthetic catalog (independent of the live seed). */
const CATALOG: ModelCatalog = {
  source: "test",
  generatedAt: "2026-08-22T00:00:00.000Z",
  models: {
    openai: [
      "gpt-5.6-sol",
      "gpt-5.4-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-4o",
      "gpt-5.6-cyber",
    ],
    anthropic: [
      "claude-opus-4-8",
      "claude-opus-5",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-5",
      "claude-haiku-4-5-20251001",
      "claude-haiku-4-5",
      "claude-fable-5",
    ],
    google: [
      "gemini-3-pro-preview",
      "gemini-3.1-pro-preview-customtools",
      "gemini-3.1-pro-preview",
      "gemini-pro-latest",
      "gemini-2.5-flash",
      "gemini-3.7-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-flash-latest",
    ],
  },
  limits: { openai: {}, anthropic: {}, google: {} },
};

describe("FRONTIER_TIERS — the single hand-maintained knob", () => {
  it("names the owner-specified tier keywords per provider", () => {
    expect(FRONTIER_TIERS.openai.map((t) => t.tier)).toEqual([
      "sol",
      "terra",
      "luna",
    ]);
    expect(FRONTIER_TIERS.anthropic.map((t) => t.tier)).toEqual([
      "opus",
      "sonnet",
      "haiku",
    ]);
    expect(FRONTIER_TIERS.google.map((t) => t.tier)).toEqual([
      "pro",
      "flash",
      "flash-lite",
    ]);
  });
});

describe("modelsFor — frontier resolves to ≤3 latest-per-tier winners", () => {
  it("returns the FULL provider list in 'all' scope, catalog order preserved", () => {
    expect(modelsFor(CATALOG, "openai", "all")).toEqual([
      "gpt-5.6-sol",
      "gpt-5.4-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-4o",
      "gpt-5.6-cyber",
    ]);
  });

  it("openai: one id per tier, highest version, cyber/dated/non-tier dropped", () => {
    expect(modelsFor(CATALOG, "openai", "frontier")).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ]);
  });

  it("anthropic: opus/sonnet/haiku winners; fable excluded; undated over dated", () => {
    expect(modelsFor(CATALOG, "anthropic", "frontier")).toEqual([
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ]);
  });

  it("google: pro/flash/flash-lite; flash must NOT match flash-lite; base over customtools", () => {
    expect(modelsFor(CATALOG, "google", "frontier")).toEqual([
      "gemini-3.1-pro-preview",
      "gemini-3.7-flash",
      "gemini-3.5-flash-lite",
    ]);
  });

  it("returns empty for none/custom in any scope (free-text only)", () => {
    for (const scope of ["frontier", "all"] as const) {
      expect(modelsFor(CATALOG, "none", scope)).toEqual([]);
      expect(modelsFor(CATALOG, "custom", scope)).toEqual([]);
    }
  });

  it("returns a frozen array", () => {
    expect(Object.isFrozen(modelsFor(CATALOG, "openai", "frontier"))).toBe(
      true,
    );
  });
});

describe("SEED_CATALOG — the committed frontier resolutions (14-11 required)", () => {
  it("carries a non-empty list per provider and the LiteLLM source", () => {
    expect(SEED_CATALOG.models.openai.length).toBeGreaterThan(0);
    expect(SEED_CATALOG.models.anthropic.length).toBeGreaterThan(0);
    expect(SEED_CATALOG.models.google.length).toBeGreaterThan(0);
    expect(SEED_CATALOG.source).toContain(
      "model_prices_and_context_window.json",
    );
  });

  // The exact resolutions the owner pinned. If the comparator yields anything
  // else for the committed seed, the comparator is wrong — fix it, not this.
  it("resolves Gemini to Pro/Flash/Flash-lite latest", () => {
    expect(modelsFor(SEED_CATALOG, "google", "frontier")).toEqual([
      "gemini-3.1-pro-preview",
      "gemini-3.7-flash",
      "gemini-3.5-flash-lite",
    ]);
  });

  it("resolves Anthropic to Opus/Sonnet/Haiku latest", () => {
    expect(modelsFor(SEED_CATALOG, "anthropic", "frontier")).toEqual([
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ]);
  });

  it("resolves OpenAI to Sol/Terra/Luna latest", () => {
    expect(modelsFor(SEED_CATALOG, "openai", "frontier")).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ]);
  });
});

describe("filterToFrontier — resolve per-tier winners over a raw discovered list", () => {
  it("keeps only the latest-per-tier winners from a discovered catalog", () => {
    const discovered = [
      "gpt-4o",
      "gpt-5.4-sol",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5.6-cyber",
    ];
    expect(filterToFrontier("openai", discovered)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ]);
  });

  it("returns empty for none/custom (no frontier tiers to resolve)", () => {
    expect(filterToFrontier("custom", ["anything"])).toEqual([]);
    expect(filterToFrontier("none", ["anything"])).toEqual([]);
  });

  it("returns a frozen empty list when no tier resolves", () => {
    const out = filterToFrontier("google", ["gemini-pro-latest"]);
    expect(out).toEqual([]);
    expect(Object.isFrozen(out)).toBe(true);
  });
});

describe("resolveActiveCatalog — cache overrides seed, seed is the fallback", () => {
  it("returns the cached catalog when present (cache overrides seed)", () => {
    expect(resolveActiveCatalog(CATALOG)).toBe(CATALOG);
  });
  it("falls back to the bundled seed when there is no cache (offline/first run)", () => {
    expect(resolveActiveCatalog(null)).toBe(SEED_CATALOG);
  });
});
