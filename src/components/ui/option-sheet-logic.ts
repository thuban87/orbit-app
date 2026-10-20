/**
 * Option sheet model (38.9 D-28). PURE — no react-native import,
 * node-testable. `OptionSheet` renders what this returns.
 *
 * One themed single-choice sheet serves every list length. The category
 * threshold (`CATEGORY_SEARCH_THRESHOLD`) no longer chooses a native spinner
 * versus the themed sheet; it only decides whether the sheet shows a search
 * field (`shouldSearch`).
 *
 * Search matches the option label, trimmed, NFC-normalised and
 * case-insensitive — the same rule as `filterCategoryChoices`, so category
 * search behaves as it did. A selected value that is filtered out, or not
 * listed at all, is never cleared: the model only marks rows, it never
 * rewrites the selection. Out-of-list stored values (custom-field dropdowns)
 * are listed by the caller through `selectorItems` (RG-030), not here.
 */
import { CATEGORY_SEARCH_THRESHOLD } from "@/logic/category-logic";
import { ICON_SIZE } from "@/theme/tokens/icon-size";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import {
  SHEET_BODY_PADDING_BOTTOM,
  SHEET_BODY_PADDING_HORIZONTAL,
  SHEET_HANDLE_BLOCK_HEIGHT,
  SHEET_HEIGHT_PERCENT,
} from "./sheet-contract";

/*
 * Option-sheet geometry (tunables; 38.13 D-85). `OptionSheet.tsx` lays its
 * rows, section gap and search floor out from these values, so the sized-sheet
 * prediction below reads the same numbers the render uses.
 */
/** A row's touch-target floor (dp). */
export const OPTION_ROW_MIN_HEIGHT = 44;
/** A row's vertical padding, each side (dp). */
export const OPTION_ROW_PADDING_VERTICAL = SPACING.sm;
/** A row's horizontal padding, each side (dp). */
export const OPTION_ROW_PADDING_HORIZONTAL = SPACING.md;
/** The space below every row, the last one included (dp). */
export const OPTION_ROW_SPACING = SPACING.sm;
/** Room a row keeps for the selected glyph and its gap (dp). */
export const OPTION_ROW_GLYPH_RESERVE = ICON_SIZE.md + SPACING.sm;
/** Gap between the heading, the search field and the list (dp). */
export const OPTION_SHEET_SECTION_GAP = SPACING.md;
/** The search field's floor (dp). */
export const OPTION_SEARCH_MIN_HEIGHT = 44;
/**
 * The search field's predicted vertical padding, each side (dp): the field
 * sets none, so Android's default text-field padding applies; this errs high.
 */
export const OPTION_SEARCH_PADDING_ESTIMATE = SPACING.md;
/**
 * Average glyph width as a share of the font size, used to predict when a row
 * label wraps (deliberately wide, so a prediction errs toward a taller sheet).
 */
export const OPTION_LABEL_CHAR_WIDTH_RATIO = 0.6;
/**
 * Spare height the prediction keeps for hairline borders and rounding (dp),
 * so a list that only just fits still opens with its last row whole.
 */
export const OPTION_SHEET_FIT_SLACK = SPACING.sm;

/** Inputs to the sized-sheet prediction (38.13 D-71, D-78, D-85). */
export interface OptionSheetFitInput {
  /** The row labels, unfiltered (a search never resizes an open sheet). */
  labels: readonly string[];
  /** Whether the sheet shows its search field. */
  searchable: boolean;
  /** Window size in dp (`useWindowDimensions`). */
  windowHeight: number;
  windowWidth: number;
  /** The OS text scale (`useWindowDimensions().fontScale`); AppText honours it. */
  fontScale: number;
  /** Bottom safe-area inset in dp; the Sheet pads its bottom edge by it. */
  bottomInset: number;
}

/** A text role's line height at the OS text scale (dp; never below 1×). */
export function scaledLineHeight(
  lineHeight: number,
  fontScale: number,
): number {
  return Math.ceil(lineHeight * Math.max(1, fontScale));
}
const scaledLine = scaledLineHeight;

/**
 * Lines `text` is predicted to take in `available` dp at `fontSize` and the
 * OS text scale (38.13 D-85, D-87). The glyph width is the deliberately wide
 * `OPTION_LABEL_CHAR_WIDTH_RATIO` plus any unscaled `letterSpacing`, so a
 * prediction errs toward a taller sheet.
 */
export function predictedTextLines(
  text: string,
  available: number,
  fontSize: number,
  fontScale: number,
  letterSpacing = 0,
): number {
  const charWidth =
    fontSize * Math.max(1, fontScale) * OPTION_LABEL_CHAR_WIDTH_RATIO +
    letterSpacing;
  if (available <= charWidth) return Math.max(1, text.length);
  const perLine = Math.floor(available / charWidth);
  return Math.max(1, Math.ceil(text.length / perLine));
}

/** Lines a row label is predicted to take at this width and text scale. */
export function optionLabelLines(
  label: string,
  windowWidth: number,
  fontScale: number,
): number {
  const available =
    windowWidth -
    2 * SHEET_BODY_PADDING_HORIZONTAL -
    2 * OPTION_ROW_PADDING_HORIZONTAL -
    OPTION_ROW_GLYPH_RESERVE;
  return predictedTextLines(label, available, TYPOGRAPHY.body.size, fontScale);
}

