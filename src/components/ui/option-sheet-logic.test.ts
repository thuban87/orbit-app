import { describe, expect, it } from "vitest";
import { selectorItems } from "@/components/selector-a11y";
import { CATEGORY_SEARCH_THRESHOLD } from "@/logic/category-logic";
import {
  OPTION_SHEET_COMPACT_MAX_ROWS,
  OPTION_SHEET_DETAIL_MAX_ROWS,
  optionKey,
  optionSheetModel,
  optionSheetVariantFor,
  shouldSearch,
} from "./option-sheet-logic";

const CHANNELS = [
  { value: "message", label: "Message" },
  { value: "call", label: "Call" },
  { value: "in_person", label: "In Person" },
  { value: "other", label: "Other" },
];

describe("shouldSearch (D-28: the threshold only decides the search field)", () => {
  it("shows search only above the category threshold by default", () => {
    expect(shouldSearch(CATEGORY_SEARCH_THRESHOLD)).toBe(false);
    expect(shouldSearch(CATEGORY_SEARCH_THRESHOLD + 1)).toBe(true);
    expect(shouldSearch(0)).toBe(false);
  });

  it("accepts an explicit threshold", () => {
    expect(shouldSearch(3, 2)).toBe(true);
    expect(shouldSearch(2, 2)).toBe(false);
  });
});

describe("optionSheetModel", () => {
  it("returns every option in order and marks the selected one", () => {
    const model = optionSheetModel({
      options: CHANNELS,
      selected: "call",
      query: "",
      searchable: false,
    });
    expect(model.rows.map((row) => row.value)).toEqual([
      "message",
      "call",
      "in_person",
      "other",
    ]);
    expect(model.rows.map((row) => row.selected)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("filters by case-insensitive, trimmed label only when searchable", () => {
    const searched = optionSheetModel({
      options: CHANNELS,
      selected: null,
      query: "  PERSON ",
      searchable: true,
    });
    expect(searched.rows.map((row) => row.value)).toEqual(["in_person"]);
    expect(searched.query).toBe("PERSON");

    const notSearchable = optionSheetModel({
      options: CHANNELS,
      selected: null,
      query: "person",
      searchable: false,
    });
    expect(notSearchable.rows).toHaveLength(4);
    expect(notSearchable.query).toBe("");
  });

  it("matches composed and decomposed accents alike (NFC, as category search does)", () => {
    const model = optionSheetModel({
      options: [{ value: 1, label: "Café Friends" }],
      selected: null,
      query: "café",
      searchable: true,
    });
    expect(model.rows.map((row) => row.value)).toEqual([1]);
  });

  it("returns all options for an empty or blank query", () => {
    const model = optionSheetModel({
      options: CHANNELS,
      selected: null,
      query: "   ",
      searchable: true,
    });
    expect(model.rows).toHaveLength(4);
  });

  it("keeps a selection that is filtered out, and one that is not listed at all", () => {
    const hidden = optionSheetModel({
      options: CHANNELS,
      selected: "message",
      query: "call",
      searchable: true,
    });
    expect(hidden.rows.map((row) => row.value)).toEqual(["call"]);
    expect(hidden.rows.some((row) => row.selected)).toBe(false);

    const stale = optionSheetModel({
      options: CHANNELS,
      selected: "gone",
      query: "",
      searchable: false,
    });
    expect(stale.rows.some((row) => row.selected)).toBe(false);
  });

  it("treats null as an ordinary option value (the 'No selection' row)", () => {
    const model = optionSheetModel({
      options: [
        { value: null, label: "No selection" },
        { value: "Charger", label: "Charger" },
      ],
      selected: null,
      query: "",
      searchable: false,
    });
    expect(model.rows.map((row) => row.selected)).toEqual([true, false]);
  });

  it("keeps an out-of-list stored value first and selected when built through selectorItems (RG-030, C5-M2)", () => {
    const stored = "Old club";
    const options = selectorItems(stored, ["School", "Work"]).map((item) => ({
      value: item,
      label: item,
    }));
    const model = optionSheetModel({
      options,
      selected: stored,
      query: "",
      searchable: false,
    });
    expect(model.rows[0]).toMatchObject({ value: stored, selected: true });
    expect(model.rows.map((row) => row.value)).toEqual([
      "Old club",
      "School",
      "Work",
    ]);
  });

  it("does not mutate the caller's options", () => {
    const options = [...CHANNELS];
    optionSheetModel({
      options,
      selected: "call",
      query: "call",
      searchable: true,
    });
    expect(options).toEqual(CHANNELS);
  });
});

describe("optionKey", () => {
  it("gives null, numbers and strings distinct stable keys", () => {
    expect(
      new Set([
        optionKey(null),
        optionKey("null"),
        optionKey(1),
        optionKey("1"),
      ]).size,
    ).toBe(4);
    expect(optionKey("call")).toBe(optionKey("call"));
  });
});

describe("optionSheetVariantFor (38.13 D-71, D-78: sized when it opens)", () => {
  it("opens a short list compact, a medium list at detail, a long list expanded", () => {
    expect(optionSheetVariantFor(3)).toBe("compact");
    expect(optionSheetVariantFor(8)).toBe("detail");
    expect(optionSheetVariantFor(25)).toBe("expanded");
  });

  it("switches exactly at the row thresholds", () => {
    expect(OPTION_SHEET_COMPACT_MAX_ROWS).toBe(5);
    expect(OPTION_SHEET_DETAIL_MAX_ROWS).toBe(10);
    expect(optionSheetVariantFor(0)).toBe("compact");
    expect(optionSheetVariantFor(OPTION_SHEET_COMPACT_MAX_ROWS)).toBe(
      "compact",
    );
    expect(optionSheetVariantFor(OPTION_SHEET_COMPACT_MAX_ROWS + 1)).toBe(
      "detail",
    );
    expect(optionSheetVariantFor(OPTION_SHEET_DETAIL_MAX_ROWS)).toBe("detail");
    expect(optionSheetVariantFor(OPTION_SHEET_DETAIL_MAX_ROWS + 1)).toBe(
      "expanded",
    );
  });
});
