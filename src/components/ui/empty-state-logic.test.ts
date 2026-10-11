import { describe, expect, it } from "vitest";
import {
  emptyStateHeading,
  SEARCH_ECHO_MAX_CHARS,
  truncateSearchEcho,
} from "./empty-state-logic";

describe("truncateSearchEcho (D-20)", () => {
  it("keeps a short term whole", () => {
    expect(truncateSearchEcho("abc")).toBe("abc");
  });

  it("keeps a term exactly at the limit whole", () => {
    const term = "a".repeat(SEARCH_ECHO_MAX_CHARS);
    expect(truncateSearchEcho(term)).toBe(term);
  });

  it("cuts a long term to the first 40 characters plus an ellipsis", () => {
    const term = "x".repeat(60);
    expect(SEARCH_ECHO_MAX_CHARS).toBe(40);
    expect(truncateSearchEcho(term)).toBe(`${"x".repeat(40)}…`);
  });

  it("trims surrounding whitespace before measuring", () => {
    expect(truncateSearchEcho("  alex  ")).toBe("alex");
  });
});

describe("emptyStateHeading (D-20)", () => {
  it("returns the heading alone without a term", () => {
    expect(emptyStateHeading("No events yet")).toBe("No events yet");
    expect(emptyStateHeading("No events yet", "   ")).toBe("No events yet");
  });

  it("echoes the term in quotes after the heading", () => {
    expect(emptyStateHeading("No matches for", "alex")).toBe(
      'No matches for "alex"',
    );
  });

  it("echoes a long term truncated", () => {
    expect(emptyStateHeading("No matches for", "y".repeat(50))).toBe(
      `No matches for "${"y".repeat(40)}…"`,
    );
  });
});
