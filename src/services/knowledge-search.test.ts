import { describe, expect, it } from "vitest";

import {
  boundedEditDistance,
  searchKnowledge,
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
});
