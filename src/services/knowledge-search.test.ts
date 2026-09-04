import { describe, expect, it } from "vitest";

import {
  boundedEditDistance,
  MAX_TOKENIZE_LEN,
  rankCandidates,
  searchKnowledge,
  tokenize,
} from "@/services/knowledge-search";

describe("knowledge search scorer", () => {
  const corpus = [
    { custom_label: "Hobby", value: "Climbing on Sundays", note: null },
    { custom_label: null, value: "Gardening", note: "Native plants" },
  ];

  it("matches prefix, substring, and one-edit typo terms without SQL", () => {
    expect(searchKnowledge(corpus, "climb")).toEqual([corpus[0]]);
    expect(searchKnowledge(corpus, "Sunday")).toEqual([corpus[0]]);
    expect(searchKnowledge(corpus, "climbng")).toEqual([corpus[0]]);
  });

  it("bounds edit-distance work and rejects distant terms", () => {
    expect(boundedEditDistance("climbing", "climbng")).toBe(1);
    expect(boundedEditDistance("climbing", "gardening")).toBeGreaterThan(1);
    expect(searchKnowledge(corpus, "zzzzzz")).toEqual([]);
  });

  it("uses the D-07 edit-distance threshold boundaries", () => {
    const candidates = [
      { entries: [{ text: "gift birthday" }] },
      { entries: [{ text: "ordinary" }] },
    ];

    expect(rankCandidates("gift", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("gft", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("gfit", candidates)).toEqual([]);
    expect(rankCandidates("birthdya", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("birtxxxx", candidates)).toEqual([]);
  });

  it("matches prefixes and substrings, with AND semantics across query terms", () => {
    const candidates = [
      { entries: [{ text: "gift birthday" }] },
      { entries: [{ text: "gift anniversary" }] },
    ];

    expect(rankCandidates("bir", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("day", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("gft bir", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("   ", candidates)).toEqual([]);
  });

  it("shares one folded, punctuation-aware tokenizer for queries and corpus text", () => {
    expect(
      tokenize("O'Connor a@b.co https://example.com:8080/path café"),
    ).toEqual([
      "o",
      "connor",
      "a",
      "b",
      "co",
      "https",
      "example",
      "com",
      "8080",
      "path",
      "cafe",
    ]);
    expect(tokenize("x".repeat(MAX_TOKENIZE_LEN + 5))).toEqual([
      "x".repeat(MAX_TOKENIZE_LEN),
    ]);
  });
});
