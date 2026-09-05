import { describe, expect, it } from "vitest";
import type { UnboundRow } from "@/db/unbound-read";
import {
  filterUnboundByName,
  unboundCountLabel,
} from "./unbound-list-logic";

function row(id: number, name: string): UnboundRow {
  return {
    id,
    name,
    photo: null,
    modified_at: "2026-09-05T00:00:00.000Z",
    trackingEnabled: 0,
    favourite_rank: null,
    status: null,
    progress: null,
  };
}

describe("filterUnboundByName", () => {
  const rows = [row(1, "Joanna"), row(2, "ANNA"), row(3, "Bryn")];

  it("returns the same rows for empty or whitespace-only terms", () => {
    expect(filterUnboundByName(rows, "")).toBe(rows);
    expect(filterUnboundByName(rows, "  \t ")).toBe(rows);
  });

  it("matches name substrings case-insensitively", () => {
    expect(filterUnboundByName(rows, "ann").map(({ id }) => id)).toEqual([1, 2]);
  });

  it("preserves surviving input order without mutating the input", () => {
    const original = [...rows];

    expect(filterUnboundByName(rows, "a").map(({ id }) => id)).toEqual([1, 2]);
    expect(rows).toEqual(original);
  });

  it("handles empty and single-row inputs", () => {
    expect(filterUnboundByName([], "ann")).toEqual([]);
    expect(filterUnboundByName([row(4, "Ann")], "ann")).toHaveLength(1);
  });

  it("returns an empty array when no names match", () => {
    expect(filterUnboundByName(rows, "zoe")).toEqual([]);
  });
});

describe("unboundCountLabel", () => {
  it("keeps the existing singular and plural unbound-contact labels by default", () => {
    expect(unboundCountLabel(0)).toBe("0 unbound contacts");
    expect(unboundCountLabel(1)).toBe("1 unbound contact");
    expect(unboundCountLabel(2)).toBe("2 unbound contacts");
  });

  it("uses matching-count copy for every count when requested", () => {
    expect(unboundCountLabel(0, { matching: true })).toBe("0 matching");
    expect(unboundCountLabel(1, { matching: true })).toBe("1 matching");
    expect(unboundCountLabel(2, { matching: true })).toBe("2 matching");
  });
});
