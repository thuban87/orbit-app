import { describe, expect, it } from "vitest";
import { selectorItems } from "@/components/selector-a11y";
import { CATEGORY_SEARCH_THRESHOLD } from "@/logic/category-logic";
import {
  type OptionSheetFitInput,
  optionKey,
  optionRowPitch,
  optionSheetChromeHeight,
  optionSheetContentHeight,
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

describe("optionSheetVariantFor (38.13 D-71, D-78, D-85: sized from row height)", () => {
  // Test-phone windows in dp (review B-WR-02 arithmetic): Pixel 6 Pro and
  // Pixel 3a, gesture-nav bottom inset about 24.
  const PIXEL_6_PRO = { windowHeight: 891, windowWidth: 412 };
  const PIXEL_3A = { windowHeight: 807, windowWidth: 393 };
  const labels = (count: number, name = "Family") =>
    Array.from({ length: count }, (_, i) => `${name} ${i + 1}`);
  const sized = (
    count: number,
    over: Partial<OptionSheetFitInput> = {},
  ): OptionSheetFitInput => ({
    labels: labels(count),
    searchable: false,
    fontScale: 1,
    bottomInset: 24,
    ...PIXEL_6_PRO,
    ...over,
  });
  const cap = (variant: "compact" | "detail", windowHeight: number) =>
    (variant === "compact" ? 0.4 : 0.6) * windowHeight;

  it("reads the render geometry: a 52dp row pitch and the sheet chrome at default text", () => {
    // minHeight 44 (body line 24 + 2 x 8 padding = 40 < 44) plus 8 below.
    expect(optionRowPitch("Family", 412, 1)).toBe(52);
    // handle 24 + heading 25 + gap 12 + body padding 24 + inset 24 + slack 8.
    expect(
      optionSheetChromeHeight({
        searchable: false,
        fontScale: 1,
        bottomInset: 24,
      }),
    ).toBe(117);
  });

  it("opens the default 4 categories + Uncategorized at detail, where all 5 rows fit (B-WR-02)", () => {
    // 5 x 52 + 117 = 377: over the 40% compact cap on both phones.
    expect(optionSheetVariantFor(sized(5))).toBe("detail");
    expect(optionSheetVariantFor(sized(5, PIXEL_3A))).toBe("detail");
    expect(optionSheetContentHeight(sized(5))).toBeLessThanOrEqual(
      cap("detail", PIXEL_6_PRO.windowHeight),
    );
  });

  it("opens a short list compact when it really fits", () => {
    expect(optionSheetVariantFor(sized(3))).toBe("compact");
    expect(optionSheetVariantFor(sized(3, PIXEL_3A))).toBe("compact");
    expect(optionSheetVariantFor(sized(0))).toBe("compact");
  });

  it("opens expanded (scrolling) when no sized sheet holds every row", () => {
    // 9 x 52 + 117 = 585 > 60% of 891 (534.6).
    expect(optionSheetVariantFor(sized(9))).toBe("expanded");
    expect(optionSheetVariantFor(sized(25))).toBe("expanded");
  });

  it("always picks the smallest size whose cap holds every row", () => {
    for (const phone of [PIXEL_6_PRO, PIXEL_3A]) {
      for (const fontScale of [0.85, 1, 1.3, 2]) {
        for (let count = 0; count <= 16; count += 1) {
          const input = sized(count, { ...phone, fontScale });
          const needed = optionSheetContentHeight(input);
          const variant = optionSheetVariantFor(input);
          const compact = cap("compact", phone.windowHeight);
          const detail = cap("detail", phone.windowHeight);
          if (variant === "compact")
            expect(needed).toBeLessThanOrEqual(compact);
          if (variant === "detail") {
            expect(needed).toBeGreaterThan(compact);
            expect(needed).toBeLessThanOrEqual(detail);
          }
          if (variant === "expanded") expect(needed).toBeGreaterThan(detail);
        }
      }
    }
  });

  it("counts large text: the same list needs a bigger sheet at a higher font scale", () => {
    expect(optionSheetVariantFor(sized(3))).toBe("compact");
    expect(optionSheetVariantFor(sized(3, { fontScale: 2 }))).toBe("detail");
    expect(optionRowPitch("Family", 412, 2)).toBe(48 + 16 + 8);
  });

  it("counts a long label that wraps as a taller row", () => {
    const long = "A very long category name that will not fit on one line";
    expect(optionRowPitch(long, 412, 1)).toBeGreaterThan(
      optionRowPitch("Family", 412, 1),
    );
  });

  it("counts the search field when the list is searchable", () => {
    expect(
      optionSheetChromeHeight({
        searchable: true,
        fontScale: 1,
        bottomInset: 0,
      }),
    ).toBeGreaterThan(
      optionSheetChromeHeight({
        searchable: false,
        fontScale: 1,
        bottomInset: 0,
      }),
    );
  });
});
