/**
 * Curated frontier model-registry contract — node-tested off-device (C2-M4).
 *
 * These pin the curation invariants that the picker relies on (Plan 14-08):
 *   - The default list is BUNDLED static data — non-empty, frozen, and ordered —
 *     for the three cloud chat providers, and empty for `none`/`custom` (Custom is
 *     free-text only — C4-M1). No API key or network is needed to obtain it (D-01).
 *   - No curated id is a deprecated or non-chat model (D-02/D-05): the assertions
 *     read the CONTENT of the returned arrays, so head-comment prose cannot make a
 *     passing test lie.
 *   - `filterToFrontier` narrows a raw discovered catalog to the curated frontier
 *     set (D-04): it drops the non-chat families (tts/image/embedding/robotics/
 *     lyria/…) and the known-dead UAT id, keeps the curated ids, preserves the
 *     discovered order, and de-duplicates.
 */
import { describe, expect, it } from "vitest";
import { bundledModelsFor, filterToFrontier } from "@/ai/model-registry";
import { AI_PROVIDER_IDS } from "@/services/ai-types";

/**
 * Non-chat / deprecated family tokens that must NEVER appear in a curated list.
 * Defined locally so the assertion is independent of the module under test.
 */
const NON_CHAT_TOKENS = [
  "tts",
  "image",
  "embed",
  "embedding",
  "robotics",
  "lyria",
  "veo",
  "imagen",
  "audio",
  "vision",
  "whisper",
  "dall-e",
  "sora",
  "moderation",
  "realtime",
  "live",
  "computer-use",
  "deep-research",
  "native-audio",
  "guard",
] as const;

describe("bundledModelsFor — bundled default list, no key/network (D-01)", () => {
  it("returns a non-empty, frozen list for each cloud chat provider", () => {
    for (const provider of ["openai", "anthropic", "google"] as const) {
      const list = bundledModelsFor(provider);
      expect(list.length).toBeGreaterThan(0);
      expect(Object.isFrozen(list)).toBe(true);
    }
  });

  it("returns an empty (frozen) list for none and custom (free-text only)", () => {
    for (const provider of ["none", "custom"] as const) {
      const list = bundledModelsFor(provider);
      expect(list).toEqual([]);
      expect(Object.isFrozen(list)).toBe(true);
    }
  });

  it("covers every provider id in the type union (no missing key)", () => {
    for (const provider of AI_PROVIDER_IDS) {
      // Must not throw and must return an array for every declared provider id.
      expect(Array.isArray(bundledModelsFor(provider))).toBe(true);
    }
  });

  it("contains NO non-chat / deprecated family token in any curated id", () => {
    for (const provider of ["openai", "anthropic", "google"] as const) {
      for (const id of bundledModelsFor(provider)) {
        const lower = id.toLowerCase();
        for (const token of NON_CHAT_TOKENS) {
          expect(lower).not.toContain(token);
        }
      }
    }
  });

  it("does NOT contain the known-dead UAT Gemini ids", () => {
    const google = bundledModelsFor("google").map((m) => m.toLowerCase());
    expect(google).not.toContain("gemini-2.5-flash");
    expect(google).not.toContain("gemini-2.5-flash-lite");
  });
});

describe("filterToFrontier — narrow a raw catalog to the frontier set (D-04)", () => {
  it("keeps curated frontier ids and drops non-chat + dead ids, preserving order", () => {
    const curated = bundledModelsFor("google");
    // Interleave the real frontier ids with junk a raw listModels would return.
    const discovered = [
      "gemini-2.5-flash-preview-tts", // tts family → drop
      curated[0], // frontier → keep
      "gemini-embedding-001", // embedding family → drop
      "gemini-2.5-flash", // known-dead (UAT) → drop
      curated[1], // frontier → keep
      "imagen-4.0-generate", // image family → drop
      "gemini-robotics-er-2-preview", // robotics family → drop
      "lyria-3-pro-preview", // lyria family → drop
      curated[2], // frontier → keep
    ];
    const filtered = filterToFrontier("google", discovered);
    // Only the curated ids survive, in their discovered order.
    expect(filtered).toEqual([curated[0], curated[1], curated[2]]);
  });

  it("de-duplicates while preserving first-seen order", () => {
    const curated = bundledModelsFor("openai");
    const discovered = [curated[1], curated[0], curated[1], curated[0]];
    const filtered = filterToFrontier("openai", discovered);
    expect(filtered).toEqual([curated[1], curated[0]]);
  });

  it("matches curated ids case-insensitively", () => {
    const curated = bundledModelsFor("anthropic");
    const filtered = filterToFrontier("anthropic", [curated[0].toUpperCase()]);
    expect(filtered).toEqual([curated[0].toUpperCase()]);
  });

  it("returns an empty frozen list when nothing intersects the frontier", () => {
    const filtered = filterToFrontier("google", [
      "gemini-2.5-flash",
      "text-embedding-004",
    ]);
    expect(filtered).toEqual([]);
    expect(Object.isFrozen(filtered)).toBe(true);
  });

  it("returns empty for none/custom (no curated set to intersect)", () => {
    expect(filterToFrontier("custom", ["anything", "at-all"])).toEqual([]);
    expect(filterToFrontier("none", ["anything"])).toEqual([]);
  });
});