/** Height one row takes in the list, its spacing below included (dp). */
export function optionRowPitch(
  label: string,
  windowWidth: number,
  fontScale: number,
): number {
  const text =
    optionLabelLines(label, windowWidth, fontScale) *
    scaledLine(TYPOGRAPHY.body.lineHeight, fontScale);
  const row = Math.max(
    OPTION_ROW_MIN_HEIGHT,
    text + 2 * OPTION_ROW_PADDING_VERTICAL,
  );
  return row + OPTION_ROW_SPACING;
}

/** Everything a sized option sheet draws besides its rows (dp). */
export function optionSheetChromeHeight({
  searchable,
  fontScale,
  bottomInset,
}: Pick<
  OptionSheetFitInput,
  "searchable" | "fontScale" | "bottomInset"
>): number {
  const heading = scaledLine(TYPOGRAPHY.heading.lineHeight, fontScale);
  const search = searchable
    ? Math.max(
        OPTION_SEARCH_MIN_HEIGHT,
        scaledLine(TYPOGRAPHY.body.lineHeight, fontScale) +
          2 * OPTION_SEARCH_PADDING_ESTIMATE,
      ) + OPTION_SHEET_SECTION_GAP
    : 0;
  return (
    SHEET_HANDLE_BLOCK_HEIGHT +
    heading +
    OPTION_SHEET_SECTION_GAP +
    search +
    SHEET_BODY_PADDING_BOTTOM +
    Math.max(0, bottomInset) +
    OPTION_SHEET_FIT_SLACK
  );
}

/** The full height a sized option sheet needs to show every row (dp). */
export function optionSheetContentHeight(input: OptionSheetFitInput): number {
  const rows = input.labels.reduce(
    (sum, label) =>
      sum + optionRowPitch(label, input.windowWidth, input.fontScale),
    0,
  );
  return rows + optionSheetChromeHeight(input);
}

function sheetCap(variant: "compact" | "detail", windowHeight: number): number {
  return (
    (Number.parseFloat(SHEET_HEIGHT_PERCENT[variant]) / 100) * windowHeight
  );
}

/** The size a sized sheet opens at. */
export type SizedSheetVariant = "compact" | "detail" | "expanded";

/**
 * The one sized-sheet rule (38.13 D-85; D-87 for More… and bulk Snooze): the
 * smallest of compact and detail whose height cap (`SHEET_HEIGHT_PERCENT`,
 * against the window) holds `needed` dp, decided when the sheet opens. A sheet
 * that fits neither opens expanded and scrolls.
 */
export function sizedSheetVariantFor(
  needed: number,
  windowHeight: number,
): SizedSheetVariant {
  if (needed <= sheetCap("compact", windowHeight)) return "compact";
  if (needed <= sheetCap("detail", windowHeight)) return "detail";
  return "expanded";
}

/**
 * The size a sized option sheet opens at (38.13 D-71, D-78, D-85; the bulk Set
 * Category sheet only): the smallest of compact and detail whose height cap
 * (`SHEET_HEIGHT_PERCENT`, against the window) holds every row and the sheet's
 * chrome at the current text scale, decided when it opens. A list that fits
 * neither opens expanded and scrolls. Every other option sheet stays expanded
 * (ADR-204 L1).
 */
export function optionSheetVariantFor(
  input: OptionSheetFitInput,
): SizedSheetVariant {
  return sizedSheetVariantFor(
    optionSheetContentHeight(input),
    input.windowHeight,
  );
}

/** The value types an option sheet can choose between. */
export type OptionValue = string | number | null;

export interface OptionSheetOption<T extends OptionValue> {
  value: T;
  label: string;
  /** Overrides the row's spoken name; defaults to `label`. */
  accessibilityLabel?: string;
}

export interface OptionSheetRow<T extends OptionValue>
  extends OptionSheetOption<T> {
  selected: boolean;
}

export interface OptionSheetModel<T extends OptionValue> {
  rows: OptionSheetRow<T>[];
  /** The trimmed query actually applied ("" when not searchable). */
  query: string;
}

/** Whether a list of `count` options shows the search field. */
export function shouldSearch(
  count: number,
  threshold: number = CATEGORY_SEARCH_THRESHOLD,
): boolean {
  return count > threshold;
}

function searchKey(text: string): string {
  return text.trim().normalize("NFC").toLowerCase();
}

export function optionSheetModel<T extends OptionValue>({
  options,
  selected,
  query,
  searchable,
}: {
  options: readonly OptionSheetOption<T>[];
  selected: T | OptionValue;
  query: string;
  searchable: boolean;
}): OptionSheetModel<T> {
  const applied = searchable ? query.trim() : "";
  const key = searchKey(applied);
  const visible = key
    ? options.filter((option) => searchKey(option.label).includes(key))
    : options;
  return {
    rows: visible.map((option) => ({
      ...option,
      selected: option.value === selected,
    })),
    query: applied,
  };
}

/** A stable list key that keeps null, numbers and strings apart. */
export function optionKey(value: OptionValue): string {
  return value === null ? "null:" : `${typeof value}:${value}`;
}
