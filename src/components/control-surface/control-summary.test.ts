import { describe, expect, it } from "vitest";
import { collapseSummary } from "./control-summary";

describe("collapseSummary", () => {
  it("returns an empty string for the caller's default-label path", () => {
    expect(collapseSummary([], 2)).toBe("");
  });

  it("keeps every name at the exact display boundary", () => {
    expect(collapseSummary(["Favourites", "Birthdays"], 2)).toBe("Favourites, Birthdays");
  });

  it("preserves input order and collapses additional elements", () => {
    expect(collapseSummary(["Birthdays", "Favourites", "Snoozed"], 2)).toBe(
      "Birthdays, Favourites +1",
    );
  });

  it("counts names rather than their character or grapheme length", () => {
    expect(collapseSummary(["Élodie", "👋 Friends", "Snoozed"], 2)).toBe(
      "Élodie, 👋 Friends +1",
    );
  });
});
