import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type BulkMoreSheetFitInput,
  bulkMoreSheetContentHeight,
  bulkMoreSheetVariantFor,
  type SnoozeSheetFitInput,
  snoozeSheetContentHeight,
  snoozeSheetVariantFor,
} from "./bulk-sheet-fit";
import {
  optionSheetVariantFor,
  sizedSheetVariantFor,
} from "./ui/option-sheet-logic";

// Test-phone windows in dp (as option-sheet-logic.test.ts): Pixel 6 Pro and
// Pixel 3a, gesture-nav bottom inset about 24.
const PIXEL_6_PRO = { windowHeight: 891, windowWidth: 412 };
const PIXEL_3A = { windowHeight: 807, windowWidth: 393 };
const PHONES = [PIXEL_6_PRO, PIXEL_3A];
const cap = (variant: "compact" | "detail", windowHeight: number) =>
  (variant === "compact" ? 0.4 : 0.6) * windowHeight;

// The More… rows as BulkActionSurface draws them (D-75).
const MORE_WITH_REMOVE = [
  "Log Interaction",
  "Remove from Favorites",
  "Set Category",
  "Change Contact Frequency",
  "Move to Bin",
];
const MORE_WITHOUT_REMOVE = MORE_WITH_REMOVE.filter(
  (label) => label !== "Remove from Favorites",
);
const more = (
  over: Partial<BulkMoreSheetFitInput> = {},
): BulkMoreSheetFitInput => ({
  title: "3 selected",
  rowLabels: MORE_WITH_REMOVE,
  sectionLabel: "CAREFUL ACTIONS",
  fontScale: 1,
  bottomInset: 24,
  ...PIXEL_6_PRO,
  ...over,
});

// SNOOZE_CHOICES labels.
const CHOICES = [
  "3 days",
  "1 week",
  "1 month",
  "Until I turn it off",
  "Choose date",
];
const snooze = (
  over: Partial<SnoozeSheetFitInput> = {},
): SnoozeSheetFitInput => ({
  title: "Snooze 3 contacts",
  showCurrent: false,
  choiceLabels: CHOICES,
  showUnsnooze: false,
  fontScale: 1,
  bottomInset: 24,
  ...PIXEL_6_PRO,
  ...over,
});

describe("one sized-sheet rule (38.13 D-85, D-87)", () => {
  it("optionSheetVariantFor and the bulk sheets share sizedSheetVariantFor's caps", () => {
    expect(sizedSheetVariantFor(cap("compact", 891), 891)).toBe("compact");
    expect(sizedSheetVariantFor(cap("compact", 891) + 1, 891)).toBe("detail");
    expect(sizedSheetVariantFor(cap("detail", 891), 891)).toBe("detail");
    expect(sizedSheetVariantFor(cap("detail", 891) + 1, 891)).toBe("expanded");
    // The Set Category sheet's answer is unchanged by the refactor (B-WR-02).
    expect(
      optionSheetVariantFor({
        labels: ["Family 1", "Family 2", "Family 3", "Family 4", "Family 5"],
        searchable: false,
        fontScale: 1,
        bottomInset: 24,
        ...PIXEL_6_PRO,
      }),
    ).toBe("detail");
  });
});

describe("More… sheet opens sized to its rows (38.13 D-87, amends D-71)", () => {
  it("is never compact once Remove from Favorites is listed, at 1.0 and 1.15 on both phones (DEF-02: Move to Bin was cut)", () => {
    for (const phone of PHONES) {
      for (const fontScale of [1, 1.15]) {
        const input = more({ ...phone, fontScale });
        expect(bulkMoreSheetVariantFor(input)).not.toBe("compact");
        // ...and the sheet it picks holds every row, Move to Bin included.
        expect(bulkMoreSheetVariantFor(input)).toBe("detail");
        expect(bulkMoreSheetContentHeight(input)).toBeLessThanOrEqual(
          cap("detail", phone.windowHeight),
        );
      }
    }
  });

  it("reads the render geometry at default text", () => {
    // handle 24 + body padding 24 + inset 24 + slack 8 = 80 chrome;
    // title 25 + 8; 5 rows x (52 + 1 hairline); careful heading 16 + 20.
    expect(bulkMoreSheetContentHeight(more())).toBe(80 + 33 + 5 * 53 + 36);
  });

  it("stays compact when every row fits (a tall window)", () => {
    const tall = { windowHeight: 1200, windowWidth: 412 };
    expect(
      bulkMoreSheetVariantFor(
        more({ ...tall, rowLabels: MORE_WITHOUT_REMOVE }),
      ),
    ).toBe("compact");
  });

  it("always picks the smallest size whose cap holds the sheet", () => {
    for (const phone of PHONES) {
      for (const fontScale of [0.85, 1, 1.15, 1.3, 2]) {
        for (const rowLabels of [MORE_WITH_REMOVE, MORE_WITHOUT_REMOVE]) {
          const input = more({ ...phone, fontScale, rowLabels });
          const needed = bulkMoreSheetContentHeight(input);
          const variant = bulkMoreSheetVariantFor(input);
          if (variant === "compact")
            expect(needed).toBeLessThanOrEqual(
              cap("compact", phone.windowHeight),
            );
          if (variant === "detail") {
            expect(needed).toBeGreaterThan(cap("compact", phone.windowHeight));
            expect(needed).toBeLessThanOrEqual(
              cap("detail", phone.windowHeight),
            );
          }
          if (variant === "expanded")
            expect(needed).toBeGreaterThan(cap("detail", phone.windowHeight));
        }
      }
    }
  });

  it("counts large text and a label that wraps", () => {
    expect(bulkMoreSheetContentHeight(more({ fontScale: 2 }))).toBeGreaterThan(
      bulkMoreSheetContentHeight(more({ fontScale: 1.15 })),
    );
    expect(
      bulkMoreSheetContentHeight(
        more({
          rowLabels: [
            "A label long enough to wrap onto a third line in the More sheet row at the default text size",
          ],
        }),
      ),
    ).toBeGreaterThan(
      bulkMoreSheetContentHeight(more({ rowLabels: ["Set Category"] })),
    );
  });
});

