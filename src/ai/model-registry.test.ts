/**
 * Catalog-driven model registry — node-tested off-device (14-10, supersedes the
 * 14-08 hand-curated arrays).
 *
 * These pin the invariants the picker relies on now that the model set is SOURCED
 * from LiteLLM (never hand-typed):
 *   - `modelsFor` reads an injected catalog (cache-or-seed) and applies the
 *     "Frontier only / All models" scope; `none`/`custom` always return empty
 *     (Custom is free-text only — C4-M1);
 *   - `FRONTIER_PATTERNS` is the ONLY hand-maintained knob — a short per-provider
 *     set of family GLOBS; exact ids ALWAYS come from the catalog;
 *   - `resolveActiveCatalog` makes the on-device cache OVERRIDE the bundled seed,
 *     and falls back to the seed when there is no cache (offline / first run);
 *   - `filterToFrontier` narrows a raw discovered catalog to the frontier globs.
 */
import { describe, expect, it } from "vitest";
import type { ModelCatalog } from "@/ai/model-catalog-filter";
import {
  FRONTIER_PATTERNS,
  filterToFrontier,
  matchesFrontier,
  modelsFor,
  resolveActiveCatalog,
  SEED_CATALOG,
} from "@/ai/model-registry";

/** A deterministic synthetic catalog (independent of the live seed). */
const CATALOG: ModelCatalog = {
  source: "test",
  generatedAt: "2026-08-22T00:00:00.000Z",
  models: {
    openai: ["gpt-4o", "gpt-5", "gpt-5.4-mini", "gpt-4.1"],
    anthropic: ["claude-sonnet-4-6", "claude-sonnet-5", "claude-haiku-4-5"],
    google: ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.1-pro-preview"],
  },
};

describe("FRONTIER_PATTERNS — the single hand-maintained knob", () => {
  it("seeds the owner-specified family globs per provider", () => {
    expect(FRONTIER_PATTERNS.openai).toEqual(["gpt-5*"]);
    expect(FRONTIER_PATTERNS.anthropic).toEqual([
      "claude-*-5",
      "claude-haiku-4-5",
    ]);
    expect(FRONTIER_PATTERNS.google).toEqual(["gemini-3*"]);
  });
});

describe("matchesFrontier — glob family match", () => {
  it("matches gpt-5* (including the exact stem)", () => {
    expect(matchesFrontier("openai", "gpt-5")).toBe(true);
    expect(matchesFrontier("openai", "gpt-5.4-mini")).toBe(true);
    expect(matchesFrontier("openai", "gpt-4o")).toBe(false);
  });
  it("matches the anthropic mid-glob + explicit haiku", () => {
    expect(matchesFrontier("anthropic", "claude-sonnet-5")).toBe(true);
    expect(matchesFrontier("anthropic", "claude-opus-5")).toBe(true);
    expect(matchesFrontier("anthropic", "claude-haiku-4-5")).toBe(true);
    expect(matchesFrontier("anthropic", "claude-sonnet-4-6")).toBe(false);
  });
  it("matches gemini-3* only", () => {
    expect(matchesFrontier("google", "gemini-3.5-flash")).toBe(true);
    expect(matchesFrontier("google", "gemini-2.5-flash")).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(matchesFrontier("openai", "GPT-5.4-Mini")).toBe(true);
  });
});

describe("modelsFor — scope-driven picker list", () => {
  it("returns the FULL provider list in 'all' scope, catalog order preserved", () => {
    expect(modelsFor(CATALOG, "openai", "all")).toEqual([
      "gpt-4o",
      "gpt-5",
      "gpt-5.4-mini",
      "gpt-4.1",
    ]);
  });
  it("returns only the frontier subset in 'frontier' scope", () => {
    expect(modelsFor(CATALOG, "openai", "frontier")).toEqual([
      "gpt-5",
      "gpt-5.4-mini",
    ]);
    expect(modelsFor(CATALOG, "anthropic", "frontier")).toEqual([
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ]);
    expect(modelsFor(CATALOG, "google", "frontier")).toEqual([
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
    ]);
  });
  it("returns empty for none/custom in any scope (free-text only)", () => {
    for (const scope of ["frontier", "all"] as const) {
      expect(modelsFor(CATALOG, "none", scope)).toEqual([]);
      expect(modelsFor(CATALOG, "custom", scope)).toEqual([]);
    }
  });
  it("returns a frozen array", () => {
    expect(Object.isFrozen(modelsFor(CATALOG, "openai", "all"))).toBe(true);
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

describe("SEED_CATALOG — bundled, non-empty for every cloud provider", () => {
  it("carries a non-empty list per provider and the LiteLLM source", () => {
    expect(SEED_CATALOG.models.openai.length).toBeGreaterThan(0);
    expect(SEED_CATALOG.models.anthropic.length).toBeGreaterThan(0);
    expect(SEED_CATALOG.models.google.length).toBeGreaterThan(0);
    expect(SEED_CATALOG.source).toContain(
      "model_prices_and_context_window.json",
    );
  });
  it("has a non-empty frontier intersection per provider (globs still match)", () => {
    for (const p of ["openai", "anthropic", "google"] as const) {
      expect(modelsFor(SEED_CATALOG, p, "frontier").length).toBeGreaterThan(0);
    }
  });
});

describe("filterToFrontier — narrow a raw discovered catalog to the frontier globs", () => {
  it("keeps only frontier-matching ids, preserving discovered order + de-duping", () => {
    const discovered = [
      "gpt-4o",
      "gpt-5.4-mini",
      "gpt-4.1",
      "gpt-5",
      "gpt-5.4-mini",
    ];
    expect(filterToFrontier("openai", discovered)).toEqual([
      "gpt-5.4-mini",
      "gpt-5",
    ]);
  });
  it("returns empty for none/custom (no frontier set to intersect)", () => {
    expect(filterToFrontier("custom", ["anything"])).toEqual([]);
    expect(filterToFrontier("none", ["anything"])).toEqual([]);
  });
  it("returns a frozen empty list when nothing matches", () => {
    const out = filterToFrontier("google", ["gemini-2.5-flash"]);
    expect(out).toEqual([]);
    expect(Object.isFrozen(out)).toBe(true);
  });
});
