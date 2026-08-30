import { describe, expect, it } from "vitest";
import {
  filterRows,
  matchesQuery,
  selectionCount,
  toggleSelection,
} from "./contact-picker-selection";
import type { ContactPickerRow } from "./contact-picker-source";

const rows: ContactPickerRow[] = [
  {
    lookupKey: "ada",
    displayName: "Ada Lovelace",
    primaryMethod: "+1 555 0100",
    searchMethods: ["+1 555 0100", "+1 555 0111", "ada@example.com"],
    photoThumbUri: null,
  },
  {
    lookupKey: "grace",
    displayName: "Grace Hopper",
    primaryMethod: null,
    searchMethods: [],
    photoThumbUri: null,
  },
];

describe("contact picker selection", () => {
  it("toggles lookup keys and reports count", () => {
    const selected = toggleSelection(new Set(), "ada");
    expect(selectionCount(selected)).toBe(1);
    expect(toggleSelection(selected, "ada")).toEqual(new Set());
  });

  it.each([
    ["lovel", true],
    ["0100", true],
    ["0111", true],
    ["example.com", true],
    ["missing", false],
  ])("matches name and all method values: %s", (term, expected) => {
    expect(matchesQuery(rows[0], term)).toBe(expected);
  });

  it("passes every row through for an empty term", () => {
    expect(filterRows(rows, "  ")).toEqual(rows);
  });
});