describe("bulk Snooze sheet opens sized to its rows (38.13 D-87, amends D-71)", () => {
  it("holds Close at 1.0 and 1.15 on both phones without scrolling (DEF-02: Close was below the fold at 1.15)", () => {
    for (const phone of PHONES) {
      for (const fontScale of [1, 1.15]) {
        for (const showUnsnooze of [false, true]) {
          const input = snooze({ ...phone, fontScale, showUnsnooze });
          const variant = snoozeSheetVariantFor(input);
          const needed = snoozeSheetContentHeight(input);
          if (variant !== "expanded") {
            expect(needed).toBeLessThanOrEqual(
              cap(variant, phone.windowHeight),
            );
          } else {
            // Expanded is the fixed 92% sheet: it holds the whole sheet too.
            expect(needed).toBeLessThanOrEqual(0.92 * phone.windowHeight);
          }
        }
      }
    }
    // The 6 Pro at 1.15 no longer opens compact (the walk's defect).
    expect(snoozeSheetVariantFor(snooze({ fontScale: 1.15 }))).not.toBe(
      "compact",
    );
  });

  it("reads the render geometry at default text", () => {
    // chrome 80; heading 25; 5 choices x (44 + 2 border); Close 8 + 46;
    // 6 gaps x 8; padding 16.
    expect(snoozeSheetContentHeight(snooze())).toBe(
      80 + 25 + 5 * 46 + 8 + 46 + 6 * 8 + 16,
    );
  });

  it("counts Unsnooze and the current line", () => {
    const base = snoozeSheetContentHeight(snooze());
    expect(snoozeSheetContentHeight(snooze({ showUnsnooze: true }))).toBe(
      base + 46 + 8,
    );
    expect(snoozeSheetContentHeight(snooze({ showCurrent: true }))).toBe(
      base + 24 + 8,
    );
  });

  it("always picks the smallest size whose cap holds the sheet", () => {
    for (const phone of PHONES) {
      for (const fontScale of [0.85, 1, 1.15, 1.3, 2]) {
        const input = snooze({ ...phone, fontScale, showUnsnooze: true });
        const needed = snoozeSheetContentHeight(input);
        const variant = snoozeSheetVariantFor(input);
        if (variant === "compact")
          expect(needed).toBeLessThanOrEqual(
            cap("compact", phone.windowHeight),
          );
        if (variant === "detail") {
          expect(needed).toBeGreaterThan(cap("compact", phone.windowHeight));
          expect(needed).toBeLessThanOrEqual(cap("detail", phone.windowHeight));
        }
        if (variant === "expanded")
          expect(needed).toBeGreaterThan(cap("detail", phone.windowHeight));
      }
    }
  });
});

describe("the sheets lay out from the geometry the prediction reads (D-87)", () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), "utf8");

  it("BulkActionSurface sizes More… with bulkMoreSheetVariantFor and styles its rows from the shared constants", () => {
    const source = read("./BulkActionSurface.tsx");
    expect(source).toContain(
      'variant={moreVariant === "compact" ? "compact" : "detail"}',
    );
    expect(source).toContain('moreVariant === "expanded" ? (');
    expect(source).toContain("const moreVariant = bulkMoreSheetVariantFor({");
    expect(source).toContain("minHeight: BULK_MORE_ROW_MIN_HEIGHT,");
    expect(source).toContain("gap: BULK_MORE_ROW_ICON_GAP,");
    expect(source).toContain("marginBottom: BULK_MORE_TITLE_GAP,");
    expect(source).toContain("marginTop: BULK_MORE_SECTION_GAP,");
    expect(source).not.toMatch(/variant="compact"/);
  });

  it("SnoozeSheet sizes itself only when asked and styles from the shared constants", () => {
    const source = read("./SnoozeSheet.tsx");
    expect(source).toContain("sizeToContent = false,");
    expect(source).toContain(
      'variant={variant === "compact" ? "compact" : "detail"}',
    );
    expect(source).toContain('return variant === "expanded" ? (');
    expect(source).toContain("minHeight: SNOOZE_CHOICE_MIN_HEIGHT,");
    expect(source).toContain("borderWidth: SNOOZE_CHOICE_BORDER_WIDTH,");
    expect(source).toContain("gap: SNOOZE_SHEET_GAP,");
    expect(source).toContain("marginTop: SNOOZE_CLOSE_MARGIN_TOP");
  });

  it("only the Contacts bulk Snooze opts in; the card sheet stays compact", () => {
    const home = read("../screens/HomeScreen.tsx");
    expect(home.match(/<SnoozeSheet/g)).toHaveLength(2);
    const card = home.indexOf("38.11 D-45/D-81 (review V-07");
    expect(card).toBeGreaterThan(-1);
    const cardBlock = home.slice(
      card,
      home.indexOf("onClose={() => setCardSnooze(null)}", card),
    );
    expect(cardBlock).not.toContain("sizeToContent");
    const bulk = home.indexOf("38.11 D-45/D-82 (review U-01, V-08)");
    expect(bulk).toBeGreaterThan(-1);
    expect(home.indexOf("sizeToContent", bulk)).toBeLessThan(
      home.indexOf("onClose={closeBulkSnoozePicker}", bulk),
    );
  });
});
