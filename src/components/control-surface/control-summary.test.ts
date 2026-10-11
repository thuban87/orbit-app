import { describe, expect, it } from "vitest";
import { collapseSummary } from "./control-summary";

describe("collapseSummary", () => {
  it("returns an empty string for the caller's default-label path", () => {
    expect(collapseSummary([], 2)).toBe("");
  });

  it("keeps every name at the exact display boundary", () => {
    expect(collapseSummary(["Favorites", "Birthdays"], 2)).toBe(
      "Favorites, Birthdays",
    );
  });

  it("preserves input order and collapses additional elements", () => {
    expect(collapseSummary(["Birthdays", "Favorites", "Snoozed"], 2)).toBe(
      "Birthdays, Favorites +1",
    );
  });

  it("counts names rather than their character or grapheme length", () => {
    expect(collapseSummary(["Élodie", "👋 Friends", "Snoozed"], 2)).toBe(
      "Élodie, 👋 Friends +1",
    );
  });
});
