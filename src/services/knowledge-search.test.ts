import { describe, expect, it } from "vitest";

import {
  boundedEditDistance,
  matchCandidateEntries,
  MAX_TOKENIZE_LEN,
  rankCandidates,
  rankCandidatesWithCoverage,
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

  it("reports per-entry raw-text highlight offsets through the shared tokenizer", () => {
    const entry = { text: "Meet at café tomorrow" };

    expect(matchCandidateEntries("cafe", [entry])).toEqual([
      expect.objectContaining({
        entry,
        termMatches: [
          expect.objectContaining({
            term: "cafe",
            score: 4,
            highlights: [{ start: 8, length: 4 }],
          }),
        ],
      }),
    ]);
  });

  it("ranks coverage before strength without excluding partial matches", () => {
    const full = { entries: [{ text: "garden birthday" }] };
    const partial = { entries: [{ text: "garden" }] };
    const typo = { entries: [{ text: "birthday" }] };
    const exactName = { entries: [{ text: "Alex", source: "name" }] };
    const substring = { entries: [{ text: "Alexandria" }] };

    const ranked = rankCandidatesWithCoverage("garden birthday", [partial, full]);
    expect(ranked.map((result) => result.candidate)).toEqual([full, partial]);
    expect(ranked[1]).toMatchObject({ coverage: 1 });
    expect(rankCandidatesWithCoverage("birthdya", [typo])).toHaveLength(1);
    expect(rankCandidatesWithCoverage("alex", [substring, exactName]).map(
      (result) => result.candidate,
    )).toEqual([exactName, substring]);
  });
});
