import { describe, expect, it } from "vitest";
import { selectedFilterLabels } from "./filter-summary";

const categories = [
  { id: 1, name: "Family" },
  { id: 2, name: "Friends" },
];

describe("selectedFilterLabels", () => {
  it("returns selected labels from one family", () => {
    expect(selectedFilterLabels({ "social-battery": ["Charger"] }, categories)).toEqual(["Charger"]);
  });

  it("orders mixed families and resolves category ids", () => {
    expect(selectedFilterLabels({
      category: ["2", "1"],
      "social-battery": ["Drain", "Charger"],
      "needs-attention": ["on"],
      gravity: ["deep", "thin"],
      "contact-frequency": ["yearly", "weekly"],
    }, categories)).toEqual([
      "Friends", "Family", "Charger", "Drain", "Needs attention", "Thin", "Deep", "Weekly", "Yearly",
    ]);
  });

  it("skips an unknown category id", () => {
    expect(selectedFilterLabels({ category: ["999"] }, categories)).toEqual([]);
  });

  it("returns no labels for empty filters", () => {
    expect(selectedFilterLabels({}, categories)).toEqual([]);
  });
});
