import { describe, expect, it } from "vitest";

import {
  boundedEditDistance,
  MAX_TOKENIZE_LEN,
  matchCandidateEntries,
  rankCandidates,
  rankCandidatesWithCoverage,
  searchKnowledge,
  TYPO_TWO_EDIT_MIN_LENGTH,
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

  it("counts an adjacent swap as one edit (D-60 restricted Damerau-Levenshtein)", () => {
    expect(boundedEditDistance("gfit", "gift", 1)).toBe(1);
    expect(boundedEditDistance("birthdya", "birthday", 2)).toBe(1);
    expect(boundedEditDistance("brithdya", "birthday", 2)).toBe(2);
    expect(boundedEditDistance("climbing", "climbng")).toBe(1);
    expect(boundedEditDistance("ab", "ba", 1)).toBe(1);
    // A swap is still two edits away from a three-letter rotation.
    expect(boundedEditDistance("abc", "cab", 1)).toBe(2);
  });

  it("uses the D-60 edit-distance threshold boundaries", () => {
    const candidates = [
      { entries: [{ text: "gift birthday" }] },
      { entries: [{ text: "ordinary" }] },
    ];

    expect(rankCandidates("gift", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("gft", candidates)).toEqual([candidates[0]]);
    // D-60: an adjacent swap is one typo, so "gfit" now finds "gift".
    expect(rankCandidates("gfit", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("birthdya", candidates)).toEqual([candidates[0]]);
    expect(rankCandidates("birtxxxx", candidates)).toEqual([]);
  });

  it("allows two typos only from TYPO_TWO_EDIT_MIN_LENGTH letters (D-60)", () => {
    expect(TYPO_TWO_EDIT_MIN_LENGTH).toBe(8);
    // 6 letters, two edits: "denver" no longer matches "dense".
    expect(
      rankCandidates("denver", [{ entries: [{ text: "Dense" }] }]),
    ).toEqual([]);
    // 7 letters, two edits: rejected.
    expect(
      rankCandidates("kitchxx", [{ entries: [{ text: "kitchen" }] }]),
    ).toEqual([]);
    // 8 letters, two edits: matches.
    const birthday = { entries: [{ text: "birthday" }] };
    expect(rankCandidates("birthdxx", [birthday])).toEqual([birthday]);
    // 8 letters, two adjacent swaps: matches.
    expect(rankCandidates("brithdya", [birthday])).toEqual([birthday]);
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

    const ranked = rankCandidatesWithCoverage("garden birthday", [
      partial,
      full,
    ]);
    expect(ranked.map((result) => result.candidate)).toEqual([full, partial]);
    expect(ranked[1]).toMatchObject({ coverage: 1 });
    expect(rankCandidatesWithCoverage("birthdya", [typo])).toHaveLength(1);
    expect(
      rankCandidatesWithCoverage("alex", [substring, exactName]).map(
        (result) => result.candidate,
      ),
    ).toEqual([exactName, substring]);
  });
});
